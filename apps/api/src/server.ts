import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { ChunkingPreset } from "@ranksmith/ingestion";
import { Logger } from "@ranksmith/observability";
import { playgroundHtml } from "@ranksmith/web";
import { RankSmithStore, type CreateRunRequest, type DocumentInput } from "./store.js";

const DEFAULT_PRESET: ChunkingPreset = { chunkSize: 200, overlap: 40 };

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw.length === 0) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, "Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body);
}

export interface ServerOptions {
  store?: RankSmithStore;
  logger?: Logger;
}

/**
 * Route a single request against the store. Exposed separately from the HTTP
 * server so it can be unit-tested and reused behind other transports.
 */
export interface RouteResult {
  status: number;
  payload: unknown;
  /** Defaults to application/json; set to "text/html" to serve the payload as-is. */
  contentType?: "application/json" | "text/html";
}

export async function handleRequest(
  store: RankSmithStore,
  method: string,
  path: string,
  body: unknown,
): Promise<RouteResult> {
  const segments = path.split("/").filter(Boolean);

  // Playground UI at the root; JSON health check moved to /health.
  if (method === "GET" && segments.length === 0) {
    return { status: 200, payload: playgroundHtml, contentType: "text/html" };
  }
  if (method === "GET" && segments.length === 1 && segments[0] === "health") {
    return { status: 200, payload: { service: "ranksmith-api", ok: true } };
  }

  // /corpora
  if (segments[0] === "corpora") {
    if (method === "POST" && segments.length === 1) {
      const b = (body ?? {}) as { name?: string; documents?: DocumentInput[]; preset?: ChunkingPreset };
      if (!b.name || !Array.isArray(b.documents) || b.documents.length === 0) {
        throw new HttpError(400, "Body requires 'name' and a non-empty 'documents' array.");
      }
      const record = await store.createCorpus(b.name, b.documents, b.preset ?? DEFAULT_PRESET);
      return { status: 201, payload: { corpus: record.corpus, chunkCount: record.chunks.length } };
    }
    if (method === "GET" && segments.length === 1) {
      return { status: 200, payload: { corpora: await store.listCorpora() } };
    }
    if (method === "GET" && segments.length === 2) {
      const record = await store.getCorpus(segments[1]);
      if (!record) throw new HttpError(404, `Unknown corpus: ${segments[1]}`);
      return { status: 200, payload: { corpus: record.corpus, chunkCount: record.chunks.length } };
    }
    if (method === "GET" && segments.length === 3 && segments[2] === "chunks") {
      const record = await store.getCorpus(segments[1]);
      if (!record) throw new HttpError(404, `Unknown corpus: ${segments[1]}`);
      const chunks = record.chunks.map((c) => ({
        id: c.id,
        docId: c.docId,
        chunkOrder: c.chunkOrder,
        text: c.text,
      }));
      return { status: 200, payload: { chunks } };
    }
  }

  // /query-sets
  if (segments[0] === "query-sets") {
    if (method === "POST" && segments.length === 1) {
      const b = (body ?? {}) as { name?: string; corpusId?: string; queries?: CreateRunRequest["queries"] };
      if (!b.name || !b.corpusId || !Array.isArray(b.queries) || b.queries.length === 0) {
        throw new HttpError(400, "Body requires 'name', 'corpusId', and a non-empty 'queries' array.");
      }
      const record = await store.createQuerySet(b.name, b.corpusId, b.queries);
      return { status: 201, payload: record };
    }
    if (method === "GET" && segments.length === 1) {
      return { status: 200, payload: { querySets: await store.listQuerySets() } };
    }
    if (method === "GET" && segments.length === 2) {
      const record = await store.getQuerySet(segments[1]);
      if (!record) throw new HttpError(404, `Unknown query set: ${segments[1]}`);
      return { status: 200, payload: record };
    }
  }

  // /runs
  if (segments[0] === "runs") {
    if (method === "POST" && segments.length === 1) {
      const b = (body ?? {}) as Partial<CreateRunRequest>;
      if (!b.config || !b.corpusId || !Array.isArray(b.queries) || ) {
        throw new HttpError(400, "Body requires 'config', 'corpusId', 'querySetId', and a 'queries' array.");
      }
      try {
        const output = await store.createRun(b as CreateRunRequest);
        return { status: 201, payload: { run: output.run, metrics: output.metrics } };
      } catch (err) {
        throw new HttpError(400, (err as Error).message);
      }
    }
    if (method === "GET" && segments.length === 1) {
      return { status: 200, payload: { runs: await store.listRuns() } };
    } 
    if (method === "GET" && segments.length === 2) {
      const output = await store.getRun(segments[1]);
      if (!output) throw new HttpError(404, `Unknown run: ${segments[1]}`);
      return { status: 200, payload: { run: output.run, metrics: output.metrics } };
    }
    if (method === "GET" && segments.length === 3 && segments[2] === "results") {
      const output = await store.getRun(segments[1]);
      if (!output) throw new HttpError(404, `Unknown run: ${segments[1]}`);
      return { status: 200, payload: { results: output.perQuery } };
    }
  }

  throw new HttpError(404, `No route for ${method} /${segments.join("/")}`);
}

/** Build the RankSmith HTTP server. Call `.listen(port)` to start it. */
export function createServer(options: ServerOptions = {}): Server {
  const store = options.store ?? new RankSmithStore();
  const logger = options.logger ?? new Logger({ context: { component: "api" } });

  return createHttpServer((req, res) => {
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];
    void (async () => {
      try {
        const body = method === "POST" ? await readJsonBody(req) : undefined;
        const { status, payload, contentType } = await handleRequest(store, method, path, body);
        logger.info("request", { method, path, status });
        if (contentType === "text/html") {
          res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
          res.end(String(payload));
        } else {
          sendJson(res, status, payload);
        }
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 500;
        logger.warn("request failed", { method, path, status, error: (err as Error).message });
        sendJson(res, status, { error: (err as Error).message });
      }
    })();
  });
}
