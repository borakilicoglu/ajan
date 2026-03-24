import { describe, expect, it, vi } from "vitest";

import type { DatabaseDialect } from "../src/dialects/types";
import { createAjanServer } from "../src/server";
import { TOOL_NAME_LIST, TOOL_NAMES } from "../src/tools/names";
import type { ToolResponse } from "../src/tools/types";
import { AJAN_SQL_VERSION } from "../src/version";

function expectTextSummary(result: ToolResponse<unknown>, summaryPart: string): void {
  expect(result.content).toHaveLength(1);
  expect(result.content[0]).toEqual({
    type: "text",
    text: expect.stringContaining(summaryPart),
  });
}

function expectStructuredResult<T>(
  result: ToolResponse<T>,
  summaryPart: string,
  expectedStructuredContent: T,
): void {
  expectTextSummary(result, summaryPart);
  expect(result).toHaveProperty("structuredContent");
  expect(result.structuredContent).toEqual(expectedStructuredContent);
}

function expectErrorResult(
  result: ToolResponse<unknown>,
  expectedCode: string,
  expectedMessage: string,
): void {
  expectTextSummary(result, "Request failed:");
  expect(result.structuredContent).toEqual({
    ok: false,
    error: {
      code: expectedCode,
      message: expectedMessage,
    },
  });
}

function expectResourceContents(
  result: {
    contents: Array<{ uri: string; text: string; mimeType?: string }>;
  },
  expectedUri: string,
  expectedPayload: unknown,
): void {
  expect(result.contents).toEqual([
    {
      uri: expectedUri,
      text: JSON.stringify(expectedPayload, null, 2),
      mimeType: "application/json",
    },
  ]);
}

function createMockPool() {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("from information_schema.tables")) {
        return {
          rows: [
            {
              table_schema: "public",
              table_name: "users",
              table_comment: "Application users",
              estimated_row_count: 42,
            },
            {
              table_schema: "public",
              table_name: "posts",
              table_comment: null,
              estimated_row_count: 128,
            },
          ],
        };
      }

      if (sql.includes("from information_schema.columns")) {
        return {
          rows: [
            {
              column_name: "id",
              data_type: "bigint",
              is_nullable: "NO",
              column_default: null,
              is_primary_key: true,
              is_unique: true,
              referenced_schema: null,
              referenced_table: null,
              referenced_column: null,
            },
          ],
        };
      }

      if (sql.includes("from pg_catalog.pg_class t")) {
        return {
          rows: [
            {
              index_name: "users_pkey",
              column_name: "id",
              is_unique: true,
              is_primary: true,
              ordinal_position: 1,
            },
          ],
        };
      }

      if (sql.includes("from information_schema.table_constraints")) {
        return {
          rows: [
            {
              constraint_name: "posts_user_id_fkey",
              source_schema: "public",
              source_table: "posts",
              source_column: "user_id",
              target_schema: "public",
              target_table: "users",
              target_column: "id",
            },
          ],
        };
      }

      throw new Error(`Unexpected query in server test: ${sql} ${String(params)}`);
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql: string) => {
        if (
          sql === "BEGIN" ||
          sql === "ROLLBACK" ||
          sql.startsWith("SET LOCAL statement_timeout")
        ) {
          return { rows: [], fields: [] };
        }

        if (sql.startsWith("SELECT id, email FROM")) {
          return {
            rows: [{ id: 1, email: "bora@example.com" }],
            fields: [
              { name: "id", dataTypeID: 20 },
              { name: "email", dataTypeID: 25 },
            ],
          };
        }

        if (sql.startsWith('SELECT "id" FROM')) {
          return {
            rows: [{ id: 1 }],
            fields: [{ name: "id", dataTypeID: 20 }],
          };
        }

        if (sql.startsWith("EXPLAIN (FORMAT JSON) SELECT id FROM")) {
          return {
            rows: [
              {
                "QUERY PLAN": [
                  {
                    Plan: {
                      "Node Type": "Seq Scan",
                      "Relation Name": "users",
                      "Plan Rows": 1,
                      "Startup Cost": 0,
                      "Total Cost": 1.01,
                      Plans: [],
                    },
                  },
                ],
              },
            ],
            fields: [],
          };
        }

        throw new Error(`Unexpected client query in server test: ${sql}`);
      }),
      release: vi.fn(),
    })),
  };
}

describe("createAjanServer", () => {
  it("accepts an injected dialect", async () => {
    const dialect: DatabaseDialect = {
      name: "test",
      listTables: vi.fn(async () => []),
      describeTable: vi.fn(async () => null),
      listRelationships: vi.fn(async () => []),
      runReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        rowCount: 1,
        durationMs: 1,
        columns: [{ name: "value", dataTypeId: 23 }],
        rows: [{ value: 1 }],
      })),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => ({
        sql: 'SELECT * FROM "public"."users" LIMIT 1',
        rowCount: 0,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
    };

    const server = createAjanServer({ dialect }) as any;
    const result = await server._registeredTools[TOOL_NAMES.runReadonlyQuery].handler({
      sql: "SELECT 1",
    });

    expect(dialect.runReadonlyQuery).toHaveBeenCalledWith("SELECT 1");
    expectTextSummary(result, "Query returned 1 rows");
    expect(result.structuredContent.rowCount).toBe(1);
  });

  it("returns structured content for server_info", async () => {
    const dialect: DatabaseDialect = {
      name: "sqlite",
      listTables: vi.fn(async () => []),
      describeTable: vi.fn(async () => null),
      listRelationships: vi.fn(async () => []),
      runReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        rowCount: 1,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => ({
        sql: 'SELECT * FROM "main"."users" LIMIT 1',
        rowCount: 0,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
    };

    const server = createAjanServer({ dialect }) as any;
    const result = await server._registeredTools[TOOL_NAMES.serverInfo].handler({});

    expectStructuredResult(result, "Server ajan-sql", {
      name: "ajan-sql",
      version: AJAN_SQL_VERSION,
      dialect: "sqlite",
      tools: [...TOOL_NAME_LIST],
      resources: ["schema://snapshot", "schema://table/{name}"],
      readonly: {
        defaultLimit: 100,
        maxLimit: 100,
        timeoutMs: 5000,
        maxResultBytes: 1000000,
      },
    });
  });

  it("returns a standard error payload for missing tables", async () => {
    const dialect: DatabaseDialect = {
      name: "test",
      listTables: vi.fn(async () => []),
      describeTable: vi.fn(async () => null),
      listRelationships: vi.fn(async () => []),
      runReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        rowCount: 1,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => ({
        sql: 'SELECT * FROM "public"."users" LIMIT 1',
        rowCount: 0,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
    };

    const server = createAjanServer({ dialect }) as any;
    const result = await server._registeredTools[TOOL_NAMES.describeTable].handler({
      name: "missing_table",
      schema: "public",
    });

    expectErrorResult(result, "NOT_FOUND", "Table not found: public.missing_table");
  });

  it("returns a standard error payload for invalid readonly SQL", async () => {
    const dialect: DatabaseDialect = {
      name: "test",
      listTables: vi.fn(async () => []),
      describeTable: vi.fn(async () => null),
      listRelationships: vi.fn(async () => []),
      runReadonlyQuery: vi.fn(async () => {
        throw new Error("Only SELECT queries are allowed");
      }),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => ({
        sql: 'SELECT * FROM "public"."users" LIMIT 1',
        rowCount: 0,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
    };

    const server = createAjanServer({ dialect }) as any;
    const result = await server._registeredTools[TOOL_NAMES.runReadonlyQuery].handler({
      sql: "delete from users",
    });

    expectErrorResult(result, "INVALID_QUERY", "Only SELECT queries are allowed");
  });

  it("returns a standard error payload for invalid sample_rows columns", async () => {
    const dialect: DatabaseDialect = {
      name: "test",
      listTables: vi.fn(async () => []),
      describeTable: vi.fn(async () => null),
      listRelationships: vi.fn(async () => []),
      runReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        rowCount: 1,
        durationMs: 1,
        columns: [],
        rows: [],
      })),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => {
        throw new Error("Unknown column for sample_rows: password_hash");
      }),
    };

    const server = createAjanServer({ dialect }) as any;
    const result = await server._registeredTools[TOOL_NAMES.sampleRows].handler({
      name: "users",
      schema: "public",
      columns: ["password_hash"],
    });

    expectErrorResult(
      result,
      "INVALID_INPUT",
      "Unknown column for sample_rows: password_hash",
    );
  });

  it("registers all MCP tools", () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    expect(Object.keys(server._registeredTools).sort()).toEqual([...TOOL_NAME_LIST].sort());
  });

  it("registers static resources and resource templates", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    expect(Object.keys(server._registeredResources)).toEqual(["schema://snapshot"]);
    expect(Object.keys(server._registeredResourceTemplates)).toEqual(["schema-table"]);

    const template = server._registeredResourceTemplates["schema-table"];
    const listed = await template.resourceTemplate.listCallback();

    expect(listed.resources).toEqual([
      { uri: "schema://table/users", name: "public.users" },
      { uri: "schema://table/posts", name: "public.posts" },
    ]);
  });

  it("returns contract-shaped resource payloads", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const snapshotResult = await server._registeredResources["schema://snapshot"].readCallback(
      new URL("schema://snapshot"),
    );
    expectResourceContents(snapshotResult, "schema://snapshot", {
      tables: [
        {
          schema: "public",
          name: "users",
          comment: "Application users",
          estimatedRowCount: 42,
        },
        {
          schema: "public",
          name: "posts",
          comment: null,
          estimatedRowCount: 128,
        },
      ],
      relationships: [
        {
          constraintName: "posts_user_id_fkey",
          sourceSchema: "public",
          sourceTable: "posts",
          sourceColumn: "user_id",
          targetSchema: "public",
          targetTable: "users",
          targetColumn: "id",
        },
      ],
    });

    const tableTemplate = server._registeredResourceTemplates["schema-table"];
    const tableResult = await tableTemplate.readCallback(
      new URL("schema://table/users"),
      {
        name: "users",
      },
    );
    expectResourceContents(tableResult, "schema://table/users", {
      schema: "public",
      name: "users",
      columns: [
        {
          name: "id",
          dataType: "bigint",
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          isUnique: true,
          references: null,
        },
      ],
      indexes: [
        {
          name: "users_pkey",
          columns: ["id"],
          isUnique: true,
          isPrimary: true,
        },
      ],
    });
  });

  it("returns structured content for describe_table", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;
    const result = await server._registeredTools[TOOL_NAMES.describeTable].handler({
      name: "users",
      schema: "public",
    });

    expectStructuredResult(result, "Described table public.users", {
      schema: "public",
      name: "users",
      columns: [
        {
          name: "id",
          dataType: "bigint",
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          isUnique: true,
          references: null,
        },
      ],
      indexes: [
        {
          name: "users_pkey",
          columns: ["id"],
          isUnique: true,
          isPrimary: true,
        },
      ],
    });
  });

  it("returns structured content for readonly and explain query tools", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const queryResult = await server._registeredTools[TOOL_NAMES.runReadonlyQuery].handler({
      sql: "SELECT id, email FROM users LIMIT 1",
    });
    expectStructuredResult(queryResult, "Query returned 1 rows", {
      sql: "SELECT id, email FROM users LIMIT 1",
      rowCount: 1,
      durationMs: expect.any(Number),
      columns: [
        { name: "id", dataTypeId: 20 },
        { name: "email", dataTypeId: 25 },
      ],
      rows: [
        { id: 1, email: "bora@example.com" },
      ],
    });

    const explainResult = await server._registeredTools[TOOL_NAMES.explainQuery].handler({
      sql: "SELECT id FROM users LIMIT 1",
    });
    expectStructuredResult(explainResult, "Root node: Seq Scan", {
      sql: "SELECT id FROM users LIMIT 1",
      durationMs: expect.any(Number),
      summary: {
        nodeType: "Seq Scan",
        relationName: "users",
        planRows: 1,
        startupCost: 0,
        totalCost: 1.01,
        childCount: 0,
      },
      plan: [
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "users",
            "Plan Rows": 1,
            "Startup Cost": 0,
            "Total Cost": 1.01,
            Plans: [],
          },
        },
      ],
    });
  });

  it("returns structured content for list and sample tools", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const tablesResult = await server._registeredTools[TOOL_NAMES.listTables].handler({});
    expectStructuredResult(tablesResult, "Listed 2 tables", [
      {
        schema: "public",
        name: "users",
        comment: "Application users",
        estimatedRowCount: 42,
      },
      {
        schema: "public",
        name: "posts",
        comment: null,
        estimatedRowCount: 128,
      },
    ]);

    const relationshipsResult =
      await server._registeredTools[TOOL_NAMES.listRelationships].handler({});
    expectStructuredResult(relationshipsResult, "Listed 1 foreign key relationships", [
      {
        constraintName: "posts_user_id_fkey",
        sourceSchema: "public",
        sourceTable: "posts",
        sourceColumn: "user_id",
        targetSchema: "public",
        targetTable: "users",
        targetColumn: "id",
      },
    ]);

    const sampleResult = await server._registeredTools[TOOL_NAMES.sampleRows].handler({
      name: "users",
      schema: "public",
      limit: 1,
      columns: ["id"],
    });
    expectStructuredResult(sampleResult, "Sampled 1 rows from public.users", {
      sql: 'SELECT "id" FROM "public"."users" ORDER BY "id" LIMIT 1',
      rowCount: 1,
      durationMs: expect.any(Number),
      columns: [{ name: "id", dataTypeId: 20 }],
      rows: [{ id: 1 }],
    });
  });

  it("returns structured content for search_schema", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const result = await server._registeredTools[TOOL_NAMES.searchSchema].handler({
      query: "id",
      schema: "public",
      limit: 5,
    });

    expectStructuredResult(result, 'Found 2 schema matches for "id"', {
      query: "id",
      schema: "public",
      totalMatches: 2,
      matches: [
        {
          schema: "public",
          table: "users",
          column: "id",
          dataType: "bigint",
          matchType: "column",
        },
        {
          schema: "public",
          table: "posts",
          column: "id",
          dataType: "bigint",
          matchType: "column",
        },
      ],
    });
  });

  it("reuses cached schema results across tools and resources", async () => {
    const dialect: DatabaseDialect = {
      name: "test",
      listTables: vi.fn(async () => [
        {
          schema: "public",
          name: "users",
          comment: null,
          estimatedRowCount: 1,
        },
      ]),
      describeTable: vi.fn(async () => ({
        schema: "public",
        name: "users",
        columns: [
          {
            name: "id",
            dataType: "bigint",
            isNullable: false,
            defaultValue: null,
            isPrimaryKey: true,
            isUnique: true,
            references: null,
          },
        ],
        indexes: [],
      })),
      listRelationships: vi.fn(async () => [
        {
          constraintName: "users_parent_id_fkey",
          sourceSchema: "public",
          sourceTable: "users",
          sourceColumn: "parent_id",
          targetSchema: "public",
          targetTable: "users",
          targetColumn: "id",
        },
      ]),
      runReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        rowCount: 1,
        durationMs: 1,
        columns: [],
        rows: [{ value: 1 }],
      })),
      explainReadonlyQuery: vi.fn(async () => ({
        sql: "SELECT 1 LIMIT 1",
        durationMs: 1,
        summary: null,
        plan: [],
      })),
      sampleRows: vi.fn(async () => ({
        sql: 'SELECT * FROM "public"."users" LIMIT 1',
        rowCount: 1,
        durationMs: 1,
        columns: [],
        rows: [{ id: 1 }],
      })),
    };

    const server = createAjanServer({ dialect }) as any;
    const tableTemplate = server._registeredResourceTemplates["schema-table"];

    await server._registeredTools[TOOL_NAMES.listTables].handler({});
    await server._registeredResources["schema://snapshot"].readCallback(
      new URL("schema://snapshot"),
    );
    await tableTemplate.resourceTemplate.listCallback();
    await tableTemplate.resourceTemplate.completeCallback("name", "u");

    await server._registeredTools[TOOL_NAMES.describeTable].handler({
      name: "users",
      schema: "public",
    });
    await tableTemplate.readCallback(new URL("schema://table/users"), {
      name: "users",
    });

    await server._registeredTools[TOOL_NAMES.listRelationships].handler({});
    await server._registeredResources["schema://snapshot"].readCallback(
      new URL("schema://snapshot"),
    );

    expect(dialect.listTables).toHaveBeenCalledTimes(1);
    expect(dialect.describeTable).toHaveBeenCalledTimes(1);
    expect(dialect.listRelationships).toHaveBeenCalledTimes(1);
  });
});
