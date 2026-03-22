# Tools

## Tool Matrix

| Tool | Purpose | Inputs | Guarded | Structured Output |
| --- | --- | --- | --- | --- |
| `list_tables` | List visible database tables | None | N/A | `TableSummary[]` |
| `describe_table` | Describe columns and types for one table | `name`, optional `schema` | N/A | `TableDescription` |
| `list_relationships` | List foreign key relationships | None | N/A | `RelationshipSummary[]` |
| `run_readonly_query` | Execute a readonly `SELECT` query | `sql` | Yes | `ReadonlyQueryResult` |
| `explain_query` | Return JSON execution plan for a readonly query | `sql` | Yes | `ExplainQueryResult` |
| `sample_rows` | Return a limited sample from a table | `name`, optional `schema`, optional `limit`, optional `columns` | Yes | `ReadonlyQueryResult` |

## Structured Output

All tools return both:

- `content`: a short human-readable text summary
- `structuredContent`: a machine-friendly payload for MCP clients

## `list_tables`

Returns all visible base tables outside PostgreSQL system schemas.

`structuredContent`:

```json
[
  {
    "schema": "public",
    "name": "users"
  }
]
```

## `describe_table`

Returns column names, types, nullability, default values, basic key metadata, and foreign key reference metadata for a table.

Inputs:

- `name`
- `schema` optional, defaults to `public`

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

Runs `EXPLAIN (FORMAT JSON)` for a guarded readonly query and includes execution timing plus a lightweight root-node summary.

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
