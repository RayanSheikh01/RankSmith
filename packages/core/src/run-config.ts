import type { RunConfigRecord } from "./models.js";

export interface RunConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRunConfig(config: RunConfigRecord): RunConfigValidationResult {
  const errors: string[] = [];

  if (config.topK < 1) {
    errors.push("topK must be greater than 0.");
  }

  if (config.rerankDepth < 0) {
    errors.push("rerankDepth cannot be negative.");
  }

  if (config.rerankDepth > config.topK) {
    errors.push("rerankDepth cannot exceed topK.");
  }

  if (config.bm25.k1 <= 0) {
    errors.push("bm25.k1 must be positive.");
  }

  if (config.bm25.b < 0 || config.bm25.b > 1) {
    errors.push("bm25.b must be in the [0, 1] interval.");
  }

  if (config.hybrid.fusionType === "weighted") {
    const sum = config.hybrid.sparseWeight + config.hybrid.denseWeight;
    if (Math.abs(sum - 1) > 1e-6) {
      errors.push("weighted fusion requires sparseWeight + denseWeight = 1.");
    }
  }

  if (config.hybrid.fusionType === "rrf" && config.hybrid.rrfK < 1) {
    errors.push("rrf fusion requires hybrid.rrfK >= 1.");
  }

  if (config.retrievalMode === "dense" && config.dense.modelName.trim().length === 0) {
    errors.push("dense retrieval requires a non-empty dense.modelName.");
  }

  if (config.rerankDepth > 0 && (!config.crossEncoderModel || config.crossEncoderModel.trim().length === 0)) {
    errors.push("rerankDepth > 0 requires crossEncoderModel.");
  }

  return { valid: errors.length === 0, errors };
}
