import { createHash } from "node:crypto";

/**
 * Normalize raw document text into a canonical form for chunking and hashing:
 * - unify CRLF / CR line endings to LF
 * - strip zero-width and BOM characters
 * - collapse runs of spaces/tabs to a single space
 * - collapse 3+ blank lines to a single blank line
 * - trim trailing whitespace on each line and the document as a whole
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rough token estimate. Whitespace-delimited words scaled by a factor that
 * approximates subword tokenization (~1.3 tokens/word). Deterministic and
 * dependency-free so chunk sizes stay reproducible across runs.
 */
export function estimateTokens(text: string): number {
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/** SHA-256 hex checksum of the normalized text, used for change detection. */
export function checksum(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
