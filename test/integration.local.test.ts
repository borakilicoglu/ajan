import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { Pool as MysqlPool } from "mysql2/promise";
import type Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeMysqlPool, createMysqlPool } from "../src/db/mysql-pool";
import { closeDbPool, createDbPool } from "../src/db/pool";
import { closeSqliteDatabase, createSqliteDatabase } from "../src/db/sqlite-db";
import type { DatabaseDialectName } from "../src/config";
import { createMysqlDialect } from "../src/dialects/mysql";
import { createPostgresDialect } from "../src/dialects/postgres";
import { createSqliteDialect } from "../src/dialects/sqlite";
import type { DatabaseDialect } from "../src/dialects/types";

type IntegrationContext = {
  dialect: DatabaseDialect;
  dialectName: DatabaseDialectName;
  schemaName: string;
  usersTableName: string;
  postsTableName: string;
  cleanup: () => Promise<void>;
};

const dialectName = getIntegrationDialect();

describe(`local integration (${dialectName})`, () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await createIntegrationContext(dialectName);
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it("lists tables created for the integration fixture", async () => {
    const tables = await context.dialect.listTables();

    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema: context.schemaName,
          name: context.usersTableName,
        }),
        expect.objectContaining({
          schema: context.schemaName,
          name: context.postsTableName,
        }),
      ]),
    );
  });

  it("describes the seeded users table", async () => {
    const description = await context.dialect.describeTable(
      context.usersTableName,
      context.schemaName,
    );

    expect(description).not.toBeNull();
    expect(description?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "id",
          isPrimaryKey: true,
        }),
        expect.objectContaining({
          name: "email",
          isUnique: true,
        }),
      ]),
    );
  });

  it("lists the foreign key relationship between fixture tables", async () => {
    const relationships = await context.dialect.listRelationships();

    expect(relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSchema: context.schemaName,
          sourceTable: context.postsTableName,
          sourceColumn: "user_id",
          targetSchema: context.schemaName,
          targetTable: context.usersTableName,
          targetColumn: "id",
        }),
      ]),
    );
  });

  it("runs a readonly query against the seeded fixture data", async () => {
    const result = await context.dialect.runReadonlyQuery(
      buildSelectUsersSql(context),
    );

    expect(result.rowCount).toBe(2);
    expect(result.rows).toEqual([
      { id: 1, email: "ada@example.com" },
      { id: 2, email: "linus@example.com" },
    ]);
  });

  it("returns an execution plan for readonly queries", async () => {
    const result = await context.dialect.explainReadonlyQuery(
      buildExplainTargetSql(context),
    );

    expect(result.sql.toLowerCase()).toContain("select");
    expect(result.plan).toBeTruthy();
    expect(result.summary).not.toBeNull();
  });

  it("samples rows through the dialect helper", async () => {
    const result = await context.dialect.sampleRows(
      context.usersTableName,
      context.schemaName,
      1,
      ["email"],
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ email: "ada@example.com" }]);
  });

  it("rejects non-select statements through the readonly guard", async () => {
    await expect(
      context.dialect.runReadonlyQuery(
        buildDeleteSql(context),
      ),
    ).rejects.toThrow("Only SELECT queries are allowed");
  });
});

function getIntegrationDialect(): DatabaseDialectName {
  const rawValue = process.env.DATABASE_DIALECT?.trim().toLowerCase();

  if (!rawValue) {
    return "sqlite";
  }

  if (rawValue === "postgres" || rawValue === "mysql" || rawValue === "sqlite") {
    return rawValue;
  }

  throw new Error(`Unsupported DATABASE_DIALECT for local integration tests: ${rawValue}`);
}

async function createIntegrationContext(
  name: DatabaseDialectName,
): Promise<IntegrationContext> {
  if (name === "postgres") {
    return createPostgresIntegrationContext();
  }

  if (name === "mysql") {
    return createMysqlIntegrationContext();
  }

  return createSqliteIntegrationContext();
}

async function createPostgresIntegrationContext(): Promise<IntegrationContext> {
  const databaseUrl = getRequiredIntegrationDatabaseUrl("postgres");
  const pool = createDbPool({
    connectionString: databaseUrl,
    max: 1,
  });
  const schemaName = `ajan_sql_it_${randomSuffix()}`;
  const usersTableName = "users";
  const postsTableName = "posts";

  await pool.query(`create schema ${quotePostgresIdentifier(schemaName)}`);
  await pool.query(`
    create table ${quotePostgresIdentifier(schemaName)}.${quotePostgresIdentifier(usersTableName)} (
      id bigint generated always as identity primary key,
      email text not null unique
    )
  `);
  await pool.query(`
    create table ${quotePostgresIdentifier(schemaName)}.${quotePostgresIdentifier(postsTableName)} (
      id bigint generated always as identity primary key,
      user_id bigint not null references ${quotePostgresIdentifier(schemaName)}.${quotePostgresIdentifier(usersTableName)} (id),
      title text not null
    )
  `);
  await pool.query(`
    insert into ${quotePostgresIdentifier(schemaName)}.${quotePostgresIdentifier(usersTableName)} (email)
    values ('ada@example.com'), ('linus@example.com')
  `);
  await pool.query(`
    insert into ${quotePostgresIdentifier(schemaName)}.${quotePostgresIdentifier(postsTableName)} (user_id, title)
    values (1, 'First post'), (2, 'Second post')
  `);

  return {
    dialect: createPostgresDialect(pool),
    dialectName: "postgres",
    schemaName,
    usersTableName,
    postsTableName,
    cleanup: async () => {
      await pool.query(`drop schema if exists ${quotePostgresIdentifier(schemaName)} cascade`);
      await closeDbPool(pool);
    },
  };
}

async function createMysqlIntegrationContext(): Promise<IntegrationContext> {
  const databaseUrl = getRequiredIntegrationDatabaseUrl("mysql");
  const pool = createMysqlPool({
    uri: databaseUrl,
    connectionLimit: 1,
  });
  const schemaName = await getMysqlCurrentDatabase(pool);
  const suffix = randomSuffix();
  const usersTableName = `ajan_sql_it_${suffix}_users`;
  const postsTableName = `ajan_sql_it_${suffix}_posts`;
  const constraintName = `fk_${suffix}_posts_user`;

  await pool.query(`
    create table ${quoteMysqlIdentifier(usersTableName)} (
      id bigint auto_increment primary key,
      email varchar(255) not null unique
    )
  `);
  await pool.query(`
    create table ${quoteMysqlIdentifier(postsTableName)} (
      id bigint auto_increment primary key,
      user_id bigint not null,
      title varchar(255) not null,
      constraint ${quoteMysqlIdentifier(constraintName)}
        foreign key (user_id) references ${quoteMysqlIdentifier(usersTableName)} (id)
    )
  `);
  await pool.query(`
    insert into ${quoteMysqlIdentifier(usersTableName)} (email)
    values ('ada@example.com'), ('linus@example.com')
  `);
  await pool.query(`
    insert into ${quoteMysqlIdentifier(postsTableName)} (user_id, title)
    values (1, 'First post'), (2, 'Second post')
  `);

  return {
    dialect: createMysqlDialect(pool),
    dialectName: "mysql",
    schemaName,
    usersTableName,
    postsTableName,
    cleanup: async () => {
      await pool.query(`drop table if exists ${quoteMysqlIdentifier(postsTableName)}`);
      await pool.query(`drop table if exists ${quoteMysqlIdentifier(usersTableName)}`);
      await closeMysqlPool(pool);
    },
  };
}

async function createSqliteIntegrationContext(): Promise<IntegrationContext> {
  const filepath = getSqliteIntegrationFilepath();
  const database = createSqliteDatabase({
    filename: filepath,
  });
  const usersTableName = "users";
  const postsTableName = "posts";

  database.exec("pragma foreign_keys = on");
  database.exec(`
    create table ${quoteSqliteIdentifier(usersTableName)} (
      id integer primary key,
      email text not null unique
    );
    create table ${quoteSqliteIdentifier(postsTableName)} (
      id integer primary key,
      user_id integer not null references ${quoteSqliteIdentifier(usersTableName)} (id),
      title text not null
    );
    insert into ${quoteSqliteIdentifier(usersTableName)} (id, email)
    values (1, 'ada@example.com'), (2, 'linus@example.com');
    insert into ${quoteSqliteIdentifier(postsTableName)} (id, user_id, title)
    values (1, 1, 'First post'), (2, 2, 'Second post');
  `);

  return {
    dialect: createSqliteDialect(database),
    dialectName: "sqlite",
    schemaName: "main",
    usersTableName,
    postsTableName,
    cleanup: async () => {
      closeSqliteDatabase(database);

      if (existsSync(filepath)) {
        rmSync(filepath);
      }
    },
  };
}

function buildSelectUsersSql(context: IntegrationContext): string {
  return [
    "select id, email",
    `from ${qualifyTable(context, context.usersTableName)}`,
    "order by id",
    "limit 2",
  ].join(" ");
}

function buildExplainTargetSql(context: IntegrationContext): string {
  return [
    "select *",
    `from ${qualifyTable(context, context.postsTableName)}`,
    "where user_id = 1",
    "limit 1",
  ].join(" ");
}

function buildDeleteSql(context: IntegrationContext): string {
  return `delete from ${qualifyTable(context, context.usersTableName)}`;
}

function qualifyTable(context: IntegrationContext, tableName: string): string {
  if (context.dialectName === "postgres") {
    return `${quotePostgresIdentifier(context.schemaName)}.${quotePostgresIdentifier(tableName)}`;
  }

  if (context.dialectName === "mysql") {
    return `${quoteMysqlIdentifier(context.schemaName)}.${quoteMysqlIdentifier(tableName)}`;
  }

  return quoteSqliteIdentifier(tableName);
}

function getRequiredIntegrationDatabaseUrl(dialectName: "postgres" | "mysql"): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is required for ${dialectName} local integration tests`);
  }

  return databaseUrl;
}

function getSqliteIntegrationFilepath(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  return join(tmpdir(), `ajan-sql-integration-${randomSuffix()}.sqlite`);
}

async function getMysqlCurrentDatabase(pool: MysqlPool): Promise<string> {
  const [rows] = await pool.query<Array<{ current_database?: string }>>(
    "select database() as current_database",
  );
  const name = rows[0]?.current_database;

  if (!name) {
    throw new Error("Unable to determine current MySQL database for integration tests");
  }

  return String(name);
}

function quotePostgresIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function quoteMysqlIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid MySQL identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function quoteSqliteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQLite identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function randomSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}
