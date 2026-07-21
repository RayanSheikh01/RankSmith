import { createHash } from "node:crypto";
import type { RunConfigRecord } from "./models.js";

export interface FingerprintInput {
  config: RunConfigRecord;
  corpusChecksum: string;
  querySetId: string;
  evalK: number;
}

/**
 * Stable identity for "what this run was of". Two runs sharing a fingerprint had
 * identical inputs, so any metric difference between them is a real change and
 * not config drift.
 *
 * Deliberately excluded: `config.id` (two identical configs saved separately must
 * still match) and `commitHash` (same inputs on different code is exactly the
 * comparison you want to be able to see).
 *
 * The field list is written out longhand rather than JSON.stringify'd: stringify
 * hashes keys in object-literal insertion order, so reordering a field during an
 * unrelated refactor would silently change every fingerprint ever computed.
 * Spelling them out also breaks the build when a config field is added, which is
 * the moment to decide whether it belongs in the identity.
 */
export function runFingerprint(input: FingerprintInput): string {
  const { config, corpusChecksum, querySetId, evalK } = input;
  const fields: (string | number)[] = [
    config.retrievalMode,
    config.topK,
    config.rerankDepth,
    config.crossEncoderModel ?? "",
    config.bm25.k1,
    config.bm25.b,
    config.dense.modelName,
    config.hybrid.fusionType,
    config.hybrid.sparseWeight,
    config.hybrid.denseWeight,
    config.hybrid.rrfK,
    corpusChecksum,
    querySetId,
    evalK,
  ];
  // Length-prefixed rather than separator-joined: a model name containing the
  // separator could otherwise shift a value across a field boundary and collide
  // with a different config. Prefixing makes the encoding unambiguous for any
  // field content.
  const encoded = fields.map((f) => `${String(f).length}:${f}`).join("");
  return createHash("sha256").update(encoded).digest("hex");
}
