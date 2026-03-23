import { describe, expect, it, vi } from "vitest";

import { getAppConfig, getRequiredEnv } from "../src/config";

describe("config", () => {
  it("reads DATABASE_URL from the environment", () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");

    expect(getAppConfig()).toEqual({
      databaseUrl: "postgres://localhost/test",
      databaseDialect: "postgres",
      dbPoolMax: 10,
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
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getRequiredEnv("DATABASE_URL")).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });
});
