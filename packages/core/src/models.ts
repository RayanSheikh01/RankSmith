export type Id = string;
export type ISODateTime = string;

export interface Corpus {
  id: Id;
  name: string;
  version: number;
  createdAt: ISODateTime;
}

export interface SourceDocument {
  id: Id;
  corpusId: Id;
  path: string;
  title: string;
  checksum: string;
  metadata: Record<string, string>;
}

export interface Chunk {
  id: Id;
  docId: Id;
  corpusVersion: number;
  text: string;
  tokenCount: number;
  chunkOrder: number;
  metadata: Record<string, string>;
}

export type IndexType = "sparse" | "dense";

export interface IndexSnapshot {
  id: Id;
  corpusVersion: number;
  indexType: IndexType;
  modelName: string | null;
  builtAt: ISODateTime;
}

export interface QuerySet {
  id: Id;
  name: string;
  corpusVersion: number;
  createdAt: ISODateTime;
}

export interface Query {
  id: Id;
  querySetId: Id;
  text: string;
  metadata: Record<string, string>;
}

export interface RelevanceJudgment {
  queryId: Id;
  chunkId: Id | null;
  docId: Id | null;
  relevanceGrade: number;
}

export interface RunConfigRecord {
  id: Id;
  retrievalMode: "bm25" | "dense" | "hybrid";
  bm25: Bm25Params;
  dense: DenseParams;
  hybrid: HybridParams;
  topK: number;
  rerankDepth: number;
  crossEncoderModel: string | null;
}

export interface ExperimentRun {
  id: Id;
  runConfigId: Id;
  querySetId: Id;
  status: "pending" | "running" | "succeeded" | "failed";
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  seed: number;
  commitHash: string;
}

export interface RankedCandidate {
  rank: number;
  chunkId: Id;
  docId: Id;
  sparseScore: number | null;
  denseScore: number | null;
  hybridScore: number | null;
  rerankScore: number | null;
}

export interface QueryRunResult {
  runId: Id;
  queryId: Id;
  candidates: RankedCandidate[];
  retrievalLatencyMs: number;
  rerankLatencyMs: number;
  totalLatencyMs: number;
}

export interface RunMetrics {
  runId: Id;
  mrrAt10: number;
  ndcgAt10: number;
  recallAt10: number;
  precisionAt10: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

export interface Bm25Params {
  k1: number;
  b: number;
}

export interface DenseParams {
  modelName: string;
}

export interface HybridParams {
  fusionType: "rrf" | "weighted";
  sparseWeight: number;
  denseWeight: number;
  rrfK: number;
}
