#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getAppConfig } from "./config";
import { closeDbPool, createDbPool } from "./db/pool";
import { closeMysqlPool, createMysqlPool } from "./db/mysql-pool";
import { closeSqliteDatabase, createSqliteDatabase } from "./db/sqlite-db";
import { createMysqlDialect } from "./dialects/mysql";
import { createPostgresDialect } from "./dialects/postgres";
import { createSqliteDialect } from "./dialects/sqlite";
import { createAjanServer } from "./server";

async function main(): Promise<void> {
  const config = getAppConfig();
  const transport = new StdioServerTransport();
  let shutdown: (() => Promise<void>) | null = null;
  let server;

  if (config.databaseDialect === "mysql") {
    const pool = createMysqlPool({
      uri: config.databaseUrl,
      connectionLimit: config.dbPoolMax,
    });
    const dialect = createMysqlDialect(pool);
    server = createAjanServer({ dialect });
    shutdown = async () => {
      await closeMysqlPool(pool);
      process.exit(0);
    };
  } else if (config.databaseDialect === "sqlite") {
    const database = createSqliteDatabase({
      filename: config.databaseUrl,
    });
    const dialect = createSqliteDialect(database);
    server = createAjanServer({ dialect });
    shutdown = async () => {
      closeSqliteDatabase(database);
      process.exit(0);
    };
  } else {
    const pool = createDbPool({
      connectionString: config.databaseUrl,
      max: config.dbPoolMax,
    });
    const dialect = createPostgresDialect(pool);
    server = createAjanServer({ dialect });
    shutdown = async () => {
      await closeDbPool(pool);
      process.exit(0);
    };
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ajan-sql] ${message}`);
  process.exit(1);
});
