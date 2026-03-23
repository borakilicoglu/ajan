import type { FieldPacket, PoolConnection, Pool as MysqlPool, RowDataPacket } from "mysql2/promise";

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

export function createMysqlDialect(pool: MysqlPool): DatabaseDialect {
  return {
    name: "mysql",
    listTables: () => listMysqlTables(pool),
    describeTable: (name, schema) => describeMysqlTable(pool, name, schema),
    listRelationships: () => listMysqlRelationships(pool),
    runReadonlyQuery: (sql) => runMysqlReadonlyQuery(pool, sql),
    explainReadonlyQuery: (sql) => explainMysqlReadonlyQuery(pool, sql),
    sampleRows: (name, schema, limit, columns) =>
      sampleMysqlRows(pool, name, schema, limit, columns),
  };
}

async function listMysqlTables(pool: MysqlPool): Promise<TableSummary[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      select
        table_schema,
        table_name,
        nullif(table_comment, '') as table_comment,
        table_rows as estimated_row_count
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
      order by table_schema, table_name
    `,
  );

  return rows.map((row) => ({
    schema: String(row.table_schema),
    name: String(row.table_name),
    comment: row.table_comment === null ? null : String(row.table_comment),
    estimatedRowCount:
      row.estimated_row_count === null
        ? null
        : Math.max(0, Math.round(Number(row.estimated_row_count))),
  }));
}

async function describeMysqlTable(
  pool: MysqlPool,
  tableName: string,
  schemaName?: string,
): Promise<TableDescription | null> {
  const resolvedSchema = schemaName ?? await getMysqlCurrentDatabase(pool);
  const [columnRows] = await pool.query<RowDataPacket[]>(
    `
      select
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        (c.column_key = 'PRI') as is_primary_key,
        (c.column_key in ('PRI', 'UNI')) as is_unique,
        k.referenced_table_schema as referenced_schema,
        k.referenced_table_name as referenced_table,
        k.referenced_column_name as referenced_column
      from information_schema.columns c
      left join information_schema.key_column_usage k
        on k.table_schema = c.table_schema
       and k.table_name = c.table_name
       and k.column_name = c.column_name
       and k.referenced_table_name is not null
      where c.table_schema = ?
        and c.table_name = ?
      order by c.ordinal_position
    `,
    [resolvedSchema, tableName],
  );

  if (columnRows.length === 0) {
    return null;
  }

  const [indexRows] = await pool.query<RowDataPacket[]>(
    `
      select
        index_name,
        column_name,
        (non_unique = 0) as is_unique,
        (index_name = 'PRIMARY') as is_primary,
        seq_in_index as ordinal_position
      from information_schema.statistics
      where table_schema = ?
        and table_name = ?
      order by index_name, seq_in_index
    `,
    [resolvedSchema, tableName],
  );

  return {
    schema: resolvedSchema,
    name: tableName,
    columns: columnRows.map(toMysqlColumnSummary),
    indexes: aggregateMysqlIndexes(indexRows),
  };
}

async function listMysqlRelationships(
  pool: MysqlPool,
): Promise<RelationshipSummary[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      select
        constraint_name,
        table_schema as source_schema,
        table_name as source_table,
        column_name as source_column,
        referenced_table_schema as target_schema,
        referenced_table_name as target_table,
        referenced_column_name as target_column
      from information_schema.key_column_usage
      where referenced_table_name is not null
        and table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
      order by table_schema, table_name, constraint_name, ordinal_position
    `,
  );

  return rows.map((row) => ({
    constraintName: String(row.constraint_name),
    sourceSchema: String(row.source_schema),
    sourceTable: String(row.source_table),
    sourceColumn: String(row.source_column),
    targetSchema: String(row.target_schema),
    targetTable: String(row.target_table),
    targetColumn: String(row.target_column),
  }));
}

async function runMysqlReadonlyQuery(
  pool: MysqlPool,
  sql: string,
  options: ReadonlyGuardOptions = {},
): Promise<ReadonlyQueryResult> {
  const guarded = guardReadonlyQuery(sql, options);
  const result = await executeMysqlReadonly(pool, guarded.sql, guarded.timeoutMs);

  assertRowCount(result.rows.length, guarded.limit);
  assertResultSize(result.rows, guarded.maxResultBytes);

  return {
    sql: guarded.sql,
    rowCount: result.rows.length,
    durationMs: result.durationMs,
    columns: result.fields.map(toMysqlQueryColumn),
    rows: result.rows,
  };
}

async function explainMysqlReadonlyQuery(
  pool: MysqlPool,
  sql: string,
): Promise<ExplainQueryResult> {
  const guarded = guardReadonlyQuery(sql);
  const result = await executeMysqlReadonly(
    pool,
    `EXPLAIN FORMAT=JSON ${guarded.sql}`,
    guarded.timeoutMs,
  );
  const rawPlan = result.rows[0]?.EXPLAIN;
  const plan = typeof rawPlan === "string" ? safeParseJson(rawPlan) : rawPlan;

  return {
    sql: guarded.sql,
    durationMs: result.durationMs,
    summary: summarizeMysqlExplainPlan(plan),
    plan,
  };
}

async function sampleMysqlRows(
  pool: MysqlPool,
  tableName: string,
  schemaName?: string,
  limit = 10,
  columns?: string[],
): Promise<ReadonlyQueryResult> {
  const resolvedSchema = schemaName ?? await getMysqlCurrentDatabase(pool);
  const defaults = getReadonlyDefaults();
  const safeLimit = Math.min(limit, defaults.maxLimit);
  const description = await describeMysqlTable(pool, tableName, resolvedSchema);

  if (!description) {
    throw new Error(`Table not found: ${resolvedSchema}.${tableName}`);
  }

  const availableColumns = new Set(description.columns.map((column) => column.name));
  const selectedColumns =
    columns && columns.length > 0
      ? columns.map((column) => {
          if (!availableColumns.has(column)) {
            throw new Error(`Unknown column for sample_rows: ${column}`);
          }

          return quoteMysqlIdentifier(column);
        })
      : ["*"];

  const primaryKeyColumns = description.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => quoteMysqlIdentifier(column.name));

  const sql = [
    `SELECT ${selectedColumns.join(", ")}`,
    `FROM ${quoteMysqlIdentifier(resolvedSchema)}.${quoteMysqlIdentifier(tableName)}`,
    primaryKeyColumns.length > 0 ? `ORDER BY ${primaryKeyColumns.join(", ")}` : "",
    `LIMIT ${safeLimit}`,
  ]
    .filter(Boolean)
    .join(" ");

  return runMysqlReadonlyQuery(pool, sql, { defaultLimit: safeLimit });
}

async function executeMysqlReadonly(
  pool: MysqlPool,
  sql: string,
  timeoutMs: number,
): Promise<{ rows: JsonRecord[]; fields: FieldPacket[]; durationMs: number }> {
  const connection = await pool.getConnection();
  const startedAt = Date.now();

  try {
    await connection.query(`SET SESSION max_execution_time = ${timeoutMs}`);
    const [rows, fields] = await connection.query<RowDataPacket[]>(sql);
    await connection.query("SET SESSION max_execution_time = DEFAULT");

    return {
      rows: rows.map((row) => ({ ...row })) as JsonRecord[],
      fields,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await connection.query("SET SESSION max_execution_time = DEFAULT").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function getMysqlCurrentDatabase(pool: MysqlPool): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>("select database() as current_database");
  const value = rows[0]?.current_database;

  if (!value) {
    throw new Error("Unable to determine current MySQL database");
  }

  return String(value);
}

function toMysqlColumnSummary(row: RowDataPacket): ColumnSummary {
  return {
    name: String(row.column_name),
    dataType: String(row.data_type),
    isNullable: String(row.is_nullable) === "YES",
    defaultValue: row.column_default === null ? null : String(row.column_default),
    isPrimaryKey: Boolean(row.is_primary_key),
    isUnique: Boolean(row.is_unique),
    references: toMysqlReference(row),
  };
}

function toMysqlReference(row: RowDataPacket): ColumnReference | null {
  if (!row.referenced_schema || !row.referenced_table || !row.referenced_column) {
    return null;
  }

  return {
    schema: String(row.referenced_schema),
    table: String(row.referenced_table),
    column: String(row.referenced_column),
  };
}

function aggregateMysqlIndexes(rows: RowDataPacket[]): TableIndexSummary[] {
  const indexes = new Map<string, TableIndexSummary>();

  for (const row of rows) {
    const name = String(row.index_name);
    const existing = indexes.get(name);

    if (existing) {
      existing.columns.push(String(row.column_name));
      continue;
    }

    indexes.set(name, {
      name,
      columns: [String(row.column_name)],
      isUnique: Boolean(row.is_unique),
      isPrimary: Boolean(row.is_primary),
    });
  }

  return [...indexes.values()];
}

function toMysqlQueryColumn(field: FieldPacket): QueryColumn {
  return {
    name: field.name,
    dataTypeId: field.columnType ?? 0,
  };
}

function summarizeMysqlExplainPlan(plan: unknown): ExplainPlanSummary | null {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const queryBlock = (plan as Record<string, unknown>).query_block;

  if (!queryBlock || typeof queryBlock !== "object") {
    return null;
  }

  const block = queryBlock as Record<string, unknown>;
  const table = block.table && typeof block.table === "object"
    ? (block.table as Record<string, unknown>)
    : null;

  return {
    nodeType: getMysqlString(table, "access_type"),
    relationName: getMysqlString(table, "table_name"),
    planRows: getMysqlNumber(table, "rows_examined_per_scan") ?? getMysqlNumber(table, "rows"),
    startupCost: getMysqlNumber(block, "cost_info") ?? null,
    totalCost: null,
    childCount: 0,
  };
}

function getMysqlString(
  source: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!source) {
    return null;
  }

  return typeof source[key] === "string" ? (source[key] as string) : null;
}

function getMysqlNumber(
  source: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!source) {
    return null;
  }

  return typeof source[key] === "number" ? (source[key] as number) : null;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function quoteMysqlIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `\`${identifier.replace(/`/g, "``")}\``;
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
