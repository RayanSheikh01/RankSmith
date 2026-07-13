import type { HybridParams } from "@ranksmith/core";
import { rankByScore, type RetrievalRequest, type RetrievedCandidate, type Retriever } from "./contract.js";

interface Accumulator {
  chunkId: string;
  docId: string;
  score: number;
}

function mergeInto(acc: Map<string, Accumulator>, candidate: RetrievedCandidate, addScore: number): void {
  const existing = acc.get(candidate.chunkId);
  if (existing) {
    existing.score += addScore;
  } else {
    acc.set(candidate.chunkId, { chunkId: candidate.chunkId, docId: candidate.docId, score: addScore });
  }
}

/**
 * Reciprocal Rank Fusion. Rank-based, so it sidesteps score-scale mismatch
 * between strategies. Each candidate contributes 1 / (rrfK + rank) from every
 * list it appears in.
 */
export function reciprocalRankFusion(
  lists: RetrievedCandidate[][],
  rrfK: number,
  topK: number,
): RetrievedCandidate[] {
  const acc = new Map<string, Accumulator>();
  for (const list of lists) {
    for (const candidate of list) {
      mergeInto(acc, candidate, 1 / (rrfK + candidate.rank));
    }
  }
  return rankByScore([...acc.values()], topK);
}

/** Min-max normalize scores to [0, 1]; a flat list maps to all-zeros. */
function minMaxNormalize(list: RetrievedCandidate[]): Map<string, number> {
  const scores = list.map((c) => c.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  const out = new Map<string, number>();
  for (const c of list) {
    out.set(c.chunkId, range === 0 ? 0 : (c.score - min) / range);
  }
  return out;
}

/**
 * Weighted score fusion. Each list is min-max normalized to a common [0, 1]
 * scale, then combined as `sparseWeight * sparse + denseWeight * dense`.
 */
export function weightedFusion(
  sparse: RetrievedCandidate[],
  dense: RetrievedCandidate[],
  sparseWeight: number,
  denseWeight: number,
  topK: number,
): RetrievedCandidate[] {
  const sparseNorm = minMaxNormalize(sparse);
  const denseNorm = minMaxNormalize(dense);
  const acc = new Map<string, Accumulator>();
  for (const c of sparse) mergeInto(acc, c, sparseWeight * (sparseNorm.get(c.chunkId) ?? 0));
  for (const c of dense) mergeInto(acc, c, denseWeight * (denseNorm.get(c.chunkId) ?? 0));
  return rankByScore([...acc.values()], topK);
}

/**
 * Combines a sparse and a dense retriever using the configured fusion strategy.
 * Over-fetches `poolMultiplier * topK` from each side so fusion has enough
 * candidates to reorder before truncating to topK.
 */
export class HybridRetriever implements Retriever {
  readonly name = "hybrid";

  constructor(
    private readonly sparse: Retriever,
    private readonly dense: Retriever,
    private readonly params: HybridParams,
    private readonly poolMultiplier = 3,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievedCandidate[]> {
    const pool = Math.max(request.topK, request.topK * this.poolMultiplier);
    const [sparseHits, denseHits] = await Promise.all([
      this.sparse.retrieve({ queryText: request.queryText, topK: pool }),
      this.dense.retrieve({ queryText: request.queryText, topK: pool }),
    ]);

    if (this.params.fusionType === "rrf") {
      return reciprocalRankFusion([sparseHits, denseHits], this.params.rrfK, request.topK);
    }
    return weightedFusion(
      sparseHits,
      denseHits,
      this.params.sparseWeight,
      this.params.denseWeight,
      request.topK,
    );
  }
}
