import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);

createServer().listen(port, () => {
  process.stdout.write(`ranksmith-api listening on http://localhost:${port}\n`);
});
