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
});
