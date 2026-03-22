# Tools

## `list_tables`

Returns all visible base tables outside PostgreSQL system schemas.

## `describe_table`

Returns column names, types, nullability, and default values for a table.

Inputs:

- `name`
- `schema` optional, defaults to `public`

## `list_relationships`

Returns foreign key relationships across the database schema.

## `run_readonly_query`

Runs a guarded `SELECT` query and returns rows.

Inputs:

- `sql`

## `explain_query`

Runs `EXPLAIN (FORMAT JSON)` for a guarded readonly query.

Inputs:

- `sql`

## `sample_rows`

Returns a limited sample from a table without exposing unrestricted reads.

Inputs:

- `name`
- `schema` optional, defaults to `public`
- `limit` optional, max `100`
