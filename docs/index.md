<p align="center">
  <img src="/cover.svg" alt="ajan-sql cover" width="860" />
</p>

AI-safe MCP server for schema-aware, read-only SQL access.

## What It Does

`ajan-sql` runs as an MCP server over stdio and connects to PostgreSQL for:

- schema discovery
- readonly query execution
- query explain output
- safe sample row inspection

It provides schema-aware, read-only PostgreSQL access for MCP and AI workflows.

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

## Install

```bash
npm install -g ajan-sql
```

## Run

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB ajan-sql
```

## Local Development

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npm run dev
```

## Client Example

```json
{
  "mcpServers": {
    "ajan-sql": {
      "command": "ajan-sql",
      "env": {
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```

## Client Example For Local Repo Builds

```json
{
  "mcpServers": {
    "ajan-sql": {
      "command": "node",
      "args": ["/absolute/path/to/ajan-sql/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```
