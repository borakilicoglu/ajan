#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getAppConfig } from "./config";
import { closeDbPool, createDbPool } from "./db/pool";
import { createAjanServer } from "./server";

async function main(): Promise<void> {
  const config = getAppConfig();
  const pool = createDbPool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
  });

  const server = createAjanServer({ pool });
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    await closeDbPool(pool);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ajan] ${message}`);
  process.exit(1);
});
