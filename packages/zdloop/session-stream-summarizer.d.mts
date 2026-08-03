export const GEMMA_SOURCE_MODEL: "google/gemma-3-270m";
export const GEMMA_RUNTIME_MODEL: "onnx-community/gemma-3-270m-ONNX";

type GeneratedText = string | Array<{ content?: string }>;
type Generator = ((
  prompt: string,
  options: { do_sample: boolean; max_new_tokens: number; return_full_text: boolean },
) => Promise<Array<{ generated_text: GeneratedText }>>) & { close?: () => Promise<void> };

interface WorkerGeneratorOptions {
  model: string;
  options: Record<string, unknown>;
  task: string;
  workerUrl?: string | URL;
}

interface GemmaEventSummarizerOptions {
  delayMs?: number;
  enabled?: boolean;
  loadPipeline?: (task: string, model: string, options: { dtype: string }) => Promise<Generator>;
  onStatus?: (status: string) => void;
  onSummary: (summary: string) => void;
}

interface GemmaEventSummarizer {
  close(options?: { wait?: boolean }): Promise<void>;
  flush(): Promise<void>;
  push(line: string, fallback: string): void;
  warmup(): Promise<void>;
}

export function createGemmaEventSummarizer(
  options: GemmaEventSummarizerOptions,
): GemmaEventSummarizer;

export function createWorkerGenerator(options: WorkerGeneratorOptions): Promise<Generator>;
