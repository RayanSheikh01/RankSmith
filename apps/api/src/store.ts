import type { Chunk, Corpus, RunConfigRecord } from "@ranksmith/core";
import { newCorpusId, newId } from "@ranksmith/observability";
import { ingestDocument, type ChunkingPreset } from "@ranksmith/ingestion";
import type { Qrels } from "@ranksmith/evaluation";
import { InMemoryRepository, FileRepository, type Repository } from "@ranksmith/storage";
import type { StoredDenseVectors, DenseVectorCache } from "@ranksmith/indexing-dense";
import { join } from "node:path";
import { runExperiment, type EvalQuery, type RunOutput } from "./orchestrator.js";
import { gitCommit } from "./git.js";

export interface DocumentInput {
  path: string;
  title: string;
  raw: string;
}

export interface CorpusRecord {
  corpus: Corpus;
  chunks: Chunk[];
  documents: DocumentInput[];
}

export interface QuerySetRecord {
  id: string;
  name: string;
  corpusId: string;
  queries: RunRequestQuery[];
  createdAt: string;
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
  queries?: RunRequestQuery[];
  querySetId?: string;
  commitHash?: string;
  evalK?: number;
}

export interface StoreRepositories {
  corpora: Repository<CorpusRecord>;
  runs: Repository<RunOutput>;
  vectors: Repository<StoredDenseVectors>;
  querySets?: Repository<QuerySetRecord>;

}

/** Adapt a storage Repository to the DenseVectorCache shape (put -> save). */
function repositoryVectorCache(repo: Repository<StoredDenseVectors>): DenseVectorCache {
  return {
    get: (key) => repo.get(key),
    put: (key, value) => repo.save(key, value),
  };
}

/**
 * Application store over injectable repositories. Defaults to in-memory; pass
 * filesystem repositories (see `fileRepositories`) to persist corpora and run
 * artifacts across restarts.
 */
export class RankSmithStore {
  private readonly corpora: Repository<CorpusRecord>;
  private readonly runs: Repository<RunOutput>;
  private readonly vectors: Repository<StoredDenseVectors>;
  private readonly querySets: Repository<QuerySetRecord>;

  constructor(repositories?: StoreRepositories) {
    this.corpora = repositories?.corpora ?? new InMemoryRepository<CorpusRecord>();
    this.runs = repositories?.runs ?? new InMemoryRepository<RunOutput>();
    this.vectors = repositories?.vectors ?? new InMemoryRepository<StoredDenseVectors>();
    this.querySets = repositories?.querySets ?? new InMemoryRepository<QuerySetRecord>();

  }

  async createQuerySet(name: string, corpusId: string, queries: RunRequestQuery[]): Promise<QuerySetRecord> {
    if ((await this.corpora.get(corpusId)) === undefined) {
      throw new Error(`Unknown corpusId: ${corpusId}`);
    }
    const record: QuerySetRecord = {
      id: newId("qs"),
      name,
      corpusId,
      queries,
      createdAt: new Date().toISOString(),
    };
    await this.querySets.save(record.id, record);
    return record;
  }

  async getQuerySet(id: string): Promise<QuerySetRecord | undefined> {
    return this.querySets.get(id);
  }

  async listQuerySets(): Promise<QuerySetRecord[]> {
    return (await this.querySets.list()).map((r) => r);
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
    const checksums: string[] = [];
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
      checksums.push(result.document.checksum);
    }
    const record = { corpus, chunks, checksums };
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
    let sourceQueries: RunRequestQuery[];
    let querySetId: string;
    if (request.querySetId) {
      const querySet = await this.querySets.get(request.querySetId);
      if (!querySet) {
        throw new Error(`Unknown querySetId: ${request.querySetId}`);
      }
      sourceQueries = querySet.queries;
      querySetId = querySet.id;
    } else {
      sourceQueries = request.queries ?? [];
      querySetId = newId("qs");
    }
    if (sourceQueries.length === 0) {
      throw new Error("createRun requires a querySetId or inline queries");
    }
    const record = await this.corpora.get(request.corpusId);
    if (!record) {
      throw new Error(`Unknown corpusId: ${request.corpusId}`);
    }
    const queries: EvalQuery[] = sourceQueries.map((q) => ({
      id: q.id || newId("query"),
      text: q.text,
      qrels: new Map(Object.entries(q.qrels)) as Qrels,
    }));
    const output = await runExperiment({
      config: request.config,
      chunks: record.chunks,
      queries,
      querySetId,
      commitHash: gitCommit(),
      evalK: request.evalK,
      denseCache: repositoryVectorCache(this.vectors),
      corpusId: request.corpusId,
      corpusVersion: record.corpus.version,
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
    vectors: new FileRepository<StoredDenseVectors>(join(baseDir, "indexes")),
    querySets: new FileRepository<QuerySetRecord>(join(baseDir, "query-sets"))
  };
}


