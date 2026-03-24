import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMysqlPool, closeMysqlPool, type MysqlPool } from "../src/db/mysql-pool";
import { createMysqlDialect } from "../src/dialects/mysql";

const isMysqlDialect =
  process.env.DATABASE_DIALECT?.trim().toLowerCase() === "mysql";

const describeMysqlIntegration = isMysqlDialect ? describe : describe.skip;

describeMysqlIntegration("local mysql integration", () => {
  let pool: MysqlPool;
  let dialect: ReturnType<typeof createMysqlDialect>;
  let databaseUrl: string;

  beforeAll(() => {
    databaseUrl = process.env.DATABASE_URL ?? "mysql://ajan:ajan@127.0.0.1:33068/ajan_mysql_test";
    pool = createMysqlPool({
      uri: databaseUrl,
    });
    dialect = createMysqlDialect(pool);
  });

  afterAll(async () => {
    await closeMysqlPool(pool);
  });

  it("lists seeded tables", async () => {
    const tables = await dialect.listTables();

    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ schema: "ajan_mysql_test", name: "users" }),
        expect.objectContaining({ schema: "ajan_mysql_test", name: "posts" }),
      ]),
    );
  });

  it("describes the users table", async () => {
    const description = await dialect.describeTable("users", "ajan_mysql_test");

    expect(description).not.toBeNull();
    expect(description?.columns.map((column) => column.name)).toEqual([
      "id",
      "email",
      "full_name",
    ]);
    expect(description?.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "PRIMARY",
          columns: ["id"],
          isPrimary: true,
        }),
      ]),
    );
  });

  it("finds the posts -> users foreign key", async () => {
    const relationships = await dialect.listRelationships();

    expect(relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTable: "posts",
          sourceColumn: "user_id",
          targetTable: "users",
          targetColumn: "id",
        }),
      ]),
    );
  });

  it("executes a readonly select query", async () => {
    const result = await dialect.runReadonlyQuery(
      "select email from users order by id limit 2",
    );

    expect(result.rowCount).toBe(2);
    expect(result.rows).toEqual([
      { email: "ada@example.com" },
      { email: "grace@example.com" },
    ]);
  });

  it("returns a query execution plan", async () => {
    const result = await dialect.explainReadonlyQuery(
      "select * from posts limit 1",
    );

    expect(result.sql).toBe("select * from posts limit 1");
    expect(result.plan).toEqual(expect.any(Object));
  });

  it("returns sample rows from a table", async () => {
    const result = await dialect.sampleRows("users", "ajan_mysql_test", 1);

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      email: expect.any(String),
      full_name: expect.any(String),
    });
  });
});
