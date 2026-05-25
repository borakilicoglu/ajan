export type QueryAuditConfig = {
  enabled: boolean;
};

export type QueryAuditEvent = {
  operation: "run_readonly_query" | "explain_query";
  status: "allowed" | "rejected";
  sql: string;
  guardedSql?: string;
  durationMs?: number;
  rowCount?: number;
  error?: string;
};

let queryAuditConfig: QueryAuditConfig = {
  enabled: false,
};

export function configureQueryAudit(config: QueryAuditConfig): void {
  queryAuditConfig = { ...config };
}

export function getQueryAuditConfig(): QueryAuditConfig {
  return { ...queryAuditConfig };
}

export function auditQueryEvent(event: QueryAuditEvent): void {
  if (!queryAuditConfig.enabled) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  console.error(`[ajan-sql:audit] ${JSON.stringify(payload)}`);
}
