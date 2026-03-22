import type { FieldDef, QueryResultRow } from "pg";

import type { DbPool } from "../db/pool";
import { describeTable } from "../db/schema";
import {
  getReadonlyDefaults,
  guardReadonlyQuery,
  quoteIdentifier,
  type ReadonlyGuardOptions,
} from "../guard";

type JsonRecord = Record<string, unknown>;

export type ReadonlyQueryResult = {
  sql: string;
  rowCount: number;
  durationMs: number;
  columns: QueryColumn[];
  rows: JsonRecord[];
};

export type ExplainQueryResult = {
  sql: string;
  durationMs: number;
  plan: unknown;
};

export type QueryColumn = {
  name: string;
  dataTypeId: number;
};

export async function runReadonlyQuery(
  pool: DbPool,
  sql: string,
  options: ReadonlyGuardOptions = {},
): Promise<ReadonlyQueryResult> {
  const guarded = guardReadonlyQuery(sql, options);
  const result = await executeWithReadonlySettings(pool, guarded.sql, guarded.timeoutMs);

  assertRowCount(result.rows.length, guarded.limit);
  assertResultSize(result.rows, guarded.maxResultBytes);

  return {
    sql: guarded.sql,
    rowCount: result.rows.length,
    durationMs: result.durationMs,
    columns: result.fields.map(toQueryColumn),
    rows: result.rows as JsonRecord[],
  };
}

export async function explainReadonlyQuery(
  pool: DbPool,
  sql: string,
): Promise<ExplainQueryResult> {
  const guarded = guardReadonlyQuery(sql);
  const explainSql = `EXPLAIN (FORMAT JSON) ${guarded.sql}`;
  const result = await executeWithReadonlySettings(pool, explainSql, guarded.timeoutMs);
  const plan = result.rows[0]?.["QUERY PLAN"];

  return {
    sql: guarded.sql,
    durationMs: result.durationMs,
    plan,
  };
}

export async function sampleRows(
  pool: DbPool,
  tableName: string,
  schemaName = "public",
  limit = 10,
  columns?: string[],
): Promise<ReadonlyQueryResult> {
  const defaults = getReadonlyDefaults();
  const safeLimit = Math.min(limit, defaults.maxLimit);
  const description = await describeTable(pool, tableName, schemaName);

  if (!description) {
    throw new Error(`Table not found: ${schemaName}.${tableName}`);
  }

  const availableColumns = new Set(description.columns.map((column) => column.name));
  const selectedColumns =
    columns && columns.length > 0
      ? columns.map((column) => {
          if (!availableColumns.has(column)) {
            throw new Error(`Unknown column for sample_rows: ${column}`);
          }

          return quoteIdentifier(column);
        })
      : ["*"];

  const primaryKeyColumns = description.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => quoteIdentifier(column.name));

  const sql = [
    `SELECT ${selectedColumns.join(", ")}`,
    `FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`,
    primaryKeyColumns.length > 0
      ? `ORDER BY ${primaryKeyColumns.join(", ")}`
      : "",
    `LIMIT ${safeLimit}`,
  ]
    .filter(Boolean)
    .join(" ");

  return runReadonlyQuery(pool, sql, { defaultLimit: safeLimit });
}

async function executeWithReadonlySettings(
  pool: DbPool,
  sql: string,
  timeoutMs: number,
) {
  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
    const result = await client.query(sql);
    await client.query("ROLLBACK");
    return {
      ...result,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function toQueryColumn(field: FieldDef): QueryColumn {
  return {
    name: field.name,
    dataTypeId: field.dataTypeID,
  };
}

function assertRowCount(rowCount: number, limit: number): void {
  if (rowCount > limit) {
    throw new Error(`Query returned more rows than allowed limit of ${limit}`);
  }
}

function assertResultSize(rows: QueryResultRow[], maxResultBytes: number): void {
  const resultBytes = Buffer.byteLength(JSON.stringify(rows), "utf8");

  if (resultBytes > maxResultBytes) {
    throw new Error(`Query result exceeds maximum allowed size of ${maxResultBytes} bytes`);
  }
}
