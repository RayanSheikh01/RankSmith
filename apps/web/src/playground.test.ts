import { test } from "node:test";
import assert from "node:assert/strict";
import { playgroundHtml } from "./playground.js";

test("playgroundHtml is a complete, self-contained HTML document", () => {
  assert.match(playgroundHtml, /^<!doctype html>/i);
  assert.ok(playgroundHtml.includes("</html>"));
  // Inline styles and script, no external asset references.
  assert.ok(playgroundHtml.includes("<style>"));
  assert.ok(playgroundHtml.includes("<script>"));
  assert.ok(!playgroundHtml.includes("http://"));
  assert.ok(!playgroundHtml.includes("https://"), "must not load external resources");
});

test("playgroundHtml wires the core playground controls and endpoints", () => {
  for (const id of ["buildBtn", "selectAllBtn", "runBtn", "chunks", "metrics", "ladder", "denseModel"]) {
    assert.ok(playgroundHtml.includes('id="' + id + '"'), "missing #" + id);
  }
  assert.ok(playgroundHtml.includes("/corpora"));
  assert.ok(playgroundHtml.includes("/runs"));
  // Dense model selector offers both the baseline and the real embedder.
  assert.ok(playgroundHtml.includes('value="hashing-bow-v1"'), "missing hashing option");
  assert.ok(playgroundHtml.includes('value="Xenova/all-MiniLM-L6-v2"'), "missing MiniLM option");
});
