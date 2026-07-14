import type { CrossEncoder } from "./cross-encoder.js";

/** Minimal shapes of the transformers.js sequence-classification pieces we use. */
interface SeqClassOutput {
  logits: { data: Float32Array; dims: number[] };
}
type Tokenizer = (
  text: string | string[],
  opts: { text_pair: string | string[]; padding: boolean; truncation: boolean },
) => unknown;
type Model = (inputs: unknown) => Promise<SeqClassOutput>;

/**
 * Real cross-encoder backed by a local transformers.js sequence-classification
 * model. Loads the tokenizer + model once, lazily, on first use; the load
 * promise is cached so concurrent and repeat calls share it. Returns the raw
 * relevance logit per (query, document) pair — rerankCandidates sorts by score,
 * so no normalization is needed.
 */
export class TransformersCrossEncoder implements CrossEncoder {
  readonly modelName: string;
  private loaded: Promise<{ tokenizer: Tokenizer; model: Model }> | null = null;

  constructor(modelName = "Xenova/ms-marco-MiniLM-L-6-v2") {
    this.modelName = modelName;
  }

  private load(): Promise<{ tokenizer: Tokenizer; model: Model }> {
    if (!this.loaded) {
      // Dynamic import keeps the heavy dependency out of module load and lazy.
      this.loaded = import("@xenova/transformers").then(
        async ({ AutoTokenizer, AutoModelForSequenceClassification }) => ({
          tokenizer: (await AutoTokenizer.from_pretrained(this.modelName)) as unknown as Tokenizer,
          model: (await AutoModelForSequenceClassification.from_pretrained(
            this.modelName,
          )) as unknown as Model,
        }),
      );
    }
    return this.loaded;
  }

  async score(query: string, document: string): Promise<number> {
    const [only] = await this.scoreBatch(query, [document]);
    return only ?? 0;
  }

  async scoreBatch(query: string, documents: string[]): Promise<number[]> {
    if (documents.length === 0) return [];
    const { tokenizer, model } = await this.load();
    const inputs = tokenizer(new Array(documents.length).fill(query), {
      text_pair: documents,
      padding: true,
      truncation: true,
    });
    const { logits } = await model(inputs);
    // Single-logit regression head: logits shape [N, 1] -> N raw scores.
    return Array.from(logits.data);
  }
}
