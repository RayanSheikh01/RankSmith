const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
  "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were",
  "will", "with",
]);

/**
 * Lexical tokenizer for sparse retrieval: lowercase, split on non-alphanumerics,
 * drop stopwords and single characters. Deterministic and language-light.
 */
export function tokenize(text: string, dropStopwords = true): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  return dropStopwords ? tokens.filter((t) => !STOPWORDS.has(t)) : tokens;
}
