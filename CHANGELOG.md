# Changelog

## 0.1.1

- Added VitePress docs site and GitHub Pages workflow
- Improved README with badges, install guidance, tool matrix, and project links
- Added discoverable schema table resources and server registration coverage
- Prepared package metadata and publish workflow for ongoing releases
- Added project cover artwork and updated repository links after the repo rename

## 0.1.0

- Initial public release of `ajan-sql`
- Added schema inspection tools:
  - `list_tables`
  - `describe_table`
  - `list_relationships`
- Added guarded readonly query execution:
  - `run_readonly_query`
  - `explain_query`
  - `sample_rows`
- Added PostgreSQL-backed MCP resources:
  - `schema://snapshot`
  - `schema://table/{name}`
