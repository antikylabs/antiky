import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("The inference worker must run inside a worker thread");

let generator;

parentPort.on("message", async ({ id, model, options, prompt, task, type }) => {
  try {
    if (type === "load") {
      const { pipeline } = await import("@huggingface/transformers");
      generator = await pipeline(task, model, options);
      parentPort.postMessage({ id, result: "ready" });
      return;
    }

    if (type === "generate") {
      if (!generator) throw new Error("The inference model is not loaded");
      const result = await generator(prompt, options);
      parentPort.postMessage({ id, result });
      return;
    }

    throw new Error(`Unknown inference worker message: ${type}`);
  } catch (error) {
    parentPort.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    });
  }
});
