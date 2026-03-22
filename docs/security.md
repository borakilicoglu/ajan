# Security

## Guard Rules

All executed queries must obey these rules:

- `SELECT` only
- reject `INSERT`
- reject `UPDATE`
- reject `DELETE`
- reject `DROP`
- reject `ALTER`
- reject `TRUNCATE`
- reject multi-statement SQL
- reject SQL comments
- enforce default `LIMIT 100`
- reject `LIMIT` values above `100`
- cap statement timeout at `5` seconds
- cap maximum result size

## Design Intent

The project is built as:

> psql + schema awareness + AI-safe guard layer

All database logic flows through:

- `db/`
- `guard/`
- `query-runner/`
