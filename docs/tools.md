# Tools

## Tool Matrix

| Tool | Purpose | Inputs | Guarded | Structured Output |
| --- | --- | --- | --- | --- |
| `list_tables` | List visible database tables | None | N/A | `TableSummary[]` |
| `describe_table` | Describe columns and types for one table | `name`, optional `schema` | N/A | `TableDescription` |
| `list_relationships` | List foreign key relationships | None | N/A | `RelationshipSummary[]` |
| `server_info` | Return runtime server details for onboarding and diagnostics | None | N/A | `ServerInfoResult` |
| `search_schema` | Search table and column names across the schema | `query`, optional `schema`, optional `limit` | N/A | `SearchSchemaResult` |
| `run_readonly_query` | Execute a readonly `SELECT` query | `sql` | Yes | `ReadonlyQueryResult` |
| `explain_query` | Return JSON execution plan for a readonly query | `sql` | Yes | `ExplainQueryResult` |
| `sample_rows` | Return a limited sample from a table | `name`, optional `schema`, optional `limit`, optional `columns` | Yes | `ReadonlyQueryResult` |

## Shared Contract

All tools return both:

- `content`: a short human-readable text summary
- `structuredContent`: a machine-friendly payload for MCP clients

Tool results also include an embedded `text/toon` resource inside `content`, carrying the same payload encoded in TOON.

Tool outputs are normalized across dialects. Field values such as data types, index names, explain plans, and row estimates may vary between PostgreSQL, MySQL, and SQLite.

Shared response envelope:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Short summary"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "tool://ajan-sql/server_info/result.toon",
        "mimeType": "text/toon",
        "text": "name: ajan-sql"
      }
    }
  ],
  "structuredContent": {}
}
```

## Canonical Shapes

The canonical tool names and shared TypeScript payload shapes live in the source tree:

- `src/tools/names.ts` for MCP tool identifiers
- `src/tools/types.ts` for shared argument and response types

These source files are the contract source of truth. The sections below document the runtime payloads they describe.

## Input Contracts

| Tool | Required Inputs | Optional Inputs | Constraints |
| --- | --- | --- | --- |
| `list_tables` | None | None | N/A |
| `describe_table` | `name` | `schema` | non-empty strings |
| `list_relationships` | None | None | N/A |
| `server_info` | None | None | N/A |
| `search_schema` | `query` | `schema`, `limit` | `limit` max `50`, substring search |
| `run_readonly_query` | `sql` | None | non-empty string, guarded readonly query |
| `explain_query` | `sql` | None | non-empty string, guarded readonly query |
| `sample_rows` | `name` | `schema`, `limit`, `columns` | `limit` max `100`, selected columns must exist |

## Output Contracts

| Tool | `structuredContent` Shape |
| --- | --- |
| `list_tables` | `TableSummary[]` |
| `describe_table` | `TableDescription` |
| `list_relationships` | `RelationshipSummary[]` |
| `server_info` | `ServerInfoResult` |
| `search_schema` | `SearchSchemaResult` |
| `run_readonly_query` | `ReadonlyQueryResult` |
| `explain_query` | `ExplainQueryResult` |
| `sample_rows` | `ReadonlyQueryResult` |

## `list_tables`

Returns visible tables for the active dialect. PostgreSQL and MySQL include schema names; SQLite uses the main database namespace. Comments and row estimates are included when the active dialect can provide them.

`structuredContent`:

```json
[
  {
    "schema": "public",
    "name": "users",
    "comment": "Application users",
    "estimatedRowCount": 42
  }
]
```

## `describe_table`

Returns column names, types, nullability, default values, basic key metadata, foreign key reference metadata, and table index metadata.

Inputs:

- `name`
- `schema` optional, defaults to `public` for PostgreSQL and to the current database for MySQL. SQLite ignores the schema value.

`structuredContent`:

```json
{
  "schema": "public",
  "name": "posts",
  "columns": [
    {
      "name": "user_id",
      "dataType": "bigint",
      "isNullable": false,
      "defaultValue": null,
      "isPrimaryKey": false,
      "isUnique": false,
      "references": {
        "schema": "public",
        "table": "users",
        "column": "id"
      }
    }
  ],
  "indexes": [
    {
      "name": "posts_pkey",
      "columns": ["id"],
      "isUnique": true,
      "isPrimary": true
    }
  ]
}
```

## `list_relationships`

Returns foreign key relationships across the database schema.

`structuredContent`:

```json
[
  {
    "constraintName": "posts_user_id_fkey",
    "sourceSchema": "public",
    "sourceTable": "posts",
    "sourceColumn": "user_id",
    "targetSchema": "public",
    "targetTable": "users",
    "targetColumn": "id"
  }
]
```

## `server_info`

Returns lightweight runtime details that help MCP clients confirm the active version, dialect, available tools, resources, and readonly guard settings.

`structuredContent`:

```json
{
  "name": "ajan-sql",
  "version": "0.2.1",
  "dialect": "postgres",
  "tools": ["server_info", "list_tables", "describe_table"],
  "resources": ["schema://snapshot", "schema://table/{name}"],
  "readonly": {
    "defaultLimit": 100,
    "maxLimit": 100,
    "timeoutMs": 5000,
    "maxResultBytes": 1000000
  }
}
```

## `search_schema`

Searches table names and column names using a case-insensitive substring match. This is useful for large schemas when the client knows a concept but not the exact table name.

Inputs:

- `query`
- `schema` optional
- `limit` optional, max `50`

`structuredContent`:

```json
{
  "query": "user",
  "schema": "public",
  "totalMatches": 2,
  "matches": [
    {
      "schema": "public",
      "table": "users",
      "column": null,
      "dataType": null,
      "matchType": "table"
    },
    {
      "schema": "public",
      "table": "posts",
      "column": "user_id",
      "dataType": "bigint",
      "matchType": "column"
    }
  ]
}
```

## `run_readonly_query`

Runs a guarded `SELECT` query and returns rows, column metadata, and execution timing.

Inputs:

- `sql`

`structuredContent`:

```json
{
  "sql": "SELECT id, email FROM users LIMIT 1",
  "rowCount": 1,
  "durationMs": 4,
  "columns": [
    { "name": "id", "dataTypeId": 20 },
    { "name": "email", "dataTypeId": 25 }
  ],
  "rows": [
    { "id": 1, "email": "bora@example.com" }
  ]
}
```

## `explain_query`

Runs dialect-specific explain output for a guarded readonly query and includes execution timing plus a lightweight summary.

Inputs:

- `sql`

`structuredContent`:

```json
{
  "sql": "SELECT id FROM users LIMIT 1",
  "durationMs": 3,
  "summary": {
    "nodeType": "Seq Scan",
    "relationName": "users",
    "planRows": 1,
    "startupCost": 0,
    "totalCost": 1.01,
    "childCount": 0
  },
  "plan": [
    {
      "Plan": {
        "Node Type": "Seq Scan"
      }
    }
  ]
}
```

## `sample_rows`

Returns a limited sample from a table without exposing unrestricted reads.

Inputs:

- `name`
- `schema` optional, defaults to `public`
- `limit` optional, max `100`
- `columns` optional list of selected column names

`structuredContent`:

```json
{
  "sql": "SELECT \"id\" FROM \"public\".\"users\" ORDER BY \"id\" LIMIT 1",
  "rowCount": 1,
  "durationMs": 2,
  "columns": [
    { "name": "id", "dataTypeId": 20 }
  ],
  "rows": [
    { "id": 1 }
  ]
}
```
