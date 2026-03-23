import type Database from "better-sqlite3";

import type {
  ColumnReference,
  ColumnSummary,
  RelationshipSummary,
  TableDescription,
  TableIndexSummary,
  TableSummary,
} from "../db/schema";
import {
  getReadonlyDefaults,
  guardReadonlyQuery,
  type ReadonlyGuardOptions,
} from "../guard";
import type {
  ExplainPlanSummary,
  ExplainQueryResult,
  QueryColumn,
  ReadonlyQueryResult,
} from "../query-runner";
import type { DatabaseDialect } from "./types";

type JsonRecord = Record<string, unknown>;
type SqliteDatabase = Database.Database;

export function createSqliteDialect(database: SqliteDatabase): DatabaseDialect {
  return {
    name: "sqlite",
    listTables: async () => listSqliteTables(database),
    describeTable: async (name) => describeSqliteTable(database, name),
    listRelationships: async () => listSqliteRelationships(database),
    runReadonlyQuery: async (sql) => runSqliteReadonlyQuery(database, sql),
    explainReadonlyQuery: async (sql) => explainSqliteReadonlyQuery(database, sql),
    sampleRows: async (name, schema, limit, columns) =>
      sampleSqliteRows(database, name, schema, limit, columns),
  };
}

function listSqliteTables(database: SqliteDatabase): TableSummary[] {
  const rows = database
    .prepare(
      `
        select
          name,
          null as comment,
          null as estimated_row_count
        from sqlite_master
        where type = 'table'
          and name not like 'sqlite_%'
        order by name
      `,
    )
    .all() as Array<{
      name: string;
      comment: string | null;
      estimated_row_count: number | null;
    }>;

  return rows.map((row) => ({
    schema: "main",
    name: row.name,
    comment: row.comment,
    estimatedRowCount: row.estimated_row_count,
  }));
}

function describeSqliteTable(
  database: SqliteDatabase,
  tableName: string,
): TableDescription | null {
  const exists = database
    .prepare(
      "select name from sqlite_master where type = 'table' and name = ?",
    )
    .get(tableName) as { name: string } | undefined;

  if (!exists) {
    return null;
  }

  const tableInfo = database
    .prepare(`PRAGMA table_info(${quoteSqliteIdentifier(tableName)})`)
    .all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

  const foreignKeys = database
    .prepare(`PRAGMA foreign_key_list(${quoteSqliteIdentifier(tableName)})`)
    .all() as Array<{
      from: string;
      table: string;
      to: string;
    }>;

  const foreignKeyMap = new Map<string, ColumnReference>();
  for (const row of foreignKeys) {
    foreignKeyMap.set(row.from, {
      schema: "main",
      table: row.table,
      column: row.to,
    });
  }

  const indexList = database
    .prepare(`PRAGMA index_list(${quoteSqliteIdentifier(tableName)})`)
    .all() as Array<{
      name: string;
      unique: number;
      origin: string;
    }>;

  const indexes = indexList.map((index) => {
    const columns = database
      .prepare(`PRAGMA index_info(${quoteSqliteIdentifier(index.name)})`)
      .all() as Array<{ name: string }>;

    return {
      name: index.name,
      columns: columns.map((column) => column.name),
      isUnique: index.unique === 1,
      isPrimary: index.origin === "pk",
    } satisfies TableIndexSummary;
  });

  const uniqueColumns = new Set<string>();
  for (const index of indexes) {
    if (index.isUnique && index.columns.length === 1) {
      uniqueColumns.add(index.columns[0]);
    }
  }

  return {
    schema: "main",
    name: tableName,
    columns: tableInfo.map((column) => ({
      name: column.name,
      dataType: column.type,
      isNullable: column.notnull === 0,
      defaultValue: column.dflt_value,
      isPrimaryKey: column.pk > 0,
      isUnique: column.pk > 0 || uniqueColumns.has(column.name),
      references: foreignKeyMap.get(column.name) ?? null,
    })),
    indexes,
  };
}

function listSqliteRelationships(database: SqliteDatabase): RelationshipSummary[] {
  const tables = listSqliteTables(database);
  const relationships: RelationshipSummary[] = [];

  for (const table of tables) {
    const foreignKeys = database
      .prepare(`PRAGMA foreign_key_list(${quoteSqliteIdentifier(table.name)})`)
      .all() as Array<{
        id: number;
        from: string;
        table: string;
        to: string;
      }>;

    for (const row of foreignKeys) {
      relationships.push({
        constraintName: `${table.name}_fk_${row.id}_${row.from}`,
        sourceSchema: "main",
        sourceTable: table.name,
        sourceColumn: row.from,
        targetSchema: "main",
        targetTable: row.table,
        targetColumn: row.to,
      });
    }
  }

  return relationships;
}

function runSqliteReadonlyQuery(
  database: SqliteDatabase,
  sql: string,
  options: ReadonlyGuardOptions = {},
): ReadonlyQueryResult {
  const guarded = guardReadonlyQuery(sql, options);
  const startedAt = Date.now();
  const statement = database.prepare(guarded.sql);
  const rows = statement.all() as JsonRecord[];
  const columns = statement
    .columns()
    .map((column: Database.ColumnDefinition, index: number) => ({
      name: column.name,
      dataTypeId: index,
    })) satisfies QueryColumn[];

  assertRowCount(rows.length, guarded.limit);
  assertResultSize(rows, guarded.maxResultBytes);

  return {
    sql: guarded.sql,
    rowCount: rows.length,
    durationMs: Date.now() - startedAt,
    columns,
    rows,
  };
}

function explainSqliteReadonlyQuery(
  database: SqliteDatabase,
  sql: string,
): ExplainQueryResult {
  const guarded = guardReadonlyQuery(sql);
  const startedAt = Date.now();
  const plan = database
    .prepare(`EXPLAIN QUERY PLAN ${guarded.sql}`)
    .all() as Array<{ detail?: string }>;

  return {
    sql: guarded.sql,
    durationMs: Date.now() - startedAt,
    summary: summarizeSqliteExplainPlan(plan),
    plan,
  };
}

function sampleSqliteRows(
  database: SqliteDatabase,
  tableName: string,
  _schemaName?: string,
  limit = 10,
  columns?: string[],
): ReadonlyQueryResult {
  const defaults = getReadonlyDefaults();
  const safeLimit = Math.min(limit, defaults.maxLimit);
  const description = describeSqliteTable(database, tableName);

  if (!description) {
    throw new Error(`Table not found: main.${tableName}`);
  }

  const availableColumns = new Set(description.columns.map((column) => column.name));
  const selectedColumns =
    columns && columns.length > 0
      ? columns.map((column) => {
          if (!availableColumns.has(column)) {
            throw new Error(`Unknown column for sample_rows: ${column}`);
          }

          return quoteSqliteIdentifier(column);
        })
      : ["*"];

  const primaryKeyColumns = description.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => quoteSqliteIdentifier(column.name));

  const sql = [
    `SELECT ${selectedColumns.join(", ")}`,
    `FROM ${quoteSqliteIdentifier(tableName)}`,
    primaryKeyColumns.length > 0 ? `ORDER BY ${primaryKeyColumns.join(", ")}` : "",
    `LIMIT ${safeLimit}`,
  ]
    .filter(Boolean)
    .join(" ");

  return runSqliteReadonlyQuery(database, sql, { defaultLimit: safeLimit });
}

function summarizeSqliteExplainPlan(
  plan: Array<{ detail?: string }>,
): ExplainPlanSummary | null {
  if (!Array.isArray(plan) || plan.length === 0) {
    return null;
  }

  const detail = typeof plan[0].detail === "string" ? plan[0].detail : null;
  const relationMatch = detail?.match(/(?:SCAN|SEARCH)\s+([^\s]+)/i) ?? null;

  return {
    nodeType: detail,
    relationName: relationMatch?.[1] ?? null,
    planRows: null,
    startupCost: null,
    totalCost: null,
    childCount: 0,
  };
}

function quoteSqliteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function assertRowCount(rowCount: number, limit: number): void {
  if (rowCount > limit) {
    throw new Error(`Query returned more rows than allowed limit of ${limit}`);
  }
}

function assertResultSize(rows: JsonRecord[], maxResultBytes: number): void {
  const resultBytes = Buffer.byteLength(JSON.stringify(rows), "utf8");

  if (resultBytes > maxResultBytes) {
    throw new Error(`Query result exceeds maximum allowed size of ${maxResultBytes} bytes`);
  }
}
