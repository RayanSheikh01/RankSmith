/**
 * Self-contained RankSmith playground page. Served as a single HTML document by
 * the API (same-origin, so fetch needs no base URL). Authored without JS
 * template literals or "${" so it can live inside a TS template literal string.
 *
 * Design: an IR "instrument" aesthetic — deep ink panels, an amber signal
 * accent, and a signature "rank ladder" that shows how each candidate moves
 * position from retrieval to reranking (teal = climbed, coral = dropped).
 */
export const playgroundHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RankSmith — retrieval &amp; reranking playground</title>
<style>
  :root {
    --ink: #0B0E14;
    --panel: #141922;
    --panel-2: #1A212D;
    --line: #232B39;
    --text: #C9D4E3;
    --muted: #6B7A90;
    --signal: #E8B84B;
    --up: #57C7A6;
    --down: #E06C5A;
    --mono: ui-monospace, "Cascadia Code", "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--ink);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--signal); }
  header.top {
    border-bottom: 1px solid var(--line);
    padding: 18px 24px;
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
  }
  .wordmark {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.02em;
  }
  .wordmark .smith { color: var(--signal); }
  .tagline {
    font-family: var(--mono);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 10px;
    color: var(--muted);
  }
  .status { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 7px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--down); box-shadow: 0 0 8px var(--down); }
  .dot.ok { background: var(--up); box-shadow: 0 0 8px var(--up); }
  main {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 1px;
    background: var(--line);
    min-height: calc(100vh - 60px);
  }
  .col { background: var(--ink); padding: 22px; }
  .col.control { background: var(--panel); }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } }

  .eyebrow {
    font-family: var(--mono);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 10px;
    color: var(--muted);
    margin: 26px 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .eyebrow:first-child { margin-top: 0; }
  .eyebrow .idx { color: var(--signal); }
  .eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  label.field { display: block; margin: 12px 0; }
  label.field > span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }
  input[type=text], input[type=number], textarea {
    width: 100%;
    background: var(--ink);
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    padding: 9px 11px;
  }
  textarea { resize: vertical; min-height: 96px; line-height: 1.55; }
  input:focus-visible, textarea:focus-visible, button:focus-visible, .chk:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 1px;
  }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }

  button {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--text);
    border-radius: 6px;
    padding: 10px 14px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }
  button:hover { border-color: var(--muted); }
  button.primary {
    background: var(--signal);
    color: #1a1400;
    border-color: var(--signal);
    font-weight: 700;
  }
  button.primary:hover { filter: brightness(1.08); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.mini { padding: 6px 10px; font-size: 11px; margin-bottom: 8px; }

  .modes { display: flex; gap: 8px; flex-wrap: wrap; }
  .chk {
    font-family: var(--mono);
    font-size: 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 7px 11px;
    cursor: pointer;
    user-select: none;
    color: var(--muted);
  }
  .chk[aria-pressed=true] { color: var(--text); border-color: var(--signal); background: rgba(232,184,75,0.08); }

  .hint { font-size: 12px; color: var(--muted); margin: 6px 0 0; }
  .pill { font-family: var(--mono); font-size: 11px; color: var(--signal); }

  .chunks { max-height: 220px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; margin-top: 8px; }
  .chunkrow { display: flex; gap: 9px; padding: 8px 11px; border-bottom: 1px solid var(--line); align-items: flex-start; }
  .chunkrow:last-child { border-bottom: none; }
  .chunkrow input { margin-top: 3px; accent-color: var(--signal); }
  .chunkrow .ct { font-size: 12px; color: var(--text); }
  .chunkrow .cid { font-family: var(--mono); font-size: 10px; color: var(--muted); }

  .queryset { margin-top: 8px; }
  .qrow { display: flex; align-items: baseline; gap: 9px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 6px; background: var(--ink); }
  .qrow .qt { flex: 1; font-size: 12px; }
  .qrow .qn { font-family: var(--mono); font-size: 10px; color: var(--signal); }
  .qrow .qx { font-family: var(--mono); font-size: 14px; color: var(--muted); cursor: pointer; background: none; border: none; padding: 0 2px; }
  .qrow .qx:hover { color: var(--down); }

  /* Per-query comparison table */
  .qtable { width: 100%; border-collapse: collapse; font-size: 12px; }
  .qtable th, .qtable td { text-align: left; padding: 9px 11px; border-bottom: 1px solid var(--line); }
  .qtable th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); font-weight: 400; }
  .qtable td.num { font-family: var(--mono); text-align: right; color: var(--muted); }
  .qtable td.num.best { color: var(--up); font-weight: 700; }
  .qtable td.num.zero { color: var(--down); }
  .qtable tr:last-child td { border-bottom: none; }
  .qtable .qtext { color: var(--text); }
  .tablewrap { border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }

  /* Results side */
  .placeholder { color: var(--muted); font-family: var(--mono); font-size: 13px; border: 1px dashed var(--line); border-radius: 8px; padding: 40px; text-align: center; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .metric-card { background: var(--panel); padding: 16px; }
  .metric-card h3 { margin: 0 0 12px; font-family: var(--mono); font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; }
  .metric-card h3 .mode-tag { color: var(--signal); }
  .meter { margin: 9px 0; }
  .meter .mlabel { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .meter .mlabel b { color: var(--text); font-weight: 600; }
  .track { height: 5px; background: var(--panel-2); border-radius: 3px; overflow: hidden; }
  .track > i { display: block; height: 100%; background: var(--signal); border-radius: 3px; }
  .lat { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 12px; border-top: 1px solid var(--line); padding-top: 9px; }

  .tabs { display: flex; gap: 6px; margin: 22px 0 12px; flex-wrap: wrap; }
  .tab { font-family: var(--mono); font-size: 12px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; cursor: pointer; color: var(--muted); }
  .tab[aria-selected=true] { color: #1a1400; background: var(--signal); border-color: var(--signal); font-weight: 700; }

  /* Signature: rank ladder */
  .ladder { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .rung { display: grid; grid-template-columns: 40px 46px 1fr 120px; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--line); }
  .rung:last-child { border-bottom: none; }
  .rung.relevant { background: rgba(87,199,166,0.06); }
  .rung .rank { font-family: var(--mono); font-size: 18px; color: var(--muted); text-align: right; }
  .rung.relevant .rank { color: var(--up); }
  .delta { font-family: var(--mono); font-size: 12px; text-align: center; border-radius: 5px; padding: 3px 0; border: 1px solid var(--line); color: var(--muted); }
  .delta.up { color: var(--up); border-color: rgba(87,199,166,0.4); }
  .delta.down { color: var(--down); border-color: rgba(224,108,90,0.4); }
  .rung .body .txt { font-size: 13px; }
  .rung .body .sub { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-top: 2px; }
  .scorebar { display: flex; align-items: center; gap: 8px; }
  .scorebar .track { flex: 1; }
  .scorebar .track > i { background: linear-gradient(90deg, var(--signal), var(--up)); }
  .scorebar .sv { font-family: var(--mono); font-size: 11px; color: var(--muted); width: 44px; text-align: right; }

  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--panel-2); border: 1px solid var(--down); color: var(--text); font-family: var(--mono); font-size: 12px; padding: 10px 16px; border-radius: 8px; opacity: 0; transition: opacity 200ms ease; pointer-events: none; }
  .toast.show { opacity: 1; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
  <header class="top">
    <span class="wordmark">Rank<span class="smith">Smith</span></span>
    <span class="tagline">retrieval · rerank · measure</span>
    <span class="status"><span id="statusDot" class="dot"></span><span id="statusText">no corpus</span></span>
  </header>
  <main>
    <section class="col control">
      <div class="eyebrow"><span class="idx">A</span> Corpus</div>
      <label class="field"><span>Name</span>
        <input id="corpusName" type="text" value="demo-corpus" />
      </label>
      <label class="field"><span>Documents — one per line, optional "Title :: text"</span>
        <textarea id="docs">Databases :: an inverted index maps terms to postings for fast keyword search
Machine learning :: neural networks and gradient descent train deep learning models
Astronomy :: the telescope observed distant galaxies and cosmic background radiation
Cooking :: simmer the tomato sauce with garlic basil and olive oil</textarea>
      </label>
      <div class="row">
        <label class="field"><span>Chunk size (words)</span><input id="chunkSize" type="number" value="200" min="1" /></label>
        <label class="field"><span>Overlap</span><input id="overlap" type="number" value="40" min="0" /></label>
      </div>
      <button id="buildBtn" class="primary">Build corpus</button>

      <div class="eyebrow"><span class="idx">B</span> Query &amp; relevance</div>
      <label class="field"><span>Query</span>
        <input id="query" type="text" value="inverted index keyword search" />
      </label>
      <p class="hint">Check the chunks that are truly relevant — these become the qrels the metrics score against.</p>
      <button id="selectAllBtn" class="mini" disabled>Select all relevant</button>
      <div id="chunks" class="chunks"><div class="chunkrow"><span class="cid">build a corpus to load chunks</span></div></div>

      <button id="addQueryBtn" class="mini" style="margin-top:10px" disabled>+ Add query to set</button>
      <p class="hint">Add several graded queries to score a whole set at once — single-query metrics are mostly noise.</p>
      <div id="querySet" class="queryset"></div>

      <div class="eyebrow"><span class="idx">C</span> Run config</div>
      <label class="field"><span>Retrieval modes to compare</span></label>
      <div class="modes" id="modes">
        <span class="chk" role="button" tabindex="0" data-mode="bm25" aria-pressed="true">bm25</span>
        <span class="chk" role="button" tabindex="0" data-mode="dense" aria-pressed="true">dense</span>
        <span class="chk" role="button" tabindex="0" data-mode="hybrid" aria-pressed="true">hybrid</span>
      </div>
      <div class="row" style="margin-top:12px">
        <label class="field"><span>topK</span><input id="topK" type="number" value="6" min="1" /></label>
        <label class="field"><span>Rerank depth (0 = off)</span><input id="rerankDepth" type="number" value="4" min="0" /></label>
      </div>
      <div class="row">
        <label class="field"><span>BM25 k1</span><input id="k1" type="number" value="1.2" step="0.1" /></label>
        <label class="field"><span>BM25 b</span><input id="b" type="number" value="0.75" step="0.05" /></label>
        <label class="field"><span>RRF k</span><input id="rrfK" type="number" value="60" min="1" /></label>
      </div>
      <div class="row">
        <label class="field"><span>Dense model (dense &amp; hybrid)</span>
          <select id="denseModel">
            <option value="hashing-bow-v1">hashing-bow-v1 — fast baseline, no download</option>
            <option value="Xenova/all-MiniLM-L6-v2">all-MiniLM-L6-v2 — real embeddings (~90MB first run)</option>
          </select>
        </label>
      </div>
      <button id="runBtn" class="primary" disabled>Run comparison</button>
    </section>

    <section class="col results">
      <div class="eyebrow">Metrics <span class="pill" id="evalK"></span></div>
      <div id="metrics"><div class="placeholder">Build a corpus, mark relevant chunks, then run a comparison to see side-by-side metrics.</div></div>

      <div id="perQueryWrap" style="display:none">
        <div class="eyebrow">Per-query nDCG — where each mode wins and loses</div>
        <div class="tablewrap"><table class="qtable" id="perQuery"></table></div>
        <p class="hint">Best mode per query is teal; zero means the mode found nothing relevant in the top-k. Aggregate metrics hide these swings.</p>
      </div>

      <div id="ladderWrap" style="display:none">
        <div class="eyebrow">Rank ladder — retrieval &rarr; rerank movement</div>
        <div class="tabs" id="ladderTabs"></div>
        <div class="ladder" id="ladder"></div>
        <p class="hint">Rank number is the final position. The badge shows how far the chunk moved when the cross-encoder reranked; teal climbed, coral dropped. Relevant chunks are tinted.</p>
      </div>
    </section>
  </main>
  <div id="toast" class="toast"></div>

<script>
(function () {
  "use strict";
  var state = {
    corpusId: null,
    chunks: [],
    runs: {},
    activeMode: null,
    evalK: 6,
    /** Graded queries staged for this run; empty means "just use the live query box". */
    pending: [],
    /** Queries actually scored by the last run, in result order. */
    scored: [],
    activeQuery: 0
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;";
    });
  }
  function toast(msg) {
    var t = el("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  function setStatus(text, ok) {
    el("statusText").textContent = text;
    el("statusDot").className = ok ? "dot ok" : "dot";
  }

  async function api(method, path, body) {
    var opts = { method: method, headers: { "content-type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    var res = await fetch(path, opts);
    var json = await res.json();
    if (!res.ok) throw new Error(json && json.error ? json.error : "Request failed");
    return json;
  }

  function parseDocs() {
    var lines = el("docs").value.split("\\n");
    var docs = [];
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      n++;
      var title = "Doc " + n;
      var text = line;
      var sep = line.indexOf("::");
      if (sep !== -1) { title = line.slice(0, sep).trim(); text = line.slice(sep + 2).trim(); }
      docs.push({ path: "/doc-" + n + ".txt", title: title, raw: text });
    }
    return docs;
  }

  async function buildCorpus() {
    var docs = parseDocs();
    if (docs.length === 0) { toast("Add at least one document."); return; }
    el("buildBtn").disabled = true;
    try {
      var created = await api("POST", "/corpora", {
        name: el("corpusName").value || "corpus",
        documents: docs,
        preset: { chunkSize: Number(el("chunkSize").value), overlap: Number(el("overlap").value) }
      });
      state.corpusId = created.corpus.id;
      var loaded = await api("GET", "/corpora/" + state.corpusId + "/chunks");
      state.chunks = loaded.chunks;
      renderChunks();
      el("selectAllBtn").disabled = false;
      el("selectAllBtn").textContent = "Select all relevant";
      el("addQueryBtn").disabled = false;
      el("runBtn").disabled = false;
      // Chunk ids are corpus-scoped, so a rebuild invalidates any staged qrels.
      state.pending = [];
      renderQuerySet();
      setStatus(created.corpus.id + " · " + state.chunks.length + " chunks", true);
    } catch (e) {
      toast(e.message);
    } finally {
      el("buildBtn").disabled = false;
    }
  }

  function renderChunks() {
    var box = el("chunks");
    box.innerHTML = "";
    for (var i = 0; i < state.chunks.length; i++) {
      var c = state.chunks[i];
      var row = document.createElement("label");
      row.className = "chunkrow";
      var snippet = c.text.length > 90 ? c.text.slice(0, 90) + "…" : c.text;
      row.innerHTML =
        '<input type="checkbox" class="relchk" value="' + esc(c.id) + '" />' +
        '<span><span class="ct">' + esc(snippet) + '</span><br><span class="cid">' + esc(c.id) + '</span></span>';
      box.appendChild(row);
    }
  }

  function selectedModes() {
    var out = [];
    var nodes = document.querySelectorAll('#modes .chk');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("aria-pressed") === "true") out.push(nodes[i].getAttribute("data-mode"));
    }
    return out;
  }

  function relevantQrels() {
    var qrels = {};
    var checks = document.querySelectorAll(".relchk");
    for (var i = 0; i < checks.length; i++) { if (checks[i].checked) qrels[checks[i].value] = 1; }
    return qrels;
  }

  function clearRelevant() {
    var checks = document.querySelectorAll(".relchk");
    for (var i = 0; i < checks.length; i++) { checks[i].checked = false; }
    el("selectAllBtn").textContent = "Select all relevant";
  }

  function addQueryToSet() {
    var text = el("query").value.trim();
    if (!text) { toast("Enter a query first."); return; }
    var qrels = relevantQrels();
    if (Object.keys(qrels).length === 0) { toast("Check at least one relevant chunk."); return; }
    state.pending.push({ id: "q" + (state.pending.length + 1), text: text, qrels: qrels });
    el("query").value = "";
    clearRelevant();
    renderQuerySet();
  }

  function renderQuerySet() {
    var box = el("querySet");
    box.innerHTML = "";
    for (var i = 0; i < state.pending.length; i++) {
      var q = state.pending[i];
      var n = Object.keys(q.qrels).length;
      var row = document.createElement("div");
      row.className = "qrow";
      row.innerHTML =
        '<span class="qn">' + esc(q.id) + '</span>' +
        '<span class="qt">' + esc(q.text) + '</span>' +
        '<span class="qn">' + n + ' rel</span>' +
        '<button class="qx" type="button" aria-label="Remove query">×</button>';
      (function (idx) {
        row.querySelector(".qx").addEventListener("click", function () {
          state.pending.splice(idx, 1);
          renderQuerySet();
        });
      })(i);
      box.appendChild(row);
    }
    var n = state.pending.length;
    el("runBtn").textContent = n > 0
      ? "Run comparison · " + n + (n === 1 ? " query" : " queries")
      : "Run comparison";
  }

  /**
   * Queries for this run: the staged set if the user built one, otherwise the
   * single live query box. Persists a real query set server-side so the run is
   * reproducible and the set can be reused.
   */
  async function resolveRunQueries() {
    if (state.pending.length === 0) {
      var text = el("query").value.trim();
      if (!text) throw new Error("Enter a query, or add queries to a set.");
      var qrels = relevantQrels();
      if (Object.keys(qrels).length === 0) throw new Error("Check at least one relevant chunk.");
      return { queries: [{ id: "q1", text: text, qrels: qrels }], querySetId: null };
    }
    var created = await api("POST", "/query-sets", {
      name: el("corpusName").value + " · " + state.pending.length + " queries",
      corpusId: state.corpusId,
      queries: state.pending
    });
    return { queries: state.pending.slice(), querySetId: created.id };
  }

  function buildConfig(mode) {
    var rerankDepth = Number(el("rerankDepth").value);
    return {
      id: "cfg-" + mode,
      retrievalMode: mode,
      bm25: { k1: Number(el("k1").value), b: Number(el("b").value) },
      dense: { modelName: el("denseModel").value },
      hybrid: { fusionType: "rrf", sparseWeight: 0.5, denseWeight: 0.5, rrfK: Number(el("rrfK").value) },
      topK: Number(el("topK").value),
      rerankDepth: rerankDepth,
      crossEncoderModel: rerankDepth > 0 ? "Xenova/ms-marco-MiniLM-L-6-v2" : null
    };
  }

  async function runComparison() {
    if (!state.corpusId) { toast("Build a corpus first."); return; }
    var modes = selectedModes();
    if (modes.length === 0) { toast("Select at least one mode."); return; }

    el("runBtn").disabled = true;
    var priorLabel = el("runBtn").textContent;
    el("runBtn").textContent = "Running…";
    state.runs = {};
    state.evalK = Number(el("topK").value);
    try {
      var resolved = await resolveRunQueries();
      state.scored = resolved.queries;
      state.activeQuery = 0;
      for (var i = 0; i < modes.length; i++) {
        var mode = modes[i];
        var request = {
          config: buildConfig(mode),
          corpusId: state.corpusId,
          evalK: state.evalK
        };
        // Prefer the persisted set so every mode scores the identical queries.
        if (resolved.querySetId) request.querySetId = resolved.querySetId;
        else request.queries = resolved.queries;
        var run = await api("POST", "/runs", request);
        var results = await api("GET", "/runs/" + run.run.id + "/results");
        state.runs[mode] = { metrics: run.metrics, perQuery: results.results || [] };
      }
      state.activeMode = modes[0];
      renderMetrics(modes);
      renderPerQuery(modes);
      renderLadderTabs(modes);
      renderLadder(state.activeMode);
    } catch (e) {
      toast(e.message);
    } finally {
      el("runBtn").disabled = false;
      el("runBtn").textContent = priorLabel;
    }
  }

  function qrelsFor(idx) {
    return state.scored[idx] ? state.scored[idx].qrels : {};
  }

  /** nDCG for one mode on one query, or null when that query wasn't scored. */
  function ndcgFor(mode, idx) {
    var pq = state.runs[mode].perQuery[idx];
    return pq && pq.metrics ? pq.metrics.ndcg : null;
  }

  function renderPerQuery(modes) {
    if (state.scored.length === 0) { el("perQueryWrap").style.display = "none"; return; }
    var head = '<tr><th>Query</th>';
    for (var m = 0; m < modes.length; m++) head += '<th style="text-align:right">' + esc(modes[m]) + '</th>';
    head += '</tr>';

    var body = "";
    for (var i = 0; i < state.scored.length; i++) {
      // Best score this row, so the winning mode can be highlighted.
      var best = -1;
      for (var b = 0; b < modes.length; b++) {
        var v = ndcgFor(modes[b], i);
        if (v !== null && v > best) best = v;
      }
      var cells = "";
      for (var c = 0; c < modes.length; c++) {
        var val = ndcgFor(modes[c], i);
        var cls = "num";
        if (val === null) { cells += '<td class="num">—</td>'; continue; }
        if (val === 0) cls += " zero";
        else if (val === best && modes.length > 1) cls += " best";
        cells += '<td class="' + cls + '">' + val.toFixed(3) + '</td>';
      }
      var qtext = state.scored[i].text;
      var short = qtext.length > 54 ? qtext.slice(0, 54) + "…" : qtext;
      var sel = i === state.activeQuery ? ' style="background:rgba(232,184,75,0.06)"' : "";
      body += '<tr class="qpick" data-idx="' + i + '"' + sel + ' tabindex="0">' +
        '<td class="qtext">' + esc(short) + '</td>' + cells + '</tr>';
    }
    el("perQuery").innerHTML = head + body;

    // Clicking a row drives which query the rank ladder below shows.
    var rows = document.querySelectorAll(".qpick");
    for (var r = 0; r < rows.length; r++) {
      (function (node) {
        function pick() {
          state.activeQuery = Number(node.getAttribute("data-idx"));
          renderPerQuery(modes);
          renderLadder(state.activeMode);
        }
        node.addEventListener("click", pick);
        node.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
      })(rows[r]);
    }
    el("perQueryWrap").style.display = "block";
  }

  function meter(label, value) {
    var pct = Math.max(0, Math.min(1, value)) * 100;
    return '<div class="meter"><div class="mlabel"><span>' + label + '</span><b>' + value.toFixed(3) + '</b></div>' +
      '<div class="track"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>';
  }

  function renderMetrics(modes) {
    el("evalK").textContent = "@" + state.evalK;
    var cards = "";
    for (var i = 0; i < modes.length; i++) {
      var m = state.runs[modes[i]].metrics;
      cards +=
        '<div class="metric-card"><h3><span class="mode-tag">' + esc(modes[i]) + '</span></h3>' +
        meter("nDCG", m.meanNdcg) +
        meter("MRR", m.mrr) +
        meter("Recall", m.meanRecall) +
        meter("Precision", m.meanPrecision) +
        '<div class="lat">p50 ' + m.latencyP50Ms.toFixed(2) + 'ms · p95 ' + m.latencyP95Ms.toFixed(2) + 'ms</div></div>';
    }
    el("metrics").innerHTML = '<div class="cards">' + cards + '</div>';
  }

  function renderLadderTabs(modes) {
    var tabs = el("ladderTabs");
    tabs.innerHTML = "";
    for (var i = 0; i < modes.length; i++) {
      var t = document.createElement("span");
      t.className = "tab";
      t.setAttribute("role", "tab");
      t.setAttribute("tabindex", "0");
      t.textContent = modes[i];
      t.setAttribute("aria-selected", modes[i] === state.activeMode ? "true" : "false");
      (function (mode, node) {
        function pick() { state.activeMode = mode; renderLadderTabs(modes); renderLadder(mode); }
        node.addEventListener("click", pick);
        node.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      })(modes[i], t);
      tabs.appendChild(t);
    }
    el("ladderWrap").style.display = "block";
  }

  function textForChunk(id) {
    for (var i = 0; i < state.chunks.length; i++) { if (state.chunks[i].id === id) return state.chunks[i].text; }
    return id;
  }

  function renderLadder(mode) {
    var run = state.runs[mode];
    var pq = run.perQuery[state.activeQuery];
    var cands = pq ? pq.candidates : [];
    var qrels = qrelsFor(state.activeQuery);
    var maxScore = 0;
    for (var i = 0; i < cands.length; i++) {
      var s = scoreOf(cands[i]);
      if (s > maxScore) maxScore = s;
    }
    var rows = "";
    for (var j = 0; j < cands.length; j++) {
      var c = cands[j];
      var moved = c.retrievalRank - c.rank;
      var deltaClass = moved > 0 ? "up" : moved < 0 ? "down" : "";
      var deltaText = moved > 0 ? "▲ " + moved : moved < 0 ? "▼ " + Math.abs(moved) : "—";
      var isRel = qrels[c.chunkId] ? " relevant" : "";
      var sc = scoreOf(c);
      var pct = maxScore > 0 ? (sc / maxScore) * 100 : 0;
      var full = textForChunk(c.chunkId);
      var snippet = full.length > 96 ? full.slice(0, 96) + "…" : full;
      rows +=
        '<div class="rung' + isRel + '">' +
        '<div class="rank">' + c.rank + '</div>' +
        '<div class="delta ' + deltaClass + '">' + deltaText + '</div>' +
        '<div class="body"><div class="txt">' + esc(snippet) + '</div>' +
        '<div class="sub">' + esc(c.chunkId) + (c.rerankScore !== null ? ' · reranked' : '') + '</div></div>' +
        '<div class="scorebar"><div class="track"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<span class="sv">' + sc.toFixed(3) + '</span></div>' +
        '</div>';
    }
    el("ladder").innerHTML = rows || '<div class="rung"><span class="cid">no candidates</span></div>';
  }

  function scoreOf(c) {
    if (c.rerankScore !== null && c.rerankScore !== undefined) return c.rerankScore;
    if (c.hybridScore !== null && c.hybridScore !== undefined) return c.hybridScore;
    if (c.denseScore !== null && c.denseScore !== undefined) return c.denseScore;
    if (c.sparseScore !== null && c.sparseScore !== undefined) return c.sparseScore;
    return 0;
  }

  // Mode toggles
  var modeNodes = document.querySelectorAll('#modes .chk');
  for (var i = 0; i < modeNodes.length; i++) {
    (function (node) {
      function toggle() { node.setAttribute("aria-pressed", node.getAttribute("aria-pressed") === "true" ? "false" : "true"); }
      node.addEventListener("click", toggle);
      node.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    })(modeNodes[i]);
  }

  function toggleAllRelevant() {
    var checks = document.querySelectorAll(".relchk");
    if (checks.length === 0) return;
    var allChecked = true;
    for (var i = 0; i < checks.length; i++) { if (!checks[i].checked) { allChecked = false; break; } }
    var next = !allChecked;
    for (var j = 0; j < checks.length; j++) { checks[j].checked = next; }
    el("selectAllBtn").textContent = next ? "Clear all" : "Select all relevant";
  }

  el("buildBtn").addEventListener("click", buildCorpus);
  el("selectAllBtn").addEventListener("click", toggleAllRelevant);
  el("addQueryBtn").addEventListener("click", addQueryToSet);
  el("runBtn").addEventListener("click", runComparison);
})();
</script>
</body>
</html>`;
