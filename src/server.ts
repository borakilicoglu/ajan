import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createPostgresDialect } from "./dialects/postgres";
import type { DatabaseDialect } from "./dialects/types";
import type { DbPool } from "./db/pool";
import { registerSchemaResources } from "./resources/schema-resources";
import { registerSchemaTools } from "./tools/schema-tools";

type CreateAjanServerOptions = {
  pool?: DbPool;
  dialect?: DatabaseDialect;
};

export function createAjanServer(
  options: CreateAjanServerOptions,
): McpServer {
  const dialect =
    options.dialect ?? (options.pool ? createPostgresDialect(options.pool) : null);

  if (!dialect) {
    throw new Error("createAjanServer requires either a pool or a dialect");
  }

  const server = new McpServer({
    name: "ajan-sql",
    version: "0.1.0",
  });

  registerSchemaTools(server, { dialect });
  registerSchemaResources(server, { dialect });

  return server;
}
