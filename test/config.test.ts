import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppConfig, getReadonlyConfig, getRequiredEnv } from "../src/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config", () => {
  it("reads DATABASE_URL from the environment", () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");

    expect(getAppConfig()).toEqual({
      databaseUrl: "postgres://localhost/test",
      databaseDialect: "postgres",
      dbPoolMax: 10,
      readonly: {
        defaultLimit: 100,
        maxLimit: 100,
        timeoutMs: 5000,
        maxResultBytes: 1000000,
      },
    });
  });

  it("accepts a supported DATABASE_DIALECT", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("DATABASE_DIALECT", "postgres");

    expect(getAppConfig().databaseDialect).toBe("postgres");
  });

  it("accepts mysql as a supported DATABASE_DIALECT", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test");
    vi.stubEnv("DATABASE_DIALECT", "mysql");

    expect(getAppConfig().databaseDialect).toBe("mysql");
  });

  it("accepts sqlite as a supported DATABASE_DIALECT", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "file:/tmp/ajan.db");
    vi.stubEnv("DATABASE_DIALECT", "sqlite");

    expect(getAppConfig().databaseDialect).toBe("sqlite");
  });

  it("rejects an unsupported DATABASE_DIALECT", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("DATABASE_DIALECT", "oracle");

    expect(() => getAppConfig()).toThrow(
      "Unsupported DATABASE_DIALECT: oracle. Supported values: postgres, mysql, sqlite",
    );
  });

  it("fails fast when a required env variable is missing", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getRequiredEnv("DATABASE_URL")).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("reads optional readonly guard settings from the environment", () => {
    vi.stubEnv("AJAN_SQL_DEFAULT_LIMIT", "25");
    vi.stubEnv("AJAN_SQL_MAX_LIMIT", "50");
    vi.stubEnv("AJAN_SQL_TIMEOUT_MS", "1200");
    vi.stubEnv("AJAN_SQL_MAX_RESULT_BYTES", "4096");

    expect(getReadonlyConfig()).toEqual({
      defaultLimit: 25,
      maxLimit: 50,
      timeoutMs: 1200,
      maxResultBytes: 4096,
    });
  });

  it("rejects readonly defaults above hard safety caps", () => {
    vi.stubEnv("AJAN_SQL_MAX_LIMIT", "101");

    expect(() => getReadonlyConfig()).toThrow(
      "AJAN_SQL_MAX_LIMIT cannot exceed 100",
    );
  });

  it("rejects a default limit above the configured max limit", () => {
    vi.stubEnv("AJAN_SQL_DEFAULT_LIMIT", "75");
    vi.stubEnv("AJAN_SQL_MAX_LIMIT", "50");

    expect(() => getReadonlyConfig()).toThrow(
      "AJAN_SQL_DEFAULT_LIMIT cannot exceed AJAN_SQL_MAX_LIMIT",
    );
  });

  it("rejects non-numeric readonly env values", () => {
    vi.stubEnv("AJAN_SQL_TIMEOUT_MS", "5s");

    expect(() => getReadonlyConfig()).toThrow(
      "AJAN_SQL_TIMEOUT_MS must be a positive integer",
    );
  });
});
