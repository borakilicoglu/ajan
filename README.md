<p align="center">
  <img src="./assets/cover.svg" alt="ajan-sql cover" width="860" />
</p>

<p align="center">
  <b>Safe, read-only SQL access for AI agents — via MCP.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ajan-sql"><img src="https://img.shields.io/npm/v/ajan-sql" /></a>
  <a href="https://www.npmjs.com/package/ajan-sql"><img src="https://img.shields.io/npm/dt/ajan-sql" /></a>
  <a href="https://borakilicoglu.github.io/ajan-sql/"><img src="https://img.shields.io/badge/docs-vitepress-5d98ea" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-lightgrey" /></a>
</p>

---

## ⚡ What is ajan-sql?

`ajan-sql` is an MCP server that lets AI agents safely query your database.

👉 read-only  
👉 schema-aware  
👉 guardrailed

Supports:

- PostgreSQL
- MySQL
- SQLite

---

## 🚀 Quick Start

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB npx ajan-sql
```

That’s it.

---

## 🧠 What it solves

AI agents querying databases is risky.

Without guardrails:

- they can modify data
- run heavy queries
- break your system

👉 `ajan-sql` fixes this by enforcing strict rules.

---

## 🔥 Safety by default

All queries are:

- `SELECT` only
- no `INSERT`, `UPDATE`, `DELETE`
- no `DROP`, `ALTER`, `TRUNCATE`
- limited results (`LIMIT 100`)
- timeout enforced (max 5s)
- no multi-statement queries
- no SQL comments

👉 **These rules cannot be bypassed.**

---

## ⚡ Available Tools

- `list_tables`
- `describe_table`
- `list_relationships`
- `search_schema`
- `run_readonly_query`
- `explain_query`
- `sample_rows`
- `server_info`

---

## 🧠 Example

```json
{
  "tool": "run_readonly_query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```

---

## 🌐 Supported Databases

```bash
# PostgreSQL
DATABASE_DIALECT=postgres
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB

# MySQL
DATABASE_DIALECT=mysql
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DB

# SQLite
DATABASE_DIALECT=sqlite
DATABASE_URL=file:/absolute/path/to/database.sqlite
```

---

## ⚙️ Features

- MCP-native SQL access
- multi-database support
- strict read-only guardrails
- schema discovery + introspection
- structured output for AI agents
- predictable execution limits
- type-safe schemas

---

## 🧠 Use Cases

- AI copilots querying databases
- internal data assistants
- analytics agents
- safe DB access in automation
- MCP-based workflows

---

## 📦 Install

```bash
npm install -g ajan-sql
```

or:

```bash
npx ajan-sql
```

---

## 🧩 Client Example

```json
{
  "mcpServers": {
    "ajan-sql": {
      "command": "npx",
      "args": ["ajan-sql"],
      "env": {
        "DATABASE_DIALECT": "postgres",
        "DATABASE_URL": "postgres://USER:PASSWORD@HOST:PORT/DB"
      }
    }
  }
}
```

---

## 💡 Philosophy

> AI should never have unsafe database access.

`ajan-sql` ensures queries are safe, predictable, and controlled.

---

## ❤️ Support

If this tool helps you:

⭐ Star the repo  
☕ Support via GitHub Sponsors

https://github.com/sponsors/borakilicoglu

---

## 🔗 Links

- GitHub: https://github.com/borakilicoglu/ajan-sql
- npm: https://www.npmjs.com/package/ajan-sql
- Docs: https://borakilicoglu.github.io/ajan-sql/
