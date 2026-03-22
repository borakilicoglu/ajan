import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  describeTable,
  listRelationships,
  listTables,
} from "../db/schema";
import type { DbPool } from "../db/pool";
import {
  explainReadonlyQuery,
  runReadonlyQuery,
  sampleRows,
} from "../query-runner";

type SchemaToolDeps = {
  pool: DbPool;
};

function asTextResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function asStructuredResult<T>(summary: string, data: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: summary,
      },
    ],
    structuredContent: data,
  };
}

type DescribeTableArgs = {
  name: string;
  schema?: string;
};

type SqlArgs = {
  sql: string;
};

type SampleRowsArgs = {
  name: string;
  schema?: string;
  limit?: number;
  columns?: string[];
};

export function registerSchemaTools(
  server: McpServer,
  deps: SchemaToolDeps,
): void {
  const registerTool = server.registerTool.bind(server) as any;

  registerTool(
    "list_tables",
    {
      description: "Return all tables in the database.",
    },
    async () => {
      const tables = await listTables(deps.pool);
      return asTextResult(tables);
    },
  );

  registerTool(
    "describe_table",
    {
      description: "Return columns and types for a given table.",
      inputSchema: {
        name: z.string().min(1),
        schema: z.string().min(1).optional(),
      },
    },
    async ({ name, schema }: DescribeTableArgs) => {
      const resolvedSchema = schema ?? "public";
      const description = await describeTable(deps.pool, name, resolvedSchema);

      if (!description) {
        throw new Error(`Table not found: ${resolvedSchema}.${name}`);
      }

      return asStructuredResult(
        `Described table ${resolvedSchema}.${name} with ${description.columns.length} columns.`,
        description,
      );
    },
  );

  registerTool(
    "list_relationships",
    {
      description: "Return foreign key relationships.",
    },
    async () => {
      const relationships = await listRelationships(deps.pool);
      return asTextResult(relationships);
    },
  );

  registerTool(
    "run_readonly_query",
    {
      description: "Execute a safe SELECT query.",
      inputSchema: {
        sql: z.string().min(1),
      },
    },
    async ({ sql }: SqlArgs) => {
      const result = await runReadonlyQuery(deps.pool, sql);
      return asStructuredResult(
        `Query returned ${result.rowCount} rows in ${result.durationMs}ms.`,
        result,
      );
    },
  );

  registerTool(
    "explain_query",
    {
      description: "Return query execution plan.",
      inputSchema: {
        sql: z.string().min(1),
      },
    },
    async ({ sql }: SqlArgs) => {
      const result = await explainReadonlyQuery(deps.pool, sql);
      const rootNode = result.summary?.nodeType ?? "unknown";
      return asStructuredResult(
        `Explain plan generated in ${result.durationMs}ms. Root node: ${rootNode}.`,
        result,
      );
    },
  );

  registerTool(
    "sample_rows",
    {
      description: "Return example rows from a table.",
      inputSchema: {
        name: z.string().min(1),
        schema: z.string().min(1).optional(),
        limit: z.number().int().positive().max(100).optional(),
        columns: z.array(z.string().min(1)).optional(),
      },
    },
    async ({ name, schema, limit, columns }: SampleRowsArgs) => {
      const result = await sampleRows(
        deps.pool,
        name,
        schema ?? "public",
        limit ?? 10,
        columns,
      );

      return asTextResult(result);
    },
  );
}
