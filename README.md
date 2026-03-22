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

These rules should never be bypassed.

## Planned MCP Tools

- `list_tables`
- `describe_table`
- `list_relationships`
- `run_readonly_query`
- `explain_query`
- `sample_rows`

## Planned MCP Resources

- `schema://snapshot`
- `schema://table/{name}`

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

Early development. Current package version is `0.1.0`.

## License

MIT
