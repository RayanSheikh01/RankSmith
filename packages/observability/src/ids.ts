import { randomUUID } from "node:crypto";

/**
 * Generate a prefixed, sortable-ish identifier for runs and entities.
 * Format: `<prefix>_<epochMillisBase36>_<shortUuid>`.
 * The time component keeps IDs roughly ordered by creation for easier debugging.
 */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}_${time}_${rand}`;
}

export const newRunId = (): string => newId("run");
export const newCorpusId = (): string => newId("corpus");
export const newDocId = (): string => newId("doc");
export const newChunkId = (): string => newId("chunk");
