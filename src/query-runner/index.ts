import type { FieldDef, QueryResultRow } from "pg";

import { auditQueryEvent } from "../audit";
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
  summary: ExplainPlanSummary | null;
  plan: unknown;
};

export type QueryColumn = {
  name: string;
  dataTypeId: number;
};

export type ExplainPlanSummary = {
  nodeType: string | null;
  relationName: string | null;
  planRows: number | null;
  startupCost: number | null;
  totalCost: number | null;
  childCount: number;
};

export async function runReadonlyQuery(
  pool: DbPool,
  sql: string,
  options: ReadonlyGuardOptions = {},
): Promise<ReadonlyQueryResult> {
  try {
    const guarded = guardReadonlyQuery(sql, options);
    const result = await executeWithReadonlySettings(pool, guarded.sql, guarded.timeoutMs);

    assertRowCount(result.rows.length, guarded.limit);
    assertResultSize(result.rows, guarded.maxResultBytes);
    auditQueryEvent({
      operation: "run_readonly_query",
      status: "allowed",
      sql,
      guardedSql: guarded.sql,
      durationMs: result.durationMs,
      rowCount: result.rows.length,
    });

    return {
      sql: guarded.sql,
      rowCount: result.rows.length,
      durationMs: result.durationMs,
      columns: result.fields.map(toQueryColumn),
      rows: result.rows as JsonRecord[],
    };
  } catch (error) {
    auditQueryEvent({
      operation: "run_readonly_query",
      status: "rejected",
      sql,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function explainReadonlyQuery(
  pool: DbPool,
  sql: string,
): Promise<ExplainQueryResult> {
  try {
    const guarded = guardReadonlyQuery(sql);
    const explainSql = `EXPLAIN (FORMAT JSON) ${guarded.sql}`;
    const result = await executeWithReadonlySettings(pool, explainSql, guarded.timeoutMs);
    const plan = result.rows[0]?.["QUERY PLAN"];
    auditQueryEvent({
      operation: "explain_query",
      status: "allowed",
      sql,
      guardedSql: guarded.sql,
      durationMs: result.durationMs,
    });

    return {
      sql: guarded.sql,
      durationMs: result.durationMs,
      summary: summarizeExplainPlan(plan),
      plan,
    };
  } catch (error) {
    auditQueryEvent({
      operation: "explain_query",
      status: "rejected",
      sql,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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

function summarizeExplainPlan(plan: unknown): ExplainPlanSummary | null {
  if (!Array.isArray(plan) || plan.length === 0) {
    return null;
  }

  const root = plan[0] as { Plan?: Record<string, unknown> };
  const rootPlan = root?.Plan;

  if (!rootPlan || typeof rootPlan !== "object") {
    return null;
  }

  const childPlans = Array.isArray(rootPlan.Plans) ? rootPlan.Plans : [];

  return {
    nodeType: getStringField(rootPlan, "Node Type"),
    relationName: getStringField(rootPlan, "Relation Name"),
    planRows: getNumberField(rootPlan, "Plan Rows"),
    startupCost: getNumberField(rootPlan, "Startup Cost"),
    totalCost: getNumberField(rootPlan, "Total Cost"),
    childCount: childPlans.length,
  };
}

function getStringField(
  plan: Record<string, unknown>,
  key: string,
): string | null {
  return typeof plan[key] === "string" ? (plan[key] as string) : null;
}

function getNumberField(
  plan: Record<string, unknown>,
  key: string,
): number | null {
  return typeof plan[key] === "number" ? (plan[key] as number) : null;
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
