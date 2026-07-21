import { execFileSync } from "node:child_process";

function git(...args: string[]): string {
  // execFileSync, not execSync: no shell is spawned, so nothing here can be
  // shell-interpreted. Capture stdout and discard stderr so a non-repo
  // directory doesn't print "not a git repository" noise on every run.
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/**
 * Short HEAD sha, suffixed `-dirty` when the working tree has uncommitted
 * changes. Returns "" outside a git repo or when git isn't installed.
 *
 * The dirty marker is the point: a clean hash recorded against a modified tree
 * is a false reproducibility claim, which is worse than recording nothing.
 */
export function gitCommit(): string {
  try {
    const commit = git("rev-parse", "--short", "HEAD");
    // --porcelain covers staged, unstaged, and untracked changes; `git diff
    // --quiet` would miss the latter two.
    const dirty = git("status", "--porcelain") !== "";
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return "";
  }
}
