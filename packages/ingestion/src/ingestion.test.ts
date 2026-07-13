import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, estimateTokens, checksum } from "./normalize.js";
import { chunkText } from "./chunk.js";
import { ingestDocument } from "./ingest.js";

test("normalizeText unifies line endings and collapses whitespace", () => {
  const out = normalizeText("a\r\n\r\n\r\n\r\nb   c\t\td  \r\n");
  assert.equal(out, "a\n\nb c d");
});

test("checksum is stable and change-sensitive", () => {
  const a = checksum(normalizeText("hello   world"));
  const b = checksum(normalizeText("hello world"));
  const c = checksum(normalizeText("hello world!"));
  assert.equal(a, b); // whitespace-only diff normalizes away
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("estimateTokens scales with word count", () => {
  assert.equal(estimateTokens(""), 0);
  assert.ok(estimateTokens("one two three") >= 3);
});

test("chunkText produces overlapping windows with char offsets", () => {
  const text = "w0 w1 w2 w3 w4 w5";
  const chunks = chunkText(text, { chunkSize: 3, overlap: 1 });
  // step = 2 -> windows [0..2],[2..4],[4..5]
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].text, "w0 w1 w2");
  assert.equal(chunks[1].text, "w2 w3 w4");
  assert.equal(chunks[2].text, "w4 w5");
  assert.equal(chunks[0].chunkOrder, 0);
  assert.equal(text.slice(chunks[1].charStart, chunks[1].charEnd), "w2 w3 w4");
});

test("chunkText rejects invalid overlap", () => {
  assert.throws(() => chunkText("a b c", { chunkSize: 2, overlap: 2 }));
  assert.throws(() => chunkText("a b c", { chunkSize: 0, overlap: 0 }));
});

test("chunkText returns empty for whitespace-only text", () => {
  assert.deepEqual(chunkText("   \n  ", { chunkSize: 3, overlap: 0 }), []);
});

test("ingestDocument links chunks to the produced document", () => {
  const { document, chunks } = ingestDocument({
    corpusId: "corpus_1",
    corpusVersion: 1,
    path: "/docs/a.md",
    title: "A",
    raw: "alpha beta gamma delta epsilon",
    preset: { chunkSize: 2, overlap: 0 },
  });
  assert.match(document.id, /^doc_/);
  assert.equal(document.checksum.length, 64);
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.docId === document.id));
  assert.ok(chunks.every((c) => c.corpusVersion === 1));
  assert.equal(chunks[0].metadata.charStart, "0");
});
