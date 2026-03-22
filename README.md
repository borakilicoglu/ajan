# ajan

AI-safe MCP server for schema-aware, read-only SQL access.

## Overview

`ajan` is an npm package for running an MCP server over stdio with a PostgreSQL backend.

The project is designed as:

> psql + schema awareness + AI-safe guard layer

## Goals

- Safe, read-only database access for AI agents
- Schema inspection and table discovery
- Reliable PostgreSQL query execution with strict guardrails
- Simple, maintainable implementation

## Tech Stack

- Node.js
- TypeScript
- MCP TypeScript SDK v1.x
- PostgreSQL via `pg`

## Security Model

All executed queries must follow these rules:

- `SELECT` only
- Reject `INSERT`
- Reject `UPDATE`
- Reject `DELETE`
- Reject `DROP`
- Reject `ALTER`
- Reject `TRUNCATE`
- Enforce `LIMIT` with a default of `100`
- Enforce query timeout with a maximum of `5` seconds
- Enforce maximum result size
- Reject multi-statement SQL
- Reject SQL comments

These rules should never be bypassed.

## Available MCP Tools

- `list_tables`
- `describe_table`
- `list_relationships`
- `run_readonly_query`
- `explain_query`
- `sample_rows`

## Available MCP Resources

- `schema://snapshot`
- `schema://table/{name}`

## Local Usage

Start the server with a PostgreSQL connection string:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npm run dev
```

Or build and run the compiled server:

```bash
npm run build
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npm start
```

## Client Configuration

For MCP clients that launch local stdio servers, point the command to the built CLI and provide `DATABASE_URL`:

```json
{
  "mcpServers": {
    "ajan": {
      "command": "node",
      "args": ["/absolute/path/to/ajan/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```

## Integration Testing

The repository supports local PostgreSQL integration testing during development, but any Docker compose files or seeded local test databases can remain untracked and machine-local.

## Development Principles

- Keep functions small and composable
- Avoid side effects
- Route all DB logic through `db/`
- Route all query execution through `query-runner`
- Route all validation through `guard`
- Prefer simple working code over abstraction
- Prioritize correctness, safety, and clarity

## CLI Behavior

The CLI will:

- Start the MCP server over stdio
- Read `DATABASE_URL` from the environment
- Fail fast if `DATABASE_URL` is missing

## Status

Early development. Schema inspection, readonly query execution, query explain, and sample row tools are implemented. The CLI is publish-ready for npm packaging, and current package version is `0.1.0`.

## License

MIT
