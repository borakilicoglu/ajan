const DEFAULT_DB_POOL_MAX = 10;
const SUPPORTED_DATABASE_DIALECTS = ["postgres", "mysql", "sqlite"] as const;

export type DatabaseDialectName = (typeof SUPPORTED_DATABASE_DIALECTS)[number];

export type AppConfig = {
  databaseUrl: string;
  databaseDialect: DatabaseDialectName;
  dbPoolMax: number;
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
