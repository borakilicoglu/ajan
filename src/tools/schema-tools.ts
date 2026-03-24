import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getReadonlyDefaults } from "../guard";
import { AJAN_SQL_VERSION } from "../version";
import type { DatabaseDialect } from "../dialects/types";
import { TOOL_NAMES } from "./names";
import type {
  DescribeTableArgs,
  ErrorToolResponse,
  ExplainQueryArgs,
  RunReadonlyQueryArgs,
  SampleRowsArgs,
  SearchSchemaArgs,
  SearchSchemaMatch,
  ServerInfoResult,
  ToolError,
  ToolResponse,
} from "./types";
import {
  describeTableSchema,
  explainQuerySchema,
  runReadonlyQuerySchema,
  sampleRowsSchema,
  searchSchemaSchema,
} from "./types";

type SchemaToolDeps = {
  dialect: DatabaseDialect;
};

type RegisterTool = (
  name: string,
  config: {
    description: string;
    inputSchema?: Record<string, unknown>;
  },
  handler: (args: any) => Promise<ToolResponse<unknown>>,
) => void;

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

function asErrorResult(error: ToolError): ErrorToolResponse {
  return {
    content: [
      {
        type: "text",
        text: `Request failed: ${error.message}`,
      },
    ],
    structuredContent: {
      ok: false,
      error,
    },
  };
}

function withToolErrorHandling<TArgs>(
  handler: (args: TArgs) => Promise<ToolResponse<unknown>>,
): (args: TArgs) => Promise<ToolResponse<unknown>> {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (error) {
      return asErrorResult(classifyToolError(error));
    }
  };
}

function classifyToolError(error: unknown): ToolError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("Table not found:")) {
    return {
      code: "NOT_FOUND",
      message,
    };
  }

  if (message.startsWith("Unknown column for sample_rows:")) {
    return {
      code: "INVALID_INPUT",
      message,
    };
  }

  if (
    message === "SQL query is required" ||
    message === "Only a single SQL statement is allowed" ||
    message === "SQL comments are not allowed" ||
    message === "Only SELECT queries are allowed" ||
    message === "LIMIT ALL is not allowed" ||
    message.startsWith("Blocked SQL keyword detected:") ||
    message.startsWith("Query LIMIT exceeds maximum allowed value of")
  ) {
    return {
      code: "INVALID_QUERY",
      message,
    };
  }

  if (message.startsWith("Invalid SQL identifier:")) {
    return {
      code: "INVALID_INPUT",
      message,
    };
  }

  if (message.startsWith("Query returned more rows than allowed limit of")) {
    return {
      code: "RESULT_LIMIT_EXCEEDED",
      message,
    };
  }

  if (message.startsWith("Query result exceeds maximum allowed size of")) {
    return {
      code: "RESULT_TOO_LARGE",
      message,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message,
  };
}

function registerListTablesTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.listTables,
    {
      description: "Return all tables in the database.",
    },
    withToolErrorHandling(async () => {
      const tables = await deps.dialect.listTables();
      return asStructuredResult(
        `Listed ${tables.length} tables.`,
        tables,
      );
    }),
  );
}

function registerServerInfoTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.serverInfo,
    {
      description: "Return server runtime details for onboarding and diagnostics.",
    },
    withToolErrorHandling(async () => {
      const readonly = getReadonlyDefaults();
      const result: ServerInfoResult = {
        name: "ajan-sql",
        version: AJAN_SQL_VERSION,
        dialect: deps.dialect.name,
        tools: Object.values(TOOL_NAMES),
        resources: [
          "schema://snapshot",
          "schema://table/{name}",
        ],
        readonly,
      };

      return asStructuredResult(
        `Server ajan-sql ${AJAN_SQL_VERSION} is running with the ${deps.dialect.name} dialect.`,
        result,
      );
    }),
  );
}

function registerDescribeTableTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.describeTable,
    {
      description: "Return columns and types for a given table.",
      inputSchema: describeTableSchema,
    },
    withToolErrorHandling(async ({ name, schema }: DescribeTableArgs) => {
      const resolvedSchema = schema ?? "public";
      const description = await deps.dialect.describeTable(name, resolvedSchema);

      if (!description) {
        throw new Error(`Table not found: ${resolvedSchema}.${name}`);
      }

      return asStructuredResult(
        `Described table ${resolvedSchema}.${name} with ${description.columns.length} columns.`,
        description,
      );
    }),
  );
}

function registerListRelationshipsTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.listRelationships,
    {
      description: "Return foreign key relationships.",
    },
    withToolErrorHandling(async () => {
      const relationships = await deps.dialect.listRelationships();
      return asStructuredResult(
        `Listed ${relationships.length} foreign key relationships.`,
        relationships,
      );
    }),
  );
}

function registerSearchSchemaTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.searchSchema,
    {
      description: "Search table and column names across the available schema.",
      inputSchema: searchSchemaSchema,
    },
    withToolErrorHandling(async ({ query, schema, limit }: SearchSchemaArgs) => {
      const resolvedLimit = limit ?? 20;
      const normalizedQuery = query.trim().toLowerCase();
      const tables = await deps.dialect.listTables();
      const filteredTables = schema
        ? tables.filter((table) => table.schema === schema)
        : tables;
      const matches: SearchSchemaMatch[] = [];

      for (const table of filteredTables) {
        if (matches.length >= resolvedLimit) {
          break;
        }

        if (table.name.toLowerCase().includes(normalizedQuery)) {
          matches.push({
            schema: table.schema,
            table: table.name,
            column: null,
            dataType: null,
            matchType: "table",
          });
        }

        if (matches.length >= resolvedLimit) {
          break;
        }

        const description = await deps.dialect.describeTable(table.name, table.schema);

        if (!description) {
          continue;
        }

        for (const column of description.columns) {
          if (matches.length >= resolvedLimit) {
            break;
          }

          if (!column.name.toLowerCase().includes(normalizedQuery)) {
            continue;
          }

          matches.push({
            schema: table.schema,
            table: table.name,
            column: column.name,
            dataType: column.dataType,
            matchType: "column",
          });
        }
      }

      return asStructuredResult(
        `Found ${matches.length} schema matches for "${query}".`,
        {
          query,
          schema: schema ?? null,
          totalMatches: matches.length,
          matches,
        },
      );
    }),
  );
}

function registerReadonlyQueryTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.runReadonlyQuery,
    {
      description: "Execute a safe SELECT query.",
      inputSchema: runReadonlyQuerySchema,
    },
    withToolErrorHandling(async ({ sql }: RunReadonlyQueryArgs) => {
      const result = await deps.dialect.runReadonlyQuery(sql);
      return asStructuredResult(
        `Query returned ${result.rowCount} rows in ${result.durationMs}ms.`,
        result,
      );
    }),
  );
}

function registerExplainQueryTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.explainQuery,
    {
      description: "Return query execution plan.",
      inputSchema: explainQuerySchema,
    },
    withToolErrorHandling(async ({ sql }: ExplainQueryArgs) => {
      const result = await deps.dialect.explainReadonlyQuery(sql);
      const rootNode = result.summary?.nodeType ?? "unknown";
      return asStructuredResult(
        `Explain plan generated in ${result.durationMs}ms. Root node: ${rootNode}.`,
        result,
      );
    }),
  );
}

function registerSampleRowsTool(registerTool: RegisterTool, deps: SchemaToolDeps): void {
  registerTool(
    TOOL_NAMES.sampleRows,
    {
      description: "Return example rows from a table.",
      inputSchema: sampleRowsSchema,
    },
    withToolErrorHandling(async ({ name, schema, limit, columns }: SampleRowsArgs) => {
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
    }),
  );
}

const registerSchemaToolSet = [
  registerServerInfoTool,
  registerListTablesTool,
  registerDescribeTableTool,
  registerListRelationshipsTool,
  registerSearchSchemaTool,
  registerReadonlyQueryTool,
  registerExplainQueryTool,
  registerSampleRowsTool,
] as const;

export function registerSchemaTools(
  server: McpServer,
  deps: SchemaToolDeps,
): void {
  const registerTool = server.registerTool.bind(server) as RegisterTool;

  for (const registerSchemaTool of registerSchemaToolSet) {
    registerSchemaTool(registerTool, deps);
  }
}
