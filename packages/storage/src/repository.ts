/**
 * Minimal async key-value repository over JSON-serializable records. Backends
 * (in-memory, filesystem) are interchangeable so the API can run ephemerally in
 * tests and persist artifacts in production without code changes.
 */
export interface Repository<T> {
  save(id: string, value: T): Promise<void>;
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  has(id: string): Promise<boolean>;
}

/** In-memory repository. State lives for the process lifetime only. */
export class InMemoryRepository<T> implements Repository<T> {
  private readonly items = new Map<string, T>();

  async save(id: string, value: T): Promise<void> {
    this.items.set(id, value);
  }

  async get(id: string): Promise<T | undefined> {
    return this.items.get(id);
  }

  async list(): Promise<T[]> {
    return [...this.items.values()];
  }

  async has(id: string): Promise<boolean> {
    return this.items.has(id);
  }
}
