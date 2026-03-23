import { afterEach, describe, expect, it } from "vitest";

import {
  closeSqliteDatabase,
  createSqliteDatabase,
} from "../src/db/sqlite-db";
import { createSqliteDialect } from "../src/dialects/sqlite";

describe("createSqliteDialect", () => {
  afterEach(() => {
    // no-op placeholder to keep suite structure explicit
  });

  it("supports schema inspection and readonly execution", async () => {
    const database = createSqliteDatabase({ filename: ":memory:" });
    const dialect = createSqliteDialect(database);

    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL
      );
      CREATE INDEX idx_posts_user_id ON posts(user_id);
      INSERT INTO users (email, full_name) VALUES
        ('ada@example.com', 'Ada Lovelace'),
        ('grace@example.com', 'Grace Hopper');
      INSERT INTO posts (user_id, title) VALUES
        (1, 'Analytical Engine'),
        (2, 'Compilers');
    `);

    await expect(dialect.listTables()).resolves.toEqual([
      { schema: "main", name: "posts", comment: null, estimatedRowCount: null },
      { schema: "main", name: "users", comment: null, estimatedRowCount: null },
    ]);

    const description = await dialect.describeTable("posts");
    expect(description).toMatchObject({
      schema: "main",
      name: "posts",
      columns: expect.arrayContaining([
        expect.objectContaining({
          name: "user_id",
          references: {
            schema: "main",
            table: "users",
            column: "id",
          },
        }),
      ]),
      indexes: expect.arrayContaining([
        expect.objectContaining({
          name: "idx_posts_user_id",
          columns: ["user_id"],
        }),
      ]),
    });

    await expect(dialect.listRelationships()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTable: "posts",
          sourceColumn: "user_id",
          targetTable: "users",
          targetColumn: "id",
        }),
      ]),
    );

    const queryResult = await dialect.runReadonlyQuery(
      "select email from users order by id limit 2",
    );
    expect(queryResult.rows).toEqual([
      { email: "ada@example.com" },
      { email: "grace@example.com" },
    ]);

    const sampleResult = await dialect.sampleRows("users", undefined, 1, ["email"]);
    expect(sampleResult.rows).toEqual([{ email: "ada@example.com" }]);

    const explainResult = await dialect.explainReadonlyQuery(
      "select * from posts limit 1",
    );
    expect(explainResult.plan).toEqual(expect.any(Array));
    expect(explainResult.summary?.nodeType).toEqual(expect.any(String));

    closeSqliteDatabase(database);
  });
});
