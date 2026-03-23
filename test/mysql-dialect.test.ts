import { describe, expect, it, vi } from "vitest";

import { createMysqlDialect } from "../src/dialects/mysql";

function createMockMysqlPool() {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("from information_schema.tables")) {
      return [[
        {
          table_schema: "app",
          table_name: "users",
          table_comment: "Application users",
          estimated_row_count: 12,
        },
      ]];
    }

    if (sql === "select database() as current_database") {
      return [[{ current_database: "app" }]];
    }

    if (sql.includes("from information_schema.columns")) {
      return [[
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
      ]];
    }

    if (sql.includes("from information_schema.statistics")) {
      return [[
        {
          index_name: "PRIMARY",
          column_name: "id",
          is_unique: true,
          is_primary: true,
          ordinal_position: 1,
        },
      ]];
    }

    if (sql.includes("from information_schema.key_column_usage")) {
      return [[
        {
          constraint_name: "orders_user_id_fk",
          source_schema: "app",
          source_table: "orders",
          source_column: "user_id",
          target_schema: "app",
          target_table: "users",
          target_column: "id",
        },
      ]];
    }

    throw new Error(`Unexpected mysql pool query: ${sql} ${String(params)}`);
  });

  const connectionQuery = vi.fn(async (sql: string) => {
    if (sql.startsWith("SET SESSION max_execution_time")) {
      return [{}, []];
    }

    if (sql.startsWith("SELECT id FROM users")) {
      return [[{ id: 1 }], [{ name: "id", columnType: 8 }]];
    }

    if (sql.startsWith("EXPLAIN FORMAT=JSON SELECT id FROM users")) {
      return [[
        {
          EXPLAIN: JSON.stringify({
            query_block: {
              table: {
                table_name: "users",
                access_type: "ALL",
                rows_examined_per_scan: 1,
              },
            },
          }),
        },
      ], [{ name: "EXPLAIN", columnType: 253 }]];
    }

    throw new Error(`Unexpected mysql connection query: ${sql}`);
  });

  const release = vi.fn();

  return {
    pool: {
      query,
      getConnection: vi.fn(async () => ({
        query: connectionQuery,
        release,
      })),
    },
    query,
    connectionQuery,
    release,
  };
}

describe("createMysqlDialect", () => {
  it("lists tables with comments and estimates", async () => {
    const mock = createMockMysqlPool();
    const dialect = createMysqlDialect(mock.pool as any);

    const tables = await dialect.listTables();

    expect(tables).toEqual([
      {
        schema: "app",
        name: "users",
        comment: "Application users",
        estimatedRowCount: 12,
      },
    ]);
  });

  it("describes tables with indexes", async () => {
    const mock = createMockMysqlPool();
    const dialect = createMysqlDialect(mock.pool as any);

    const description = await dialect.describeTable("users", "app");

    expect(description).toEqual({
      schema: "app",
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
          name: "PRIMARY",
          columns: ["id"],
          isUnique: true,
          isPrimary: true,
        },
      ],
    });
  });

  it("runs guarded readonly mysql queries", async () => {
    const mock = createMockMysqlPool();
    const dialect = createMysqlDialect(mock.pool as any);

    const result = await dialect.runReadonlyQuery("SELECT id FROM users");

    expect(result.sql).toBe("SELECT id FROM users LIMIT 100");
    expect(result.rowCount).toBe(1);
    expect(result.columns).toEqual([{ name: "id", dataTypeId: 8 }]);
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(mock.connectionQuery).toHaveBeenCalledWith(
      "SET SESSION max_execution_time = 5000",
    );
  });

  it("explains readonly mysql queries", async () => {
    const mock = createMockMysqlPool();
    const dialect = createMysqlDialect(mock.pool as any);

    const result = await dialect.explainReadonlyQuery("SELECT id FROM users");

    expect(result.sql).toBe("SELECT id FROM users LIMIT 100");
    expect(result.summary).toEqual({
      nodeType: "ALL",
      relationName: "users",
      planRows: 1,
      startupCost: null,
      totalCost: null,
      childCount: 0,
    });
  });
});
