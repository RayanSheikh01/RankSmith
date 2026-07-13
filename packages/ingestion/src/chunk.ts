import { estimateTokens } from "./normalize.js";

export interface ChunkingPreset {
  /** Window size in words. */
  chunkSize: number;
  /** Number of words each window shares with the previous one. */
  overlap: number;
}

export interface ChunkDraft {
  text: string;
  chunkOrder: number;
  tokenCount: number;
  charStart: number;
  charEnd: number;
}

interface WordSpan {
  text: string;
  start: number;
  end: number;
}

function wordSpans(text: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

/**
 * Split normalized text into overlapping word windows. The advance per window
 * is `chunkSize - overlap`; each chunk records its char offsets in the source
 * so callers can highlight or re-extract the original span.
 */
export function chunkText(text: string, preset: ChunkingPreset): ChunkDraft[] {
  if (preset.chunkSize < 1) {
    throw new Error("chunkSize must be >= 1.");
  }
  if (preset.overlap < 0 || preset.overlap >= preset.chunkSize) {
    throw new Error("overlap must be in the range [0, chunkSize).");
  }

  const spans = wordSpans(text);
  if (spans.length === 0) return [];

  const step = preset.chunkSize - preset.overlap;
  const drafts: ChunkDraft[] = [];
  let order = 0;

  for (let start = 0; start < spans.length; start += step) {
    const window = spans.slice(start, start + preset.chunkSize);
    const charStart = window[0].start;
    const charEnd = window[window.length - 1].end;
    const chunkText = text.slice(charStart, charEnd);
    drafts.push({
      text: chunkText,
      chunkOrder: order++,
      tokenCount: estimateTokens(chunkText),
      charStart,
      charEnd,
    });
    if (start + preset.chunkSize >= spans.length) break;
  }

  return drafts;
}
