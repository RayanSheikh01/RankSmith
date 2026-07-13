import { percentile } from "@ranksmith/observability";
import type { QueryMetrics } from "./metrics.js";

export interface AggregateMetrics {
  k: number;
  queryCount: number;
  meanRecall: number;
  meanPrecision: number;
  mrr: number;
  meanNdcg: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Aggregate per-query metrics into a run-level summary. MRR is the mean of the
 * per-query reciprocal ranks; latency percentiles come from the per-query
 * total latencies.
 */
export function aggregateMetrics(
  perQuery: QueryMetrics[],
  latenciesMs: number[],
  k: number,
): AggregateMetrics {
  return {
    k,
    queryCount: perQuery.length,
    meanRecall: mean(perQuery.map((m) => m.recall)),
    meanPrecision: mean(perQuery.map((m) => m.precision)),
    mrr: mean(perQuery.map((m) => m.reciprocalRank)),
    meanNdcg: mean(perQuery.map((m) => m.ndcg)),
    latencyP50Ms: percentile(latenciesMs, 0.5),
    latencyP95Ms: percentile(latenciesMs, 0.95),
  };
}
