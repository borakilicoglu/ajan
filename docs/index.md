---
layout: home

hero:
  name: "ajan-sql"
  text: "AI-safe MCP server for schema-aware, read-only SQL access."
  tagline: "Run a multi-dialect SQL MCP server over stdio with guarded queries, schema discovery, and structured tool outputs for AI workflows."
  actions:
    - theme: brand
      text: Get Started
      link: /tools
    - theme: alt
      text: View on npm
      link: https://www.npmjs.com/package/ajan-sql
    - theme: alt
      text: GitHub
      link: https://github.com/borakilicoglu/ajan-sql

features:
  - title: Schema Aware
    details: Inspect tables, columns, keys, relationships, and referenced columns without leaving your MCP client.
  - title: Read-Only by Design
    details: Enforce SELECT-only execution, reject dangerous statements, cap limits, and apply query timeouts by default.
  - title: MCP Native
    details: Expose tools and resources over stdio with structured outputs that work cleanly in LLM and AI client workflows.
  - title: Dialect Ready
    details: PostgreSQL and MySQL now run through the same MCP surface, with the dialect interface ready for future SQL adapters.
  - title: Explain and Sample
    details: Return explain plans, query summaries, and representative sample rows with predictable, constrained behavior.
  - title: Simple to Run
    details: Install globally, set DATABASE_URL, and wire ajan-sql into Gemini, Claude Desktop, or any MCP-compatible client.
---

## Quick Start

Install:

```bash
npm install -g ajan-sql
```

Run:

```bash
DATABASE_DIALECT=postgres \
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB ajan-sql
```

MySQL:

```bash
DATABASE_DIALECT=mysql \
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DB ajan-sql
```

`DATABASE_DIALECT` defaults to `postgres`. Supported values today are `postgres` and `mysql`.

## MCP Client Example

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

## Available Tools

- `list_tables`
- `describe_table`
- `list_relationships`
- `run_readonly_query`
- `explain_query`
- `sample_rows`

## Available Resources

- `schema://snapshot`
- `schema://table/{name}`
