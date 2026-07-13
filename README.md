# RankSmith

RankSmith is a retrieval-reranking playground to compare **BM25**, **dense**, **hybrid**, and **cross-encoder reranking** on your own documents, with side-by-side metrics.

Import a corpus, run retrieval configs against a query set, and inspect per-query rankings and aggregate quality/latency metrics — all reproducibly.

## Features

- **Ingestion & chunking** — import documents, normalize text, chunk with metadata, version corpus snapshots.
- **Retrieval baselines** — BM25 (sparse), dense embeddings, and hybrid fusion (RRF / weighted).
- **Cross-encoder reranking** — rerank the top-K candidates with configurable depth.
- **Evaluation** — Recall@k, Precision@k, MRR, nDCG, plus per-stage latency; compare runs side by side.
- **Reproducible runs** — each run persists its config, corpus/index snapshot, and results.
- **Playground UI** — served at the API root for setting up and comparing runs.

## Repository layout

Modular monolith organized as npm workspaces:

```text
apps/
  api/                  # HTTP API + orchestration; serves the playground UI at /
  web/                  # Playground UI (comparison + metrics views)
packages/
  core/                 # Shared domain models, config schemas
  ingestion/            # Parsers, normalization, chunking
  indexing/sparse/      # BM25 index build/search
  indexing/dense/       # Embeddings + vector index
  retrieval/            # BM25, dense, hybrid strategies
  reranking/            # Cross-encoder scoring and ordering
  evaluation/           # Metrics + run comparison
  storage/              # Repositories, filesystem artifacts
  observability/        # Logging, tracing, timing
data/                   # corpora / chunks / indexes / runs artifacts
configs/                # models / chunking / experiments presets
docs/                   # architecture / metrics
tests/                  # unit / integration / e2e
```

## Getting started

Requires Node.js (with npm workspaces support).

```bash
npm install
npm run build        # build all workspaces
npm run typecheck    # type-check all workspaces
npm test             # run workspace tests
```

### Run the API + playground

```bash
npm run build --workspace @ranksmith/api
npm start --workspace @ranksmith/api
```

Then open http://localhost:3000 for the playground UI.

- `PORT` — server port (default `3000`)
- `DATA_DIR` — artifact directory (default `data`)

## API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/` | Playground UI |
| `GET`  | `/health` | Health check |
| `POST` | `/corpora` | Create a corpus (`name`, `documents`, optional `preset`) |
| `GET`  | `/corpora` | List corpora |
| `GET`  | `/corpora/:id` | Corpus details + chunk count |
| `GET`  | `/corpora/:id/chunks` | List corpus chunks |
| `POST` | `/runs` | Create a run (`config`, `corpusId`, `queries`) |
| `GET`  | `/runs` | List runs |
| `GET`  | `/runs/:id` | Run details + metrics |
| `GET`  | `/runs/:id/results` | Per-query results |

## Status

Early development (`v0.1.0`). APIs and schemas may change.
