import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { DatabaseDialect } from "../dialects/types";
import { TOOL_NAMES } from "./names";
import type {
  DescribeTableArgs,
  ExplainQueryArgs,
  RunReadonlyQueryArgs,
  SampleRowsArgs,
  ToolResponse,
} from "./types";
import {
  describeTableSchema,
  explainQuerySchema,
  runReadonlyQuerySchema,
  sampleRowsSchema,
} from "./types";

type SchemaToolDeps = {
  dialect: DatabaseDialect;
};

function asStructuredResult<T>(summary: string, data: T): ToolResponse<T> {
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

export function registerSchemaTools(
  server: McpServer,
  deps: SchemaToolDeps,
): void {
  const registerTool = server.registerTool.bind(server) as any;

  registerTool(
    TOOL_NAMES.listTables,
    {
      description: "Return all tables in the database.",
    },
    async () => {
      const tables = await deps.dialect.listTables();
      return asStructuredResult(
        `Listed ${tables.length} tables.`,
        tables,
      );
    },
  );

  registerTool(
    TOOL_NAMES.describeTable,
    {
      description: "Return columns and types for a given table.",
      inputSchema: describeTableSchema,
    },
    async ({ name, schema }: DescribeTableArgs) => {
      const resolvedSchema = schema ?? "public";
      const description = await deps.dialect.describeTable(name, resolvedSchema);

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
    TOOL_NAMES.listRelationships,
    {
      description: "Return foreign key relationships.",
    },
    async () => {
      const relationships = await deps.dialect.listRelationships();
      return asStructuredResult(
        `Listed ${relationships.length} foreign key relationships.`,
        relationships,
      );
    },
  );

  registerTool(
    TOOL_NAMES.runReadonlyQuery,
    {
      description: "Execute a safe SELECT query.",
      inputSchema: runReadonlyQuerySchema,
    },
    async ({ sql }: RunReadonlyQueryArgs) => {
      const result = await deps.dialect.runReadonlyQuery(sql);
      return asStructuredResult(
        `Query returned ${result.rowCount} rows in ${result.durationMs}ms.`,
        result,
      );
    },
  );

  registerTool(
    TOOL_NAMES.explainQuery,
    {
      description: "Return query execution plan.",
      inputSchema: explainQuerySchema,
    },
    async ({ sql }: ExplainQueryArgs) => {
      const result = await deps.dialect.explainReadonlyQuery(sql);
      const rootNode = result.summary?.nodeType ?? "unknown";
      return asStructuredResult(
        `Explain plan generated in ${result.durationMs}ms. Root node: ${rootNode}.`,
        result,
      );
    },
  );

  registerTool(
    TOOL_NAMES.sampleRows,
    {
      description: "Return example rows from a table.",
      inputSchema: sampleRowsSchema,
    },
    async ({ name, schema, limit, columns }: SampleRowsArgs) => {
      const result = await deps.dialect.sampleRows(
        name,
        schema ?? "public",
        limit ?? 10,
        columns,
      );

      return asStructuredResult(
        `Sampled ${result.rowCount} rows from ${(schema ?? "public")}.${name} in ${result.durationMs}ms.`,
        result,
      );
    },
  );
}
