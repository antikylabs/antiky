import { clearTimeout, setTimeout } from "node:timers";
import { URL } from "node:url";
import { Worker } from "node:worker_threads";

export const GEMMA_SOURCE_MODEL = "google/gemma-3-270m";
export const GEMMA_RUNTIME_MODEL = "onnx-community/gemma-3-270m-ONNX";

const SUMMARY_INSTRUCTIONS = `Summarize the coding-agent events below.
Output exactly one line in this format:
<ONE TO THREE WORD ACTION> | <one present-tense sentence describing what the agent is doing>

Rules:
- The action is one to three uppercase words.
- The description is one sentence and no more than 18 words.
- Describe the operation's intent, not whether an event started or finished.
- Never repeat a shell executable, wrapper, or full command line.
- Prefer the supplied intent hint when it accurately describes the raw event.
- Use plain English. Do not use Markdown, preambles, or commentary.

Examples:
RUN TESTS | The agent runs the focused test suite to verify its latest changes.
EDIT FILES | The agent updates the loop runner and its regression tests.
CHECK STATUS | The agent inspects the repository state before continuing.

EVENTS:`;
const MAX_EVENT_CHARS = 2_000;

export async function createWorkerGenerator({
  model,
  options,
  task,
  workerUrl = new URL("./session-inference-worker.mjs", import.meta.url),
}) {
  const worker = new Worker(workerUrl);
  const requests = new Map();
  let closed = false;
  let nextRequestId = 1;

  // Inference must never keep zdloop alive after its Codex child and TUI close.
  worker.unref();

  function rejectRequests(error) {
    for (const { reject } of requests.values()) reject(error);
    requests.clear();
  }

  worker.on("message", ({ error, id, result }) => {
    const request = requests.get(id);
    if (!request) return;
    requests.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(result);
  });
  worker.on("error", rejectRequests);
  worker.on("exit", (code) => {
    if (!closed && code !== 0) {
      rejectRequests(new Error(`Gemma inference worker exited with status ${code}`));
    }
  });

  function request(type, payload = {}) {
    if (closed) return Promise.reject(new Error("Gemma inference worker is closed"));
    const id = nextRequestId;
    nextRequestId += 1;
    return new Promise((resolve, reject) => {
      requests.set(id, { reject, resolve });
      worker.postMessage({ ...payload, id, type });
    });
  }

  try {
    await request("load", { model, options, task });
  } catch (error) {
    closed = true;
    void worker.terminate();
    throw error;
  }

  const generate = (prompt, generationOptions) =>
    request("generate", { options: generationOptions, prompt });
  generate.close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    rejectRequests(new Error("Gemma inference worker closed"));
    return worker.terminate().then(() => undefined);
  };
  return generate;
}

function loadTransformersPipeline(task, model, options) {
  return createWorkerGenerator({ model, options, task });
}

function buildPrompt(events) {
  const boundedEvents = events.map((event) => {
    if (event.length <= MAX_EVENT_CHARS) return event;
    const omitted = event.length - MAX_EVENT_CHARS;
    return `${event.slice(0, 1_400)}…[${omitted} chars omitted]…${event.slice(-600)}`;
  });
  return `${SUMMARY_INSTRUCTIONS}\n${boundedEvents.join("\n")}\n\nSUMMARY:`;
}

function generatedText(output) {
  const value = output?.[0]?.generated_text;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.at(-1)?.content ?? "";
  return "";
}

function oneShortSentence(value) {
  const firstSentence = /^.*?[.!?](?=\s|$)/.exec(value)?.[0] ?? value;
  const words = firstSentence.trim().split(/\s+/).slice(0, 18);
  const sentence = words.join(" ").replace(/[,:;]+$/, "");
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function normalizeSummary(output) {
  const text = generatedText(output)
    .split("SUMMARY:")
    .at(-1)
    ?.trim()
    .split("\n")[0]
    ?.replace(/^[-*]\s*/, "")
    .trim();
  if (!text || text.length > 180) return undefined;

  const match = /^([A-Z0-9]+(?: [A-Z0-9]+){0,2})\s*\|\s*(\S.+)$/i.exec(text);
  if (!match) return undefined;
  const action = match[1].toUpperCase();
  const description = oneShortSentence(match[2]);
  return `${action} | ${description}`;
}

export function createGemmaEventSummarizer({
  delayMs = 120,
  enabled = true,
  loadPipeline = loadTransformersPipeline,
  onStatus = () => {},
  onSummary,
}) {
  let generatorPromise;
  let loadFailed = false;
  let pending = [];
  let timer;
  let draining = Promise.resolve();

  async function getGenerator() {
    if (!enabled || loadFailed) return undefined;
    if (!generatorPromise) {
      onStatus("Loading Gemma 3 270M…");
      generatorPromise = loadPipeline("text-generation", GEMMA_RUNTIME_MODEL, { dtype: "q4" })
        .then((generator) => {
          onStatus("Gemma ready");
          return generator;
        })
        .catch((error) => {
          loadFailed = true;
          const reason = error instanceof Error ? error.message : String(error);
          onStatus(`Gemma unavailable — using event labels (${reason})`);
          return undefined;
        });
    }
    return generatorPromise;
  }

  async function summarize(batch) {
    const fallback = batch.at(-1).fallback;
    const generator = await getGenerator();
    if (!generator) return fallback;

    try {
      const events = batch.map(
        ({ fallback, line }) => `INTENT HINT: ${fallback}\nRAW EVENT: ${line}`,
      );
      const output = await generator(buildPrompt(events), {
        do_sample: false,
        max_new_tokens: 40,
        return_full_text: false,
      });
      return normalizeSummary(output) ?? fallback;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      onStatus(`Gemma inference failed — using event labels (${reason})`);
      return fallback;
    }
  }

  async function drain() {
    while (pending.length > 0) {
      const batch = pending;
      pending = [];
      onSummary(await summarize(batch));
    }
  }

  function startDrain() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    draining = draining.then(drain);
    return draining;
  }

  return {
    async close({ wait = true } = {}) {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = [];
      if (!generatorPromise) return;
      if (!wait) {
        void generatorPromise.then((generator) => generator?.close?.());
        return;
      }
      const generator = await generatorPromise;
      const closing = generator?.close?.();
      await closing;
    },
    async flush() {
      await startDrain();
    },
    push(line, fallback) {
      if (!enabled) {
        onSummary(fallback);
        return;
      }
      pending.push({ fallback, line });
      if (timer) clearTimeout(timer);
      timer = setTimeout(startDrain, delayMs);
      timer.unref?.();
    },
    warmup() {
      if (!enabled) {
        onStatus("Gemma disabled — using event labels");
        return Promise.resolve();
      }
      return getGenerator().then(() => undefined);
    },
  };
}
