import { describe, expect, it, vi } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";

import {
  createGemmaEventSummarizer,
  GEMMA_RUNTIME_MODEL,
  GEMMA_SOURCE_MODEL,
} from "../../session-stream-summarizer.mjs";

describe("the zdloop Gemma event summarizer", () => {
  it("keeps the caller responsive while inference is synchronously busy", async () => {
    const summarizerModule = await import("../../session-stream-summarizer.mjs");
    const createWorkerGenerator = Reflect.get(summarizerModule, "createWorkerGenerator");

    expect(createWorkerGenerator).toBeTypeOf("function");
    const generator = await createWorkerGenerator({
      model: "fixture-model",
      options: {},
      task: "text-generation",
      workerUrl: resolve(import.meta.dirname, "../fixtures/blocking-inference-worker.mjs"),
    });
    const startedAt = Date.now();
    const generation = generator("events", {
      do_sample: false,
      max_new_tokens: 40,
      return_full_text: false,
    });

    await delay(25);
    expect(Date.now() - startedAt).toBeLessThan(150);
    await expect(generation).resolves.toEqual([
      { generated_text: "RUN TESTS | The agent runs tests in an isolated worker." },
    ]);
    await generator.close?.();
  });

  it("passes every queued event to one concise Gemma summary prompt", async () => {
    const generate = vi.fn(async (prompt: string, options: Record<string, unknown>) => {
      void prompt;
      void options;
      return [
        {
          generated_text:
            "RUN TESTS | The agent runs the focused test suite. It then waits for another task.",
        },
      ];
    });
    const loadPipeline = vi.fn(async () => generate);
    const summaries: string[] = [];
    const statuses: string[] = [];
    const summarizer = createGemmaEventSummarizer({
      delayMs: 60_000,
      loadPipeline,
      onStatus: (status) => statuses.push(status),
      onSummary: (summary) => summaries.push(summary),
    });

    summarizer.push(
      JSON.stringify({ type: "item.started", item: { command: "npm test" } }),
      "RUN COMMAND | The agent started npm test.",
    );
    summarizer.push(
      JSON.stringify({ type: "item.completed", item: { command: "npm test", exit_code: 0 } }),
      "FINISH COMMAND | The npm test command completed.",
    );
    await summarizer.flush();

    expect(GEMMA_SOURCE_MODEL).toBe("google/gemma-3-270m");
    expect(loadPipeline).toHaveBeenCalledWith("text-generation", GEMMA_RUNTIME_MODEL, {
      dtype: "q4",
    });
    const prompt = generate.mock.calls[0]![0] as string;
    expect(prompt).toContain("INTENT HINT: RUN COMMAND | The agent started npm test.");
    expect(prompt).toContain('"type":"item.started"');
    expect(prompt).toContain('"type":"item.completed"');
    expect(generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ do_sample: false, max_new_tokens: 40 }),
    );
    expect(summaries).toEqual(["RUN TESTS | The agent runs the focused test suite."]);
    expect(statuses).toContain("Gemma ready");
  });

  it("bounds captured command output before sending an event to Gemma", async () => {
    let prompt = "";
    const loadPipeline = vi.fn(async () => async (value: string) => {
      prompt = value;
      return [{ generated_text: "RUN COMMAND | The agent runs a command." }];
    });
    const summarizer = createGemmaEventSummarizer({
      delayMs: 60_000,
      loadPipeline,
      onSummary: vi.fn(),
    });
    const oversizedEvent = JSON.stringify({
      item: { aggregated_output: "x".repeat(100_000), type: "command_execution" },
      type: "item.completed",
    });

    summarizer.push(oversizedEvent, "FINISH COMMAND | The command completed.");
    await summarizer.flush();

    expect(prompt.length).toBeLessThan(5_000);
    expect(prompt).toContain('"type":"item.completed"');
  });

  it("falls back deterministically when Gemma cannot produce the requested format", async () => {
    const loadPipeline = vi.fn(async () => async () => [{ generated_text: "unclear" }]);
    const summaries: string[] = [];
    const summarizer = createGemmaEventSummarizer({
      delayMs: 60_000,
      loadPipeline,
      onStatus: vi.fn(),
      onSummary: (summary) => summaries.push(summary),
    });

    summarizer.push("event one", "RUN COMMAND | The agent started a command.");
    summarizer.push("event two", "FINISH COMMAND | The command completed successfully.");
    await summarizer.flush();

    expect(summaries).toEqual(["FINISH COMMAND | The command completed successfully."]);
  });

  it("keeps the stream usable when the model cannot load", async () => {
    const summaries: string[] = [];
    const statuses: string[] = [];
    const summarizer = createGemmaEventSummarizer({
      delayMs: 60_000,
      loadPipeline: async () => {
        throw new Error("model access denied");
      },
      onStatus: (status) => statuses.push(status),
      onSummary: (summary) => summaries.push(summary),
    });

    summarizer.push("event", "CALL TOOL | The agent calls a repository tool.");
    await summarizer.flush();

    expect(summaries).toEqual(["CALL TOOL | The agent calls a repository tool."]);
    expect(statuses).toContain("Gemma unavailable — using event labels (model access denied)");
  });
});
