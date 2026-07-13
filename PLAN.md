# RankSmith Architecture Plan

RankSmith is a retrieval-reranking playground to compare BM25, dense, hybrid, and cross-encoder reranking on your own documents with side-by-side metrics.

## 1) Target Architecture

Use a modular monolith initially (single deploy) with clear module boundaries so components can be split later.

### Core Modules

1. **Ingestion & Chunking**
   - Accept local files/folders (PDF, MD, TXT; DOCX optional later)
   - Normalize text, chunk with metadata, version corpus snapshots

2. **Indexing Layer**
   - Sparse index for BM25
   - Dense index for embeddings
   - Shared chunk IDs across sparse/dense/hybrid/rerank paths

3. **Retrieval Engine**
   - BM25 retriever
   - Dense retriever
   - Hybrid retriever (weighted fusion and/or RRF)

4. **Reranking Engine**
   - Cross-encoder reranker over top-K retrieved candidates
   - Configurable rerank depth per run

5. **Evaluation & Metrics**
   - Query sets + optional qrels
   - Recall@k, Precision@k, MRR, nDCG, latency breakdown
   - Side-by-side comparisons across methods/configs

6. **Experiment Orchestrator**
   - Reproducible run configs
   - Run IDs and model/version tracking

7. **API + UI**
   - API for corpus management, runs, results
   - UI for side-by-side retrieval/reranking comparisons and metrics

## 2) Proposed Directory Structure

```text
ranksmith/
  apps/
    api/                      # Backend API + orchestration endpoints
    web/                      # Playground UI (comparison + metrics views)

  packages/
    core/                     # Shared domain models, config schemas
    ingestion/                # Parsers, normalization, chunking
    indexing/
      sparse/                 # BM25 index build/search
      dense/                  # Embeddings + vector index
    retrieval/                # BM25, dense, hybrid strategies
    reranking/                # Cross-encoder scoring and ordering
    evaluation/               # Metrics + run comparison
    storage/                  # DB repositories, filesystem artifacts
    observability/            # Logging, tracing, timing utilities

  data/
    corpora/                  # Imported source docs (or refs)
    chunks/                   # Processed chunk artifacts
    indexes/                  # Sparse + dense index artifacts
    runs/                     # Run outputs, per-query traces

  configs/
    models/                   # Embedding/reranker configs
    chunking/                 # Chunk size/overlap/tokenizer presets
    experiments/              # Saved experiment templates

  tests/
    unit/
    integration/
    e2e/

  docs/
    architecture/
    metrics/
```

## 3) Core Data Models

1. **Corpus**
   - `id`, `name`, `version`, `created_at`

2. **SourceDocument**
   - `id`, `corpus_id`, `path`, `title`, `checksum`, `metadata`

3. **Chunk**
   - `id`, `doc_id`, `corpus_version`, `text`, `token_count`, `chunk_order`, `metadata`

4. **IndexSnapshot**
   - `id`, `corpus_version`, `index_type` (sparse/dense), `model_name` (dense), `built_at`

5. **QuerySet**
   - `id`, `name`, `corpus_version`, `created_at`

6. **Query**
   - `id`, `query_set_id`, `text`, `metadata`

7. **RelevanceJudgment (Qrel)**
   - `query_id`, `chunk_id` (or `doc_id`), `relevance_grade`

8. **RunConfig**
   - `id`, retrieval mode, BM25 params, dense model, hybrid weights, topK, rerank depth, cross-encoder model

9. **ExperimentRun**
   - `id`, `run_config_id`, `query_set_id`, `status`, `started_at`, `finished_at`, `seed`, `commit_hash`

10. **QueryRunResult**
    - `run_id`, `query_id`, ranked results, scores by stage, per-stage latency

11. **RunMetrics**
    - Aggregate metrics (`MRR`, `nDCG@k`, `Recall@k`, `P@k`) and latency (`p50`, `p95`)

## 4) Build Order

### Phase 0 — Foundations
- Finalize stack and storage choices
- Define config schema + shared core models
- Add structured logging and run IDs

### Phase 1 — Ingestion + Corpus Versioning
- File import pipeline
- Chunking presets
- Corpus snapshots and checksum-based change detection

### Phase 2 — Retrieval Baselines
- BM25 indexing/search
- Dense embedding/index/search
- Unified retriever response contract

### Phase 3 — Hybrid Retrieval
- Add RRF or weighted score fusion
- Normalize score scales and expose fusion params

### Phase 4 — Cross-Encoder Reranking
- Rerank top-K from each retriever
- Capture pre/post-rerank quality + latency effects

### Phase 5 — Evaluation Engine
- Query sets and qrels ingestion
- Metric computation and run-comparison APIs

### Phase 6 — Playground UI
- Side-by-side run setup
- Per-query result inspection
- Aggregate metric dashboard and latency charts

### Phase 7 — Reliability + Reproducibility
- Persist run artifacts and model/index snapshot IDs
- Integration + e2e test coverage
- Profile performance on larger corpora

## 5) Key Risks and Mitigations

1. **Score incompatibility in hybrid**
   - Mitigation: start with rank-based fusion (RRF), keep weighted fusion optional.

2. **Cross-encoder latency/cost**
   - Mitigation: rerank only top-N, async execution, cache query-candidate scores.

3. **Evaluation quality risk (weak qrels)**
   - Mitigation: bootstrap small gold labels, support graded relevance and query tagging.

4. **Non-reproducible experiments**
   - Mitigation: persist run config, corpus/index snapshot IDs, model versions, commit hash.

5. **Index drift after corpus updates**
   - Mitigation: strict corpus versioning; invalidate stale index snapshots automatically.

6. **Chunking sensitivity**
   - Mitigation: treat chunking presets as first-class experiment parameters.

7. **Local hardware limits**
   - Mitigation: lightweight default models, batch controls, optional CPU/GPU profiles.
