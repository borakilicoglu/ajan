import { describe, expect, it, vi } from "vitest";

import {
  explainReadonlyQuery,
  runReadonlyQuery,
  sampleRows,
} from "../src/query-runner";

function createMockPool(rows: unknown[]) {
  const query = vi.fn(async (sql: string) => {
    if (sql === "BEGIN" || sql.startsWith("SET LOCAL") || sql === "ROLLBACK") {
      return { rows: [], fields: [] };
    }

    return {
      rows,
      fields: rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
            name: key,
            dataTypeID: 25,
          }))
        : [],
    };
  });

  const release = vi.fn();
  const connect = vi.fn().mockResolvedValue({
    query,
    release,
  });

  return {
    pool: {
      connect,
      query,
    },
    query,
    release,
    connect,
  };
}

function createDescribeTableRows() {
  return [
    {
      column_name: "id",
      data_type: "bigint",
      is_nullable: "NO",
      column_default: null,
      is_primary_key: true,
      is_unique: true,
    },
    {
      column_name: "email",
      data_type: "text",
      is_nullable: "NO",
      column_default: null,
      is_primary_key: false,
      is_unique: true,
    },
  ];
}

describe("runReadonlyQuery", () => {
  it("executes a guarded select query inside readonly settings", async () => {
    const mock = createMockPool([{ id: 1, email: "ada@example.com" }]);

    const result = await runReadonlyQuery(
      mock.pool as any,
      "select id, email from users",
    );

    expect(result.rowCount).toBe(1);
    expect(result.sql).toBe("select id, email from users LIMIT 100");
    expect(result.durationMs).toEqual(expect.any(Number));
    expect(result.columns).toEqual([
      { name: "id", dataTypeId: 25 },
      { name: "email", dataTypeId: 25 },
    ]);
    expect(mock.connect).toHaveBeenCalledTimes(1);
    expect(mock.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mock.query).toHaveBeenNthCalledWith(
      2,
      "SET LOCAL statement_timeout = '5000ms'",
    );
    expect(mock.query).toHaveBeenNthCalledWith(
      3,
      "select id, email from users LIMIT 100",
    );
    expect(mock.query).toHaveBeenNthCalledWith(4, "ROLLBACK");
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized results", async () => {
    const mock = createMockPool([
      {
        payload: "x".repeat(1_000_001),
      },
    ]);

    await expect(
      runReadonlyQuery(mock.pool as any, "select payload from logs"),
    ).rejects.toThrow("Query result exceeds maximum allowed size of 1000000 bytes");
  });
});

describe("explainReadonlyQuery", () => {
  it("wraps a guarded query with EXPLAIN", async () => {
    const mock = createMockPool([{ "QUERY PLAN": [{ Plan: { Node: "Seq Scan" } }] }]);

    const result = await explainReadonlyQuery(
      mock.pool as any,
      "select * from users limit 5",
    );

    expect(result.sql).toBe("select * from users limit 5");
    expect(result.durationMs).toEqual(expect.any(Number));
    expect(result.plan).toEqual([{ Plan: { Node: "Seq Scan" } }]);
    expect(mock.query).toHaveBeenNthCalledWith(
      3,
      "EXPLAIN (FORMAT JSON) select * from users limit 5",
    );
  });
});

describe("sampleRows", () => {
  it("builds a limited table sample query", async () => {
    const mock = createMockPool([{ id: 1 }]);
    mock.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql.startsWith("SET LOCAL") || sql === "ROLLBACK") {
        return { rows: [], fields: [] };
      }

      if (sql.includes("from information_schema.columns")) {
        return { rows: createDescribeTableRows(), fields: [] };
      }

      return {
        rows: [{ id: 1 }],
        fields: [{ name: "id", dataTypeID: 20 }],
      };
    });

    const result = await sampleRows(mock.pool as any, "users", "public", 5);

    expect(result.sql).toBe('SELECT * FROM "public"."users" ORDER BY "id" LIMIT 5');
    expect(result.columns).toEqual([{ name: "id", dataTypeId: 20 }]);
    expect(mock.query.mock.calls.map((call) => call[0])).toContain(
      'SELECT * FROM "public"."users" ORDER BY "id" LIMIT 5',
    );
  });

  it("supports selecting specific columns", async () => {
    const mock = createMockPool([{ email: "ada@example.com" }]);
    mock.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql.startsWith("SET LOCAL") || sql === "ROLLBACK") {
        return { rows: [], fields: [] };
      }

      if (sql.includes("from information_schema.columns")) {
        return { rows: createDescribeTableRows(), fields: [] };
      }

      return {
        rows: [{ email: "ada@example.com" }],
        fields: [{ name: "email", dataTypeID: 25 }],
      };
    });

    const result = await sampleRows(
      mock.pool as any,
      "users",
      "public",
      3,
      ["email"],
    );

    expect(result.sql).toBe('SELECT "email" FROM "public"."users" ORDER BY "id" LIMIT 3');
    expect(result.columns).toEqual([{ name: "email", dataTypeId: 25 }]);
  });

  it("rejects unknown selected columns", async () => {
    const mock = createMockPool([]);
    mock.query.mockImplementation(async (sql: string) => {
      if (sql.includes("from information_schema.columns")) {
        return { rows: createDescribeTableRows(), fields: [] };
      }

      return { rows: [], fields: [] };
    });

    await expect(
      sampleRows(mock.pool as any, "users", "public", 3, ["password_hash"]),
    ).rejects.toThrow("Unknown column for sample_rows: password_hash");
  });
});
