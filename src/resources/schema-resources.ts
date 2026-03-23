import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { DatabaseDialect } from "../dialects/types";

type SchemaResourceDeps = {
  dialect: DatabaseDialect;
};

export function registerSchemaResources(
  server: McpServer,
  deps: SchemaResourceDeps,
): void {
  server.registerResource(
    "schema-snapshot",
    "schema://snapshot",
    {
      description: "Snapshot of tables and foreign key relationships.",
      mimeType: "application/json",
    },
    async (uri) => {
      const [tables, relationships] = await Promise.all([
        deps.dialect.listTables(),
        deps.dialect.listRelationships(),
      ]);

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ tables, relationships }, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  server.registerResource(
    "schema-table",
    new ResourceTemplate("schema://table/{name}", {
      list: async () => {
        const tables = await deps.dialect.listTables();

        return {
          resources: tables.map((table) => ({
            uri: `schema://table/${table.name}`,
            name: `${table.schema}.${table.name}`,
          })),
        };
      },
      complete: {
        name: async (value) => {
          const tables = await deps.dialect.listTables();

          return tables
            .map((table) => table.name)
            .filter((tableName) => tableName.startsWith(value));
        },
      },
    }),
    {
      description: "Schema details for a single table.",
      mimeType: "application/json",
    },
    async (uri, params) => {
      const tableName = Array.isArray(params.name) ? params.name[0] : params.name;

      if (!tableName) {
        throw new Error("Table name is required");
      }

      const description = await deps.dialect.describeTable(tableName);

      if (!description) {
        throw new Error(`Table not found: ${tableName}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(description, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );
}
