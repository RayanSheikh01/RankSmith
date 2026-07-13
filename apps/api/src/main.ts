import { createServer } from "./server.js";
import { RankSmithStore, fileRepositories } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.RANKSMITH_DATA ?? "data";

// Persist corpora and run artifacts to disk so runs survive restarts.
const store = new RankSmithStore(fileRepositories(dataDir));

createServer({ store }).listen(port, () => {
  process.stdout.write(`ranksmith-api listening on http://localhost:${port} (data: ${dataDir})\n`);
});
