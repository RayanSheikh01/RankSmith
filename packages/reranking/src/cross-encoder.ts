import { tokenize } from "@ranksmith/retrieval";

/**
 * Scores a (query, document) pair jointly. Real cross-encoders run a
 * transformer over the concatenated pair; swap this interface's implementation
 * for one without changing the reranker.
 */
export interface CrossEncoder {
  readonly modelName: string;
  score(query: string, document: string): Promise<number>;
  scoreBatch(query: string, documents: string[]): Promise<number[]>;
}

/**
 * Dependency-free stand-in cross-encoder. Scores a pair by token-overlap
 * relevance: coverage of query terms present in the document, damped by the
 * document length so long documents do not win by dilution. Deterministic;
 * a local placeholder for a learned reranker.
 */
export class LexicalCrossEncoder implements CrossEncoder {
  readonly modelName: string;

  constructor(modelName = "lexical-overlap-v1") {
    this.modelName = modelName;
  }

  async score(query: string, document: string): Promise<number> {
    const queryTerms = new Set(tokenize(query));
    if (queryTerms.size === 0) return 0;

    const docTerms = tokenize(document);
    if (docTerms.length === 0) return 0;

    const docCounts = new Map<string, number>();
    for (const t of docTerms) docCounts.set(t, (docCounts.get(t) ?? 0) + 1);

    let matched = 0;
    let hits = 0;
    for (const term of queryTerms) {
      const c = docCounts.get(term);
      if (c) {
        matched += 1;
        hits += c;
      }
    }

    const coverage = matched / queryTerms.size;
    const density = hits / docTerms.length;
    // Blend coverage (did we hit the query terms) with density (how concentrated).
    return 0.7 * coverage + 0.3 * density;
  }

  async scoreBatch(query: string, documents: string[]): Promise<number[]> {
    return Promise.all(documents.map((d) => this.score(query, d)));
  }
}
