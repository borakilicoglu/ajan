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

export type ReadonlyAccessPolicy = {
  allowedSchemas: string[];
  allowedTables: string[];
  deniedTables: string[];
};

const DEFAULT_ACCESS_POLICY: ReadonlyAccessPolicy = {
  allowedSchemas: [],
  allowedTables: [],
  deniedTables: [],
};

let readonlyDefaults = {
  defaultLimit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT,
  timeoutMs: MAX_TIMEOUT_MS,
  maxResultBytes: MAX_RESULT_BYTES,
  accessPolicy: DEFAULT_ACCESS_POLICY,
};

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
  accessPolicy?: ReadonlyAccessPolicy;
};

export function getReadonlyDefaults() {
  return {
    ...readonlyDefaults,
    accessPolicy: copyAccessPolicy(readonlyDefaults.accessPolicy),
  };
}

export function configureReadonlyDefaults(
  options: ReadonlyGuardOptions = {},
): void {
  readonlyDefaults = {
    defaultLimit: options.defaultLimit ?? DEFAULT_LIMIT,
    maxLimit: options.maxLimit ?? MAX_LIMIT,
    timeoutMs: options.timeoutMs ?? MAX_TIMEOUT_MS,
    maxResultBytes: options.maxResultBytes ?? MAX_RESULT_BYTES,
    accessPolicy: normalizeAccessPolicy(options.accessPolicy ?? DEFAULT_ACCESS_POLICY),
  };
}

export function resetReadonlyDefaults(): void {
  configureReadonlyDefaults();
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
  const accessPolicy = normalizeAccessPolicy(
    options.accessPolicy ?? defaults.accessPolicy,
  );

  const normalizedSql = normalizeSql(sql);
  const scrubbedSql = scrubSqlForGuards(normalizedSql);

  assertSingleStatement(scrubbedSql);
  assertNoSqlComments(scrubbedSql);
  assertSelectOnly(scrubbedSql);
  assertNoBlockedKeywords(scrubbedSql);
  assertNoUnboundedLimit(scrubbedSql);
  assertAccessPolicy(normalizedSql, accessPolicy);

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

function assertAccessPolicy(sql: string, policy: ReadonlyAccessPolicy): void {
  if (!hasAccessPolicy(policy)) {
    return;
  }

  const hasAllowPolicy = policy.allowedSchemas.length > 0 || policy.allowedTables.length > 0;

  for (const reference of extractTableReferences(sql)) {
    if (isDeniedTable(reference, policy)) {
      throw new Error(
        `Table access denied by readonly policy: ${formatTableReference(reference)}`,
      );
    }

    if (!hasAllowPolicy) {
      continue;
    }

    if (isAllowedTable(reference, policy) || isAllowedSchema(reference, policy)) {
      continue;
    }

    throw new Error(
      `Table access denied by readonly policy: ${formatTableReference(reference)}`,
    );
  }
}

type SqlToken = {
  value: string;
  kind: "identifier" | "symbol";
};

type TableReference = {
  schema: string | null;
  table: string;
};

function extractTableReferences(sql: string): TableReference[] {
  const tokens = tokenizeSql(sql);
  const cteNames = collectCteNames(tokens);
  const references: TableReference[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!isKeyword(token, "from") && !isKeyword(token, "join")) {
      continue;
    }

    const nextIndex = index + 1;

    if (tokens[nextIndex]?.value === "(") {
      continue;
    }

    const reference = readTableReference(tokens, nextIndex);

    if (!reference) {
      continue;
    }

    if (reference.schema === null && cteNames.has(reference.table)) {
      continue;
    }

    references.push(reference);
  }

  return references;
}

function collectCteNames(tokens: SqlToken[]): Set<string> {
  const names = new Set<string>();

  if (!isKeyword(tokens[0], "with")) {
    return names;
  }

  for (let index = 1; index < tokens.length - 1; index += 1) {
    const token = tokens[index];

    if (isKeyword(token, "select")) {
      break;
    }

    if (token.kind !== "identifier") {
      continue;
    }

    const next = tokens[index + 1];

    if (isKeyword(next, "as") || next?.value === "(") {
      names.add(normalizePolicyValue(token.value));
    }
  }

  return names;
}

function readTableReference(
  tokens: SqlToken[],
  startIndex: number,
): TableReference | null {
  const parts: string[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];

    if (!token || token.kind !== "identifier") {
      break;
    }

    parts.push(normalizePolicyValue(token.value));

    if (tokens[index + 1]?.value !== ".") {
      break;
    }

    index += 2;
  }

  if (parts.length === 0) {
    return null;
  }

  const table = parts[parts.length - 1];
  const schema = parts.length > 1 ? parts[parts.length - 2] : null;

  return { schema, table };
}

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    if (current === "'") {
      index = skipStringLiteral(sql, index);
      continue;
    }

    if (current === "\"" || current === "`" || current === "[") {
      const { value, nextIndex } = readQuotedIdentifier(sql, index);
      tokens.push({ value, kind: "identifier" });
      index = nextIndex;
      continue;
    }

    if (/[a-zA-Z_]/.test(current)) {
      const start = index;
      index += 1;

      while (index < sql.length && /[a-zA-Z0-9_$]/.test(sql[index])) {
        index += 1;
      }

      tokens.push({ value: sql.slice(start, index), kind: "identifier" });
      continue;
    }

    if (current === "." || current === "(" || current === ")" || current === ",") {
      tokens.push({ value: current, kind: "symbol" });
    }

    index += 1;
  }

  return tokens;
}

function skipStringLiteral(sql: string, startIndex: number): number {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }

    if (sql[index] === "'") {
      return index + 1;
    }

    index += 1;
  }

  return index;
}

function readQuotedIdentifier(
  sql: string,
  startIndex: number,
): { value: string; nextIndex: number } {
  const opener = sql[startIndex];
  const closer = opener === "[" ? "]" : opener;
  let value = "";
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === closer && sql[index + 1] === closer) {
      value += closer;
      index += 2;
      continue;
    }

    if (sql[index] === closer) {
      return { value, nextIndex: index + 1 };
    }

    value += sql[index];
    index += 1;
  }

  return { value, nextIndex: index };
}

function hasAccessPolicy(policy: ReadonlyAccessPolicy): boolean {
  return (
    policy.allowedSchemas.length > 0 ||
    policy.allowedTables.length > 0 ||
    policy.deniedTables.length > 0
  );
}

function isDeniedTable(
  reference: TableReference,
  policy: ReadonlyAccessPolicy,
): boolean {
  return matchesTableList(reference, policy.deniedTables);
}

function isAllowedTable(
  reference: TableReference,
  policy: ReadonlyAccessPolicy,
): boolean {
  return matchesTableList(reference, policy.allowedTables);
}

function isAllowedSchema(
  reference: TableReference,
  policy: ReadonlyAccessPolicy,
): boolean {
  return (
    policy.allowedSchemas.length > 0 &&
    (reference.schema !== null && policy.allowedSchemas.includes(reference.schema))
  );
}

function matchesTableList(reference: TableReference, tableList: string[]): boolean {
  const tableName = reference.table;
  const qualifiedName = reference.schema
    ? `${reference.schema}.${reference.table}`
    : null;

  return tableList.some((entry) => entry === tableName || entry === qualifiedName);
}

function formatTableReference(reference: TableReference): string {
  return reference.schema ? `${reference.schema}.${reference.table}` : reference.table;
}

function isKeyword(token: SqlToken | undefined, keyword: string): boolean {
  return (
    token?.kind === "identifier" &&
    normalizePolicyValue(token.value) === keyword
  );
}

function normalizeAccessPolicy(policy: ReadonlyAccessPolicy): ReadonlyAccessPolicy {
  return {
    allowedSchemas: policy.allowedSchemas.map(normalizePolicyValue).filter(Boolean),
    allowedTables: policy.allowedTables.map(normalizePolicyValue).filter(Boolean),
    deniedTables: policy.deniedTables.map(normalizePolicyValue).filter(Boolean),
  };
}

function copyAccessPolicy(policy: ReadonlyAccessPolicy): ReadonlyAccessPolicy {
  return {
    allowedSchemas: [...policy.allowedSchemas],
    allowedTables: [...policy.allowedTables],
    deniedTables: [...policy.deniedTables],
  };
}

function normalizePolicyValue(value: string): string {
  return value.trim().toLowerCase();
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
