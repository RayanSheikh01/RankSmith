import type { Chunk, Corpus, RunConfigRecord } from "@ranksmith/core";
import { newCorpusId, newId } from "@ranksmith/observability";
import { ingestDocument, type ChunkingPreset } from "@ranksmith/ingestion";
import type { Qrels } from "@ranksmith/evaluation";
import { InMemoryRepository, FileRepository, type Repository } from "@ranksmith/storage";
import { join } from "node:path";
import { runExperiment, type EvalQuery, type RunOutput } from "./orchestrator.js";

export interface DocumentInput {
  path: string;
  title: string;
  raw: string;
}

export interface CorpusRecord {
  corpus: Corpus;
  chunks: Chunk[];
}

export interface RunRequestQuery {
  id: string;
  text: string;
  /** chunkId -> relevance grade */
  qrels: Record<string, number>;
}

export interface CreateRunRequest {
  config: RunConfigRecord;
  corpusId: string;
  queries: RunRequestQuery[];
  seed?: number;
  commitHash?: string;
  evalK?: number;
}

export interface StoreRepositories {
  corpora: Repository<CorpusRecord>;
  runs: Repository<RunOutput>;
}

/**
 * Application store over injectable repositories. Defaults to in-memory; pass
 * filesystem repositories (see `fileRepositories`) to persist corpora and run
 * artifacts across restarts.
 */
export class RankSmithStore {
  private readonly corpora: Repository<CorpusRecord>;
  private readonly runs: Repository<RunOutput>;

  constructor(repositories?: StoreRepositories) {
    this.corpora = repositories?.corpora ?? new InMemoryRepository<CorpusRecord>();
    this.runs = repositories?.runs ?? new InMemoryRepository<RunOutput>();
  }

  async createCorpus(
    name: string,
    documents: DocumentInput[],
    preset: ChunkingPreset,
  ): Promise<CorpusRecord> {
    const corpus: Corpus = {
      id: newCorpusId(),
      name,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    const chunks: Chunk[] = [];
    for (const doc of documents) {
      const result = ingestDocument({
        corpusId: corpus.id,
        corpusVersion: corpus.version,
        path: doc.path,
        title: doc.title,
        raw: doc.raw,
        preset,
      });
      chunks.push(...result.chunks);
    }
    const record = { corpus, chunks };
    await this.corpora.save(corpus.id, record);
    return record;
  }

  async getCorpus(id: string): Promise<CorpusRecord | undefined> {
    return this.corpora.get(id);
  }

  async listCorpora(): Promise<Corpus[]> {
    return (await this.corpora.list()).map((r) => r.corpus);
  }

  async createRun(request: CreateRunRequest): Promise<RunOutput> {
    const record = await this.corpora.get(request.corpusId);
    if (!record) {
      throw new Error(`Unknown corpusId: ${request.corpusId}`);
    }
    const queries: EvalQuery[] = request.queries.map((q) => ({
      id: q.id || newId("query"),
      text: q.text,
      qrels: new Map(Object.entries(q.qrels)) as Qrels,
    }));
    const output = await runExperiment({
      config: request.config,
      chunks: record.chunks,
      queries,
      querySetId: newId("qs"),
      seed: request.seed,
      commitHash: request.commitHash,
      evalK: request.evalK,
    });
    await this.runs.save(output.run.id, output);
    return output;
  }

  async getRun(id: string): Promise<RunOutput | undefined> {
    return this.runs.get(id);
  }

  async listRuns(): Promise<RunOutput["run"][]> {
    return (await this.runs.list()).map((r) => r.run);
  }
}

/** Filesystem-backed repositories rooted at `data/` by default. */
export function fileRepositories(baseDir = "data"): StoreRepositories {
  return {
    corpora: new FileRepository<CorpusRecord>(join(baseDir, "corpora")),
    runs: new FileRepository<RunOutput>(join(baseDir, "runs")),
  };
}
