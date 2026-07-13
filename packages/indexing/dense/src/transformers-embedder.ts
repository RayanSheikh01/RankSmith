import type { Embedder } from "./embedder.js";

/** Minimal shape of the transformers.js feature-extraction output we use. */
interface ExtractorOutput {
  data: Float32Array;
  dims: number[];
}
type Extractor = (
  input: string | string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<ExtractorOutput>;

/**
 * Real dense embedder backed by a local transformers.js ONNX model. The model
 * is loaded once, lazily, on first use; the load promise is cached so concurrent
 * and repeat calls share a single pipeline. With `normalize: true` the output is
 * already L2-normalized, so `dot` equals cosine similarity (matching DenseIndex).
 */
export class TransformersEmbedder implements Embedder {
  readonly modelName: string;
  readonly dim: number;
  private extractor: Promise<Extractor> | null = null;

  constructor(modelName = "Xenova/all-MiniLM-L6-v2", dim = 384) {
    this.modelName = modelName;
    this.dim = dim;
  }

  private getExtractor(): Promise<Extractor> {
    if (!this.extractor) {
      // Dynamic import keeps the heavy dependency out of module load and lazy.
      this.extractor = import("@xenova/transformers").then(
        ({ pipeline }) =>
          pipeline("feature-extraction", this.modelName) as unknown as Promise<Extractor>,
      );
    }
    return this.extractor;
  }

  async embed(text: string): Promise<Float32Array> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    // Copy out of the backing tensor buffer so slices are independent.
    return new Float32Array(output.data);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const dim = output.dims[output.dims.length - 1];
    const vectors: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      vectors.push(output.data.slice(i * dim, (i + 1) * dim));
    }
    return vectors;
  }
}
