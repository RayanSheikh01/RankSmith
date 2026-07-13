import type { Embedder } from "./embedder.js";
import { HashingEmbedder } from "./embedder.js";
import { TransformersEmbedder } from "./transformers-embedder.js";

/**
 * Maps a run config's dense.modelName to an embedder. Factories construct
 * lazily, so resolving a model name does not load or download anything until
 * the embedder is first used.
 */
const factories = new Map<string, () => Embedder>([
  ["hashing-bow-v1", () => new HashingEmbedder()],
  ["Xenova/all-MiniLM-L6-v2", () => new TransformersEmbedder()],
]);

export function knownEmbedderModels(): string[] {
  return [...factories.keys()];
}

export function resolveEmbedder(modelName: string): Embedder {
  const factory = factories.get(modelName);
  if (!factory) {
    throw new Error(
      `Unknown embedding model "${modelName}". Known models: ${knownEmbedderModels().join(", ")}.`,
    );
  }
  return factory();
}
