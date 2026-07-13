import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryRepository } from "./repository.js";
import { FileRepository } from "./file-repository.js";

interface Doc {
  id: string;
  value: number;
}

test("InMemoryRepository round-trips values", async () => {
  const repo = new InMemoryRepository<Doc>();
  assert.equal(await repo.has("a"), false);
  await repo.save("a", { id: "a", value: 1 });
  assert.deepEqual(await repo.get("a"), { id: "a", value: 1 });
  assert.equal(await repo.has("a"), true);
  await repo.save("b", { id: "b", value: 2 });
  assert.equal((await repo.list()).length, 2);
});

test("FileRepository persists to disk and reloads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ranksmith-store-"));
  try {
    const repo = new FileRepository<Doc>(dir);
    assert.equal(await repo.get("missing"), undefined);
    assert.deepEqual(await repo.list(), []);

    await repo.save("run_1", { id: "run_1", value: 42 });

    // A fresh repository over the same dir must see the persisted record.
    const reopened = new FileRepository<Doc>(dir);
    assert.deepEqual(await reopened.get("run_1"), { id: "run_1", value: 42 });
    assert.equal((await reopened.list()).length, 1);
    assert.equal(await reopened.has("run_1"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileRepository sanitizes ids and rejects empty ones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ranksmith-store-"));
  try {
    const repo = new FileRepository<Doc>(dir);
    await repo.save("../evil/../id", { id: "x", value: 1 });
    // Sanitized id still retrievable by the same key.
    assert.deepEqual(await repo.get("../evil/../id"), { id: "x", value: 1 });
    await assert.rejects(repo.save("!!!", { id: "x", value: 1 }), /Invalid record id/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
