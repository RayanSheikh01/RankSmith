import { execSync } from "child_process";

// Returns e.g. "a1b2c3d" or "a1b2c3d-dirty", or "" outside a git repo.
export function gitCommit(): string {
  try {
    const { stdout } = execSync("git rev-parse --short HEAD", { encoding: "utf-8" });
    const commit = stdout.trim();
    const dirty = execSync("git diff --quiet || echo -dirty", { encoding: "utf-8" }).trim();
    return commit + dirty;
  } catch (err) {
    return "";
  }
};