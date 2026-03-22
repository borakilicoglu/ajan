# Tools

## Tool Matrix

| Tool | Purpose | Inputs | Guarded |
| --- | --- | --- | --- |
| `list_tables` | List visible database tables | None | N/A |
| `describe_table` | Describe columns and types for one table | `name`, optional `schema` | N/A |
| `list_relationships` | List foreign key relationships | None | N/A |
| `run_readonly_query` | Execute a readonly `SELECT` query | `sql` | Yes |
| `explain_query` | Return JSON execution plan for a readonly query | `sql` | Yes |
| `sample_rows` | Return a limited sample from a table | `name`, optional `schema`, optional `limit`, optional `columns` | Yes |

## `list_tables`

Returns all visible base tables outside PostgreSQL system schemas.

## `describe_table`

Returns column names, types, nullability, default values, basic key metadata, and foreign key reference metadata for a table.

Inputs:

- `name`
- `schema` optional, defaults to `public`

## `list_relationships`

Returns foreign key relationships across the database schema.

## `run_readonly_query`

Runs a guarded `SELECT` query and returns rows, column metadata, and execution timing.

Inputs:

- `sql`

## `explain_query`

Runs `EXPLAIN (FORMAT JSON)` for a guarded readonly query and includes execution timing plus a lightweight root-node summary.

Inputs:

- `sql`

## `sample_rows`

Returns a limited sample from a table without exposing unrestricted reads.

Inputs:

- `name`
- `schema` optional, defaults to `public`
- `limit` optional, max `100`
- `columns` optional list of selected column names
