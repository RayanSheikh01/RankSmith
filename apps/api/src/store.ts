import type { Chunk, Corpus, RunConfigRecord } from "@ranksmith/core";
import { newCorpusId, newId } from "@ranksmith/observability";
import { ingestDocument, type ChunkingPreset } from "@ranksmith/ingestion";
import type { Qrels } from "@ranksmith/evaluation";
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

/** In-memory repositories for corpora and experiment runs. */
export class RankSmithStore {
  private readonly corpora = new Map<string, CorpusRecord>();
  private readonly runs = new Map<string, RunOutput>();

  createCorpus(name: string, documents: DocumentInput[], preset: ChunkingPreset): CorpusRecord {
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
    this.corpora.set(corpus.id, record);
    return record;
  }

  getCorpus(id: string): CorpusRecord | undefined {
    return this.corpora.get(id);
  }

  listCorpora(): Corpus[] {
    return [...this.corpora.values()].map((r) => r.corpus);
  }

  async createRun(request: CreateRunRequest): Promise<RunOutput> {
    const record = this.corpora.get(request.corpusId);
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
    this.runs.set(output.run.id, output);
    return output;
  }

  getRun(id: string): RunOutput | undefined {
    return this.runs.get(id);
  }

  listRuns(): RunOutput["run"][] {
    return [...this.runs.values()].map((r) => r.run);
  }
}
