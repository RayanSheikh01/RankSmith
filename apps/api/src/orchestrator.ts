import type {
  Chunk,
  ExperimentRun,
  QueryRunResult,
  RankedCandidate,
  RunConfigRecord,
} from "@ranksmith/core";
import { newRunId, Timer, type Logger } from "@ranksmith/observability";
import { validateRunConfig } from "@ranksmith/core";
import {
  HybridRetriever,
  type RetrievedCandidate,
  type Retriever,
} from "@ranksmith/retrieval";
import { Bm25Index } from "@ranksmith/indexing-sparse";
import {
  DenseIndex,
  resolveEmbedder,
  buildDenseIndexCached,
  denseCacheKey,
  type Embedder,
  type DenseVectorCache,
} from "@ranksmith/indexing-dense";
import {
  LexicalCrossEncoder,
  rerankCandidates,
  type CrossEncoder,
  type RerankedCandidate,
} from "@ranksmith/reranking";
import {
  aggregateMetrics,
  computeQueryMetrics,
  type AggregateMetrics,
  type QueryMetrics,
  type Qrels,
} from "@ranksmith/evaluation";

export interface EvalQuery {
  id: string;
  text: string;
  qrels: Qrels;
}

export interface RunInput {
  config: RunConfigRecord;
  chunks: Chunk[];
  queries: EvalQuery[];
  querySetId: string;
  embedder?: Embedder;
  crossEncoder?: CrossEncoder;
  denseCache?: DenseVectorCache;
  corpusId?: string;
  corpusVersion?: number;
  seed?: number;
  commitHash?: string;
  /** Cutoff for metrics; defaults to the config topK. */
  evalK?: number;
}

export interface RunOutput {
  run: ExperimentRun;
  perQuery: QueryRunResult[];
  metrics: AggregateMetrics;
}

function toRankedCandidate(
  c: RetrievedCandidate | RerankedCandidate,
  mode: RunConfigRecord["retrievalMode"],
): RankedCandidate {
  const rerankScore = "rerankScore" in c ? c.rerankScore : null;
  const retrievalRank = "retrievalRank" in c ? c.retrievalRank : c.rank;
  return {
    rank: c.rank,
    retrievalRank,
    chunkId: c.chunkId,
    docId: c.docId,
    sparseScore: mode === "bm25" ? c.score : null,
    denseScore: mode === "dense" ? c.score : null,
    hybridScore: mode === "hybrid" ? c.score : null,
    rerankScore,
  };
}

async function buildDenseRetriever(
  chunks: Chunk[],
  embedder: Embedder,
  cache: DenseVectorCache | undefined,
  key: string | undefined,
): Promise<DenseIndex> {
  if (cache && key) return buildDenseIndexCached(chunks, embedder, cache, key);
  return DenseIndex.build(chunks, embedder);
}

async function buildRetriever(
  config: RunConfigRecord,
  chunks: Chunk[],
  embedder: Embedder,
  cache: DenseVectorCache | undefined,
  denseKey: string | undefined,
): Promise<Retriever> {
  switch (config.retrievalMode) {
    case "bm25":
      return new Bm25Index(chunks, config.bm25);
    case "dense":
      return buildDenseRetriever(chunks, embedder, cache, denseKey);
    case "hybrid": {
      const sparse = new Bm25Index(chunks, config.bm25);
      const dense = await buildDenseRetriever(chunks, embedder, cache, denseKey);
      return new HybridRetriever(sparse, dense, config.hybrid);
    }
  }
}

/**
 * Execute one experiment run: build the configured retriever over the corpus,
 * run every query (retrieve -> optional cross-encoder rerank), time each stage,
 * and compute per-query and aggregate metrics. Fully in-memory and deterministic
 * given the default local models.
 */
export async function runExperiment(input: RunInput, logger?: Logger): Promise<RunOutput> {
  const validation = validateRunConfig(input.config);
  if (!validation.valid) {
    throw new Error(`Invalid run config: ${validation.errors.join(" ")}`);
  }

  const runId = newRunId();
  const log = logger?.child({ runId });
  const startedAt = new Date().toISOString();
  const evalK = input.evalK ?? input.config.topK;

  const embedder = input.embedder ?? resolveEmbedder(input.config.dense.modelName);
  const denseKey =
    input.denseCache && input.corpusId
      ? denseCacheKey(input.corpusId, input.corpusVersion ?? 1, input.config.dense.modelName)
      : undefined;
  const crossEncoder = input.crossEncoder ?? new LexicalCrossEncoder();
  const textOf = new Map(input.chunks.map((c) => [c.id, c.text]));

  const retriever = await buildRetriever(
    input.config,
    input.chunks,
    embedder,
    input.denseCache,
    denseKey,
  );
  log?.info("retriever built", { mode: input.config.retrievalMode, chunks: input.chunks.length });

  const perQuery: QueryRunResult[] = [];
  const perQueryMetrics: QueryMetrics[] = [];
  const latencies: number[] = [];

  for (const query of input.queries) {
    const totalTimer = new Timer();

    const retrievalTimer = new Timer();
    let candidates: (RetrievedCandidate | RerankedCandidate)[] = await retriever.retrieve({
      queryText: query.text,
      topK: input.config.topK,
    });
    const retrievalLatencyMs = retrievalTimer.elapsedMs();

    let rerankLatencyMs = 0;
    if (input.config.rerankDepth > 0) {
      const rerankTimer = new Timer();
      candidates = await rerankCandidates(
        query.text,
        candidates as RetrievedCandidate[],
        (id) => textOf.get(id),
        crossEncoder,
        input.config.rerankDepth,
      );
      rerankLatencyMs = rerankTimer.elapsedMs();
    }

    const totalLatencyMs = totalTimer.elapsedMs();
    latencies.push(totalLatencyMs);

    perQuery.push({
      runId,
      queryId: query.id,
      candidates: candidates.map((c) => toRankedCandidate(c, input.config.retrievalMode)),
      retrievalLatencyMs,
      rerankLatencyMs,
      totalLatencyMs,
    });

    perQueryMetrics.push(
      computeQueryMetrics(candidates.map((c) => c.chunkId), query.qrels, evalK),
    );
  }

  const metrics = aggregateMetrics(perQueryMetrics, latencies, evalK);
  const run: ExperimentRun = {
    id: runId,
    runConfigId: input.config.id,
    querySetId: input.querySetId,
    status: "succeeded",
    startedAt,
    finishedAt: new Date().toISOString(),
    seed: input.seed ?? 0,
    commitHash: input.commitHash ?? "",
  };

  log?.info("run complete", {
    queries: perQuery.length,
    meanNdcg: metrics.meanNdcg,
    mrr: metrics.mrr,
  });

  return { run, perQuery, metrics };
}
