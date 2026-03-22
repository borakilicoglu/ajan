import type { DbPool } from "./pool";

export type TableSummary = {
  schema: string;
  name: string;
};

export type ColumnSummary = {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
};

export type TableDescription = {
  schema: string;
  name: string;
  columns: ColumnSummary[];
};

export type RelationshipSummary = {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
};

export async function listTables(pool: DbPool): Promise<TableSummary[]> {
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
  }>(
    `
      select table_schema, table_name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('information_schema', 'pg_catalog')
      order by table_schema, table_name
    `,
  );

  return result.rows.map((row) => ({
    schema: row.table_schema,
    name: row.table_name,
  }));
}

export async function describeTable(
  pool: DbPool,
  tableName: string,
  schemaName = "public",
): Promise<TableDescription | null> {
  const result = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    is_primary_key: boolean;
    is_unique: boolean;
  }>(
    `
      select
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        exists (
          select 1
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on tc.constraint_name = kcu.constraint_name
           and tc.table_schema = kcu.table_schema
          where tc.constraint_type = 'PRIMARY KEY'
            and tc.table_schema = c.table_schema
            and tc.table_name = c.table_name
            and kcu.column_name = c.column_name
        ) as is_primary_key,
        exists (
          select 1
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on tc.constraint_name = kcu.constraint_name
           and tc.table_schema = kcu.table_schema
          where tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
            and tc.table_schema = c.table_schema
            and tc.table_name = c.table_name
            and kcu.column_name = c.column_name
        ) as is_unique
      from information_schema.columns c
      where c.table_schema = $1
        and c.table_name = $2
      order by ordinal_position
    `,
    [schemaName, tableName],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    schema: schemaName,
    name: tableName,
    columns: result.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
      isUnique: row.is_unique,
    })),
  };
}

export async function listRelationships(
  pool: DbPool,
): Promise<RelationshipSummary[]> {
  const result = await pool.query<{
    constraint_name: string;
    source_schema: string;
    source_table: string;
    source_column: string;
    target_schema: string;
    target_table: string;
    target_column: string;
  }>(
    `
      select
        tc.constraint_name,
        tc.table_schema as source_schema,
        tc.table_name as source_table,
        kcu.column_name as source_column,
        ccu.table_schema as target_schema,
        ccu.table_name as target_table,
        ccu.column_name as target_column
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
      order by
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        kcu.ordinal_position
    `,
  );

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    sourceSchema: row.source_schema,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    targetSchema: row.target_schema,
    targetTable: row.target_table,
    targetColumn: row.target_column,
  }));
}
