const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const MAX_TIMEOUT_MS = 5_000;
const MAX_RESULT_BYTES = 1_000_000;

const BLOCKED_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
];

export type GuardedReadonlyQuery = {
  sql: string;
  limit: number;
  timeoutMs: number;
  maxResultBytes: number;
};

export type ReadonlyGuardOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  timeoutMs?: number;
  maxResultBytes?: number;
};

export function getReadonlyDefaults() {
  return {
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    timeoutMs: MAX_TIMEOUT_MS,
    maxResultBytes: MAX_RESULT_BYTES,
  };
}

export function guardReadonlyQuery(
  sql: string,
  options: ReadonlyGuardOptions = {},
): GuardedReadonlyQuery {
  const defaults = getReadonlyDefaults();
  const defaultLimit = options.defaultLimit ?? defaults.defaultLimit;
  const maxLimit = options.maxLimit ?? defaults.maxLimit;
  const timeoutMs = Math.min(options.timeoutMs ?? defaults.timeoutMs, defaults.timeoutMs);
  const maxResultBytes = options.maxResultBytes ?? defaults.maxResultBytes;

  const normalizedSql = normalizeSql(sql);
  const scrubbedSql = scrubSqlForGuards(normalizedSql);

  assertSingleStatement(scrubbedSql);
  assertNoSqlComments(scrubbedSql);
  assertSelectOnly(scrubbedSql);
  assertNoBlockedKeywords(scrubbedSql);
  assertNoUnboundedLimit(scrubbedSql);

  const limitMatch = normalizedSql.match(/\blimit\s+(\d+)\b/i);
  const parsedLimit = limitMatch ? Number.parseInt(limitMatch[1], 10) : null;

  if (parsedLimit !== null && parsedLimit > maxLimit) {
    throw new Error(`Query LIMIT exceeds maximum allowed value of ${maxLimit}`);
  }

  return {
    sql: parsedLimit === null ? `${normalizedSql} LIMIT ${defaultLimit}` : normalizedSql,
    limit: parsedLimit ?? defaultLimit,
    timeoutMs,
    maxResultBytes,
  };
}

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function normalizeSql(sql: string): string {
  const trimmed = sql.trim().replace(/;+$/, "").trim();

  if (!trimmed) {
    throw new Error("SQL query is required");
  }

  return trimmed;
}

function assertSingleStatement(sql: string): void {
  if (sql.includes(";")) {
    throw new Error("Only a single SQL statement is allowed");
  }
}

function assertNoSqlComments(sql: string): void {
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    throw new Error("SQL comments are not allowed");
  }
}

function assertSelectOnly(sql: string): void {
  if (!/^(select|with)\b/i.test(sql)) {
    throw new Error("Only SELECT queries are allowed");
  }

  if (/^with\b/i.test(sql) && !/\bselect\b/i.test(sql)) {
    throw new Error("Only SELECT queries are allowed");
  }
}

function assertNoBlockedKeywords(sql: string): void {
  for (const keyword of BLOCKED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");

    if (pattern.test(sql)) {
      throw new Error(`Blocked SQL keyword detected: ${keyword.toUpperCase()}`);
    }
  }
}

function assertNoUnboundedLimit(sql: string): void {
  if (/\blimit\s+all\b/i.test(sql)) {
    throw new Error("LIMIT ALL is not allowed");
  }
}

function scrubSqlForGuards(sql: string): string {
  let result = "";
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (current === "'") {
      result += "''";
      index += 1;

      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }

        if (sql[index] === "'") {
          index += 1;
          break;
        }

        index += 1;
      }

      continue;
    }

    if (current === "\"" || current === "`") {
      result += current + current;
      index += 1;

      while (index < sql.length) {
        if (sql[index] === current && sql[index + 1] === current) {
          index += 2;
          continue;
        }

        if (sql[index] === current) {
          index += 1;
          break;
        }

        index += 1;
      }

      continue;
    }

    if (current === "[" ) {
      result += "[]";
      index += 1;

      while (index < sql.length) {
        if (sql[index] === "]") {
          index += 1;
          break;
        }

        index += 1;
      }

      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}
