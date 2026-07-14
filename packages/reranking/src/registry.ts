import type { CrossEncoder } from "./cross-encoder.js";
import { LexicalCrossEncoder } from "./cross-encoder.js";
import { TransformersCrossEncoder } from "./transformers-cross-encoder.js";

/**
 * Maps a run config's crossEncoderModel to a cross-encoder. Factories construct
 * lazily, so resolving a model name does not load or download anything until the
 * encoder is first used.
 */
const factories = new Map<string, () => CrossEncoder>([
  ["lexical-overlap-v1", () => new LexicalCrossEncoder()],
  ["Xenova/ms-marco-MiniLM-L-6-v2", () => new TransformersCrossEncoder()],
]);

export function knownCrossEncoderModels(): string[] {
  return [...factories.keys()];
}

export function resolveCrossEncoder(modelName: string): CrossEncoder {
  const factory = factories.get(modelName);
  if (!factory) {
    throw new Error(
      `Unknown cross-encoder model "${modelName}". Known models: ${knownCrossEncoderModels().join(", ")}.`,
    );
  }
  return factory();
}
