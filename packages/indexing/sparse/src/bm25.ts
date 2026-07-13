import type { Chunk, Bm25Params } from "@ranksmith/core";
import {
  rankByScore,
  tokenize,
  type RetrievalRequest,
  type RetrievedCandidate,
  type Retriever,
} from "@ranksmith/retrieval";

interface Posting {
  docIndex: number;
  tf: number;
}

const DEFAULT_PARAMS: Bm25Params = { k1: 1.2, b: 0.75 };

/**
 * In-memory BM25 index over chunk text. Builds an inverted index and Okapi
 * BM25 statistics once, then scores queries against it. Implements the shared
 * Retriever contract so it is interchangeable with dense/hybrid strategies.
 */
export class Bm25Index implements Retriever {
  readonly name = "bm25";

  private readonly params: Bm25Params;
  private readonly chunks: Chunk[];
  private readonly docLengths: number[] = [];
  private readonly avgDocLength: number;
  /** term -> postings list */
  private readonly inverted = new Map<string, Posting[]>();

  constructor(chunks: Chunk[], params: Bm25Params = DEFAULT_PARAMS) {
    this.params = params;
    this.chunks = chunks;

    let totalLength = 0;
    chunks.forEach((chunk, docIndex) => {
      const terms = tokenize(chunk.text);
      this.docLengths[docIndex] = terms.length;
      totalLength += terms.length;

      const tfByTerm = new Map<string, number>();
      for (const term of terms) {
        tfByTerm.set(term, (tfByTerm.get(term) ?? 0) + 1);
      }
      for (const [term, tf] of tfByTerm) {
        let postings = this.inverted.get(term);
        if (!postings) {
          postings = [];
          this.inverted.set(term, postings);
        }
        postings.push({ docIndex, tf });
      }
    });

    this.avgDocLength = chunks.length === 0 ? 0 : totalLength / chunks.length;
  }

  private idf(df: number): number {
    const n = this.chunks.length;
    // Okapi BM25 idf with +1 shift to keep it non-negative.
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievedCandidate[]> {
    const { k1, b } = this.params;
    const queryTerms = new Set(tokenize(request.queryText));
    const scores = new Map<number, number>();

    for (const term of queryTerms) {
      const postings = this.inverted.get(term);
      if (!postings) continue;
      const idf = this.idf(postings.length);
      for (const { docIndex, tf } of postings) {
        const dl = this.docLengths[docIndex];
        const denom = tf + k1 * (1 - b + (b * dl) / (this.avgDocLength || 1));
        const contribution = idf * ((tf * (k1 + 1)) / denom);
        scores.set(docIndex, (scores.get(docIndex) ?? 0) + contribution);
      }
    }

    const scored = [...scores.entries()].map(([docIndex, score]) => {
      const chunk = this.chunks[docIndex];
      return { chunkId: chunk.id, docId: chunk.docId, score };
    });

    return rankByScore(scored, request.topK);
  }
}
