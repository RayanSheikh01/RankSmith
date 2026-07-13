import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Repository } from "./repository.js";

/**
 * Filesystem repository persisting each record as `<baseDir>/<id>.json`.
 * Durable across process restarts, giving reproducible run artifacts. IDs are
 * sanitized so they cannot escape the base directory.
 */
export class FileRepository<T> implements Repository<T> {
  constructor(private readonly baseDir: string) {}

  private safeName(id: string): string {
    const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!/[a-zA-Z0-9]/.test(cleaned)) throw new Error("Invalid record id.");
    return `${cleaned}.json`;
  }

  private pathFor(id: string): string {
    return join(this.baseDir, this.safeName(id));
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  async save(id: string, value: T): Promise<void> {
    await this.ensureDir();
    await writeFile(this.pathFor(id), JSON.stringify(value, null, 2), "utf8");
  }

  async get(id: string): Promise<T | undefined> {
    try {
      const raw = await readFile(this.pathFor(id), "utf8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw err;
    }
  }

  async list(): Promise<T[]> {
    let names: string[];
    try {
      names = await readdir(this.baseDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const jsonFiles = names.filter((n) => n.endsWith(".json"));
    const records = await Promise.all(
      jsonFiles.map(async (name) => {
        const raw = await readFile(join(this.baseDir, name), "utf8");
        return JSON.parse(raw) as T;
      }),
    );
    return records;
  }

  async has(id: string): Promise<boolean> {
    return (await this.get(id)) !== undefined;
  }
}
