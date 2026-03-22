import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { DbPool } from "./db/pool";
import { registerSchemaResources } from "./resources/schema-resources";
import { registerSchemaTools } from "./tools/schema-tools";

type CreateAjanServerOptions = {
  pool: DbPool;
};

export function createAjanServer(
  options: CreateAjanServerOptions,
): McpServer {
  const server = new McpServer({
    name: "ajan-sql",
    version: "0.1.0",
  });

  registerSchemaTools(server, { pool: options.pool });
  registerSchemaResources(server, { pool: options.pool });

  return server;
}
