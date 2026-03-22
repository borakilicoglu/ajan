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

## Local Test Database

A local-only Docker setup can be used for integration testing during development:

```bash
docker compose -f docker-compose.local.yml up -d
DATABASE_URL=postgres://ajan:ajan@127.0.0.1:54329/ajan_test npx vitest run --config vitest.local.config.ts
docker compose -f docker-compose.local.yml down
```

These files are intentionally kept local and are not part of the Git-tracked project files.

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

Early development. Schema inspection, readonly query execution, query explain, and sample row tools are implemented. Current package version is `0.1.0`.

## License

MIT
