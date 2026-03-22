import { describe, expect, it, vi } from "vitest";

import { createAjanServer } from "../src/server";

function createMockPool() {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("from information_schema.tables")) {
        return {
          rows: [
            { table_schema: "public", table_name: "users" },
            { table_schema: "public", table_name: "posts" },
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
  it("registers all MCP tools", () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    expect(Object.keys(server._registeredTools).sort()).toEqual([
      "describe_table",
      "explain_query",
      "list_relationships",
      "list_tables",
      "run_readonly_query",
      "sample_rows",
    ]);
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

  it("returns structured content for describe_table", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;
    const result = await server._registeredTools["describe_table"].handler({
      name: "users",
      schema: "public",
    });

    expect(result.content[0].text).toContain("Described table public.users");
    expect(result.structuredContent).toEqual({
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
    });
  });

  it("returns structured content for readonly and explain query tools", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const queryResult = await server._registeredTools["run_readonly_query"].handler({
      sql: "SELECT id, email FROM users LIMIT 1",
    });
    expect(queryResult.content[0].text).toContain("Query returned 1 rows");
    expect(queryResult.structuredContent.rowCount).toBe(1);
    expect(queryResult.structuredContent.columns).toEqual([
      { name: "id", dataTypeId: 20 },
      { name: "email", dataTypeId: 25 },
    ]);
    expect(queryResult.structuredContent.rows).toEqual([
      { id: 1, email: "bora@example.com" },
    ]);

    const explainResult = await server._registeredTools["explain_query"].handler({
      sql: "SELECT id FROM users LIMIT 1",
    });
    expect(explainResult.content[0].text).toContain("Root node: Seq Scan");
    expect(explainResult.structuredContent.summary).toEqual({
      nodeType: "Seq Scan",
      relationName: "users",
      planRows: 1,
      startupCost: 0,
      totalCost: 1.01,
      childCount: 0,
    });
  });

  it("returns structured content for list and sample tools", async () => {
    const server = createAjanServer({ pool: createMockPool() as any }) as any;

    const tablesResult = await server._registeredTools["list_tables"].handler({});
    expect(tablesResult.content[0].text).toContain("Listed 2 tables");
    expect(tablesResult.structuredContent).toEqual([
      { schema: "public", name: "users" },
      { schema: "public", name: "posts" },
    ]);

    const relationshipsResult =
      await server._registeredTools["list_relationships"].handler({});
    expect(relationshipsResult.content[0].text).toContain(
      "Listed 1 foreign key relationships",
    );
    expect(relationshipsResult.structuredContent).toEqual([
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

    const sampleResult = await server._registeredTools["sample_rows"].handler({
      name: "users",
      schema: "public",
      limit: 1,
      columns: ["id"],
    });
    expect(sampleResult.content[0].text).toContain("Sampled 1 rows from public.users");
    expect(sampleResult.structuredContent.rowCount).toBe(1);
    expect(sampleResult.structuredContent.columns).toEqual([{ name: "id", dataTypeId: 20 }]);
    expect(sampleResult.structuredContent.rows).toEqual([{ id: 1 }]);
  });
});
