<p align="center">
  <img src="./assets/cover.svg" alt="ajan-sql cover" width="860" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ajan-sql"><img src="https://img.shields.io/npm/v/ajan-sql" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/ajan-sql"><img src="https://img.shields.io/npm/dm/ajan-sql" alt="npm downloads" /></a>
  <a href="https://borakilicoglu.github.io/ajan-sql/"><img src="https://img.shields.io/badge/docs-vitepress-5d98ea" alt="docs" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="license" /></a>
</p>

<p align="center">
  AI-safe MCP server for schema-aware, read-only SQL access.
</p>

## Overview

`ajan-sql` is an npm package for running an MCP server over stdio with SQL database backends.

The project now provides multi-dialect SQL support, with PostgreSQL, MySQL, and SQLite available behind the same MCP surface.

## Goals

- Safe, read-only database access for AI agents
- Schema inspection and table discovery
- Reliable read-only SQL query execution with strict guardrails
- Simple, maintainable implementation

## Tech Stack

- Node.js
- TypeScript
- MCP TypeScript SDK v1.x
- PostgreSQL via `pg`
- MySQL via `mysql2`
- SQLite via `better-sqlite3`

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

## Tool Matrix

| Tool | Purpose | Inputs | Guarded | Structured Output |
| --- | --- | --- | --- | --- |
| `list_tables` | List visible database tables with comments and row estimates | None | N/A | `TableSummary[]` |
| `describe_table` | Describe columns and types for one table | `name`, optional `schema` | N/A | `TableDescription` |
| `list_relationships` | List foreign key relationships | None | N/A | `RelationshipSummary[]` |
| `run_readonly_query` | Execute a readonly `SELECT` query | `sql` | Yes | `ReadonlyQueryResult` |
| `explain_query` | Return JSON execution plan for a readonly query | `sql` | Yes | `ExplainQueryResult` |
| `sample_rows` | Return a limited sample from a table | `name`, optional `schema`, optional `limit`, optional `columns` | Yes | `ReadonlyQueryResult` |

## Structured Output

All tools return:

- `content` for a short human-readable summary
- `structuredContent` for machine-friendly MCP client consumption

For tool failures, `structuredContent` returns a standard error object with `ok: false`, plus `error.code` and `error.message`.

Detailed payload examples are available in [docs/tools.md](./docs/tools.md).

## Available MCP Resources

- `schema://snapshot`
- `schema://table/{name}`

Detailed resource payload examples are available in [docs/resources.md](./docs/resources.md).

## Install

Install the CLI globally from npm:

```bash
npm install -g ajan-sql
```

Run it with a PostgreSQL, MySQL, or SQLite connection target:

```bash
DATABASE_DIALECT=postgres \
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB ajan-sql
```

MySQL example:

```bash
DATABASE_DIALECT=mysql \
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DB ajan-sql
```

SQLite example:

```bash
DATABASE_DIALECT=sqlite \
DATABASE_URL=file:/absolute/path/to/database.sqlite ajan-sql
```

`DATABASE_DIALECT` defaults to `postgres`. Supported values today are `postgres`, `mysql`, and `sqlite`.

Optional readonly guard env vars:

- `AJAN_SQL_DEFAULT_LIMIT`
- `AJAN_SQL_MAX_LIMIT`
- `AJAN_SQL_TIMEOUT_MS`
- `AJAN_SQL_MAX_RESULT_BYTES`

These can only tighten the defaults. They cannot exceed the built-in hard caps of `LIMIT 100`, `5000ms`, and `1000000` bytes.

## Local Development

Start the server with a PostgreSQL, MySQL, or SQLite connection target:

```bash
DATABASE_DIALECT=postgres \
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npm run dev
```

Or build and run the compiled server:

```bash
npm run build
DATABASE_DIALECT=postgres \
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npm start
```

SQLite development example:

```bash
DATABASE_DIALECT=sqlite \
DATABASE_URL=file:/absolute/path/to/database.sqlite npm run dev
```

## Client Configuration

For MCP clients that launch globally installed stdio servers:

```json
{
  "mcpServers": {
    "ajan-sql": {
      "command": "ajan-sql",
      "env": {
        "DATABASE_DIALECT": "postgres",
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```

For repository-local development builds, point the command to the built CLI and provide `DATABASE_URL`:

```json
{
  "mcpServers": {
    "ajan-sql": {
      "command": "node",
      "args": ["/absolute/path/to/ajan-sql/dist/index.js"],
      "env": {
        "DATABASE_DIALECT": "postgres",
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```

## Integration Testing

The repository supports local integration testing during development, but any Docker compose files or seeded local test databases can remain untracked and machine-local.

## Project Docs

- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

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

Early development. The CLI now supports PostgreSQL, MySQL, and SQLite through a shared dialect-based architecture, and the current package version is `0.1.8`.

## Support

If `ajan-sql` saves you time, helps you ship faster, or keeps a few risky queries out of trouble, you can support the project on GitHub Sponsors: [@borakilicoglu](https://github.com/sponsors/borakilicoglu)

## License

MIT
