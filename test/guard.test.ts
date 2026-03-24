import { afterEach, describe, expect, it } from "vitest";

import {
  configureReadonlyDefaults,
  guardReadonlyQuery,
  quoteIdentifier,
  resetReadonlyDefaults,
} from "../src/guard";

afterEach(() => {
  resetReadonlyDefaults();
});

describe("guardReadonlyQuery", () => {
  it("adds a default LIMIT when missing", () => {
    const result = guardReadonlyQuery("select * from users");

    expect(result.sql).toBe("select * from users LIMIT 100");
    expect(result.limit).toBe(100);
    expect(result.timeoutMs).toBe(5000);
  });

  it("allows an existing LIMIT up to the max", () => {
    const result = guardReadonlyQuery("select * from users limit 5");

    expect(result.sql).toBe("select * from users limit 5");
    expect(result.limit).toBe(5);
  });

  it("rejects non-select queries", () => {
    expect(() => guardReadonlyQuery("delete from users")).toThrow(
      "Only SELECT queries are allowed",
    );
  });

  it("rejects blocked keywords", () => {
    expect(() => guardReadonlyQuery("select drop from users")).toThrow(
      "Blocked SQL keyword detected: DROP",
    );
  });

  it("allows blocked words inside string literals", () => {
    const result = guardReadonlyQuery(
      "select * from users where email like 'dropbox%'",
    );

    expect(result.sql).toBe("select * from users where email like 'dropbox%' LIMIT 100");
  });

  it("allows semicolons inside string literals", () => {
    const result = guardReadonlyQuery(
      "select * from users where note = 'hello;world'",
    );

    expect(result.sql).toBe("select * from users where note = 'hello;world' LIMIT 100");
  });

  it("allows comment markers inside string literals", () => {
    const result = guardReadonlyQuery(
      "select * from users where note = 'contains -- text and /* markers */'",
    );

    expect(result.sql).toBe(
      "select * from users where note = 'contains -- text and /* markers */' LIMIT 100",
    );
  });

  it("allows blocked keywords inside quoted identifiers", () => {
    const result = guardReadonlyQuery(
      "select \"drop\" from users",
    );

    expect(result.sql).toBe("select \"drop\" from users LIMIT 100");
  });

  it("allows common CTE-based SELECT queries", () => {
    const result = guardReadonlyQuery(
      "with active_users as (select * from users) select * from active_users",
    );

    expect(result.sql).toBe(
      "with active_users as (select * from users) select * from active_users LIMIT 100",
    );
  });

  it("rejects multiple statements", () => {
    expect(() =>
      guardReadonlyQuery("select * from users; select * from posts"),
    ).toThrow("Only a single SQL statement is allowed");
  });

  it("rejects comments", () => {
    expect(() => guardReadonlyQuery("select * from users -- comment")).toThrow(
      "SQL comments are not allowed",
    );
  });

  it("rejects LIMIT values above the maximum", () => {
    expect(() => guardReadonlyQuery("select * from users limit 500")).toThrow(
      "Query LIMIT exceeds maximum allowed value of 100",
    );
  });

  it("rejects LIMIT ALL", () => {
    expect(() => guardReadonlyQuery("select * from users limit all")).toThrow(
      "LIMIT ALL is not allowed",
    );
  });

  it("caps timeout at five seconds", () => {
    const result = guardReadonlyQuery("select * from users", {
      timeoutMs: 10_000,
    });

    expect(result.timeoutMs).toBe(5000);
  });

  it("uses configured readonly defaults", () => {
    configureReadonlyDefaults({
      defaultLimit: 25,
      maxLimit: 50,
      timeoutMs: 1200,
      maxResultBytes: 4096,
    });

    const result = guardReadonlyQuery("select * from users");

    expect(result.sql).toBe("select * from users LIMIT 25");
    expect(result.limit).toBe(25);
    expect(result.timeoutMs).toBe(1200);
    expect(result.maxResultBytes).toBe(4096);
  });
});

describe("quoteIdentifier", () => {
  it("quotes valid identifiers", () => {
    expect(quoteIdentifier("users")).toBe("\"users\"");
  });

  it("rejects unsafe identifiers", () => {
    expect(() => quoteIdentifier("users;drop table users")).toThrow(
      "Invalid SQL identifier: users;drop table users",
    );
  });
});
