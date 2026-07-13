import type { Chunk, SourceDocument, Id } from "@ranksmith/core";
import { newChunkId, newDocId } from "@ranksmith/observability";
import { checksum, normalizeText } from "./normalize.js";
import { chunkText, type ChunkingPreset } from "./chunk.js";

export interface IngestInput {
  corpusId: Id;
  corpusVersion: number;
  path: string;
  title: string;
  raw: string;
  preset: ChunkingPreset;
  metadata?: Record<string, string>;
}

export interface IngestResult {
  document: SourceDocument;
  chunks: Chunk[];
}

/**
 * Normalize a source document, compute its checksum, and split it into chunks.
 * The document checksum is over the normalized text so cosmetic whitespace
 * changes do not trigger spurious re-indexing.
 */
export function ingestDocument(input: IngestInput): IngestResult {
  const normalized = normalizeText(input.raw);
  const document: SourceDocument = {
    id: newDocId(),
    corpusId: input.corpusId,
    path: input.path,
    title: input.title,
    checksum: checksum(normalized),
    metadata: input.metadata ?? {},
  };

  const chunks: Chunk[] = chunkText(normalized, input.preset).map((draft) => ({
    id: newChunkId(),
    docId: document.id,
    corpusVersion: input.corpusVersion,
    text: draft.text,
    tokenCount: draft.tokenCount,
    chunkOrder: draft.chunkOrder,
    metadata: {
      charStart: String(draft.charStart),
      charEnd: String(draft.charEnd),
    },
  }));

  return { document, chunks };
}
