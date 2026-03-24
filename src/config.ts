const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const MAX_TIMEOUT_MS = 5_000;
const MAX_RESULT_BYTES = 1_000_000;
const SUPPORTED_DATABASE_DIALECTS = ["postgres", "mysql", "sqlite"] as const;

export type DatabaseDialectName = (typeof SUPPORTED_DATABASE_DIALECTS)[number];

export type ReadonlyConfig = {
  defaultLimit: number;
  maxLimit: number;
  timeoutMs: number;
  maxResultBytes: number;
};

export type AppConfig = {
  databaseUrl: string;
  databaseDialect: DatabaseDialectName;
  dbPoolMax: number;
  readonly: ReadonlyConfig;
};

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppConfig(): AppConfig {
  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    databaseDialect: getDatabaseDialect(),
    dbPoolMax: DEFAULT_DB_POOL_MAX,
    readonly: getReadonlyConfig(),
  };
}

export function getReadonlyConfig(): ReadonlyConfig {
  const maxLimit = getOptionalPositiveIntegerEnv("AJAN_SQL_MAX_LIMIT") ?? MAX_LIMIT;
  const defaultLimit = getOptionalPositiveIntegerEnv("AJAN_SQL_DEFAULT_LIMIT") ?? DEFAULT_LIMIT;
  const timeoutMs = getOptionalPositiveIntegerEnv("AJAN_SQL_TIMEOUT_MS") ?? MAX_TIMEOUT_MS;
  const maxResultBytes =
    getOptionalPositiveIntegerEnv("AJAN_SQL_MAX_RESULT_BYTES") ?? MAX_RESULT_BYTES;

  if (maxLimit > MAX_LIMIT) {
    throw new Error(`AJAN_SQL_MAX_LIMIT cannot exceed ${MAX_LIMIT}`);
  }

  if (defaultLimit > maxLimit) {
    throw new Error("AJAN_SQL_DEFAULT_LIMIT cannot exceed AJAN_SQL_MAX_LIMIT");
  }

  if (timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`AJAN_SQL_TIMEOUT_MS cannot exceed ${MAX_TIMEOUT_MS}`);
  }

  if (maxResultBytes > MAX_RESULT_BYTES) {
    throw new Error(`AJAN_SQL_MAX_RESULT_BYTES cannot exceed ${MAX_RESULT_BYTES}`);
  }

  return {
    defaultLimit,
    maxLimit,
    timeoutMs,
    maxResultBytes,
  };
}

function getDatabaseDialect(): DatabaseDialectName {
  const rawValue = process.env.DATABASE_DIALECT?.trim().toLowerCase();

  if (!rawValue) {
    return "postgres";
  }

  if ((SUPPORTED_DATABASE_DIALECTS as readonly string[]).includes(rawValue)) {
    return rawValue as DatabaseDialectName;
  }

  throw new Error(
    `Unsupported DATABASE_DIALECT: ${rawValue}. Supported values: ${SUPPORTED_DATABASE_DIALECTS.join(", ")}`,
  );
}

function getOptionalPositiveIntegerEnv(name: string): number | null {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return null;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const value = Number.parseInt(rawValue, 10);

  if (value <= 0) {
    throw new Error(`${name} must be greater than zero`);
  }

  return value;
}
