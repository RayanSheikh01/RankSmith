/**
 * Graded relevance judgments for a single query: chunkId -> relevance grade.
 * Grade 0 (or absent) means non-relevant; higher grades mean more relevant.
 */
export type Qrels = Map<string, number>;

/** Chunk IDs in ranked order (best first) as produced by a retriever/reranker. */
export type RankedList = string[];

function relevantIds(qrels: Qrels): Set<string> {
  const set = new Set<string>();
  for (const [id, grade] of qrels) if (grade > 0) set.add(id);
  return set;
}

/** Fraction of all relevant chunks that appear in the top-k. */
export function recallAtK(ranked: RankedList, qrels: Qrels, k: number): number {
  const relevant = relevantIds(qrels);
  if (relevant.size === 0) return 0;
  const topK = ranked.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

/** Fraction of the top-k that are relevant. */
export function precisionAtK(ranked: RankedList, qrels: Qrels, k: number): number {
  if (k <= 0) return 0;
  const relevant = relevantIds(qrels);
  const topK = ranked.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / k;
}

/** Reciprocal rank of the first relevant chunk; 0 if none are retrieved. */
export function reciprocalRank(ranked: RankedList, qrels: Qrels): number {
  const relevant = relevantIds(qrels);
  for (let i = 0; i < ranked.length; i++) {
    if (relevant.has(ranked[i])) return 1 / (i + 1);
  }
  return 0;
}

function dcgAtK(ranked: RankedList, qrels: Qrels, k: number): number {
  let dcg = 0;
  const topK = ranked.slice(0, k);
  for (let i = 0; i < topK.length; i++) {
    const grade = qrels.get(topK[i]) ?? 0;
    if (grade > 0) {
      // Standard gain 2^grade - 1 with log2(rank+1) discount.
      dcg += (Math.pow(2, grade) - 1) / Math.log2(i + 2);
    }
  }
  return dcg;
}

/** Normalized DCG at k using graded relevance; 1.0 is the ideal ordering. */
export function ndcgAtK(ranked: RankedList, qrels: Qrels, k: number): number {
  const dcg = dcgAtK(ranked, qrels, k);
  const idealOrder = [...qrels.entries()]
    .filter(([, g]) => g > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const idcg = dcgAtK(idealOrder, qrels, k);
  return idcg === 0 ? 0 : dcg / idcg;
}

export interface QueryMetrics {
  recall: number;
  precision: number;
  reciprocalRank: number;
  ndcg: number;
}

/** Compute all per-query metrics at cutoff k. */
export function computeQueryMetrics(ranked: RankedList, qrels: Qrels, k: number): QueryMetrics {
  return {
    recall: recallAtK(ranked, qrels, k),
    precision: precisionAtK(ranked, qrels, k),
    reciprocalRank: reciprocalRank(ranked, qrels),
    ndcg: ndcgAtK(ranked, qrels, k),
  };
}
