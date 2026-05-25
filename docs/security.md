# Security

## Guard Rules

All executed queries must obey these rules:

- `SELECT` only
- reject `INSERT`
- reject `UPDATE`
- reject `DELETE`
- reject `DROP`
- reject `ALTER`
- reject `TRUNCATE`
- reject multi-statement SQL
- reject SQL comments
- enforce default `LIMIT 100`
- reject `LIMIT` values above `100`
- cap statement timeout at `5` seconds
- cap maximum result size
- enforce optional schema/table access policies

## Sandboxing & Approvals

`ajan-sql` sandboxes database access at the query layer. All query execution must pass through the readonly guard and query runner before reaching the database.

Human approval workflows are the responsibility of the MCP host or client. `ajan-sql` does not implement a separate approval UI or per-query approval prompt.

Use a database user with readonly permissions in production. The SQL guard reduces risk, but database permissions should remain the final enforcement layer.

## Access Policy

Readonly access can be narrowed with environment variables:

```bash
AJAN_SQL_ALLOWED_SCHEMAS=public,analytics
AJAN_SQL_ALLOWED_TABLES=public.users,analytics.events
AJAN_SQL_DENIED_TABLES=public.audit_logs
```

If an allowlist is configured, referenced tables must match an allowed schema or table. Denied tables always take precedence.

## Audit Logging

Set `AJAN_SQL_AUDIT_LOG=true` to write query audit events to stderr. Audit events include the operation, allowed/rejected status, original SQL, guarded SQL when available, duration, row count, and rejection error.

Audit logs use stderr so the MCP stdio transport on stdout remains clean.

## Design Intent

The project is built as:

> psql + schema awareness + AI-safe guard layer

All database logic flows through:

- `db/`
- `guard/`
- `query-runner/`
