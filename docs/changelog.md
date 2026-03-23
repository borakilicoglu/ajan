# Changelog

## 0.1.5

- Added initial MySQL dialect support with `mysql2`
- Added `DATABASE_DIALECT=mysql` runtime and configuration support
- Added MySQL usage examples to README and docs
- Fixed MySQL schema introspection aliases after real Docker-based validation

## 0.1.4

- Added table index metadata to `describe_table`
- Enriched `list_tables` with table comments and estimated row counts
- Expanded tool documentation for the richer schema metadata

## 0.1.3

- Added structured MCP tool outputs across the full toolset
- Improved server tests to verify structured tool responses
- Removed the redundant `ajan-sql` heading from the docs homepage

## 0.1.2

- Refined README and docs homepage messaging
- Added project documentation pages and navigation links
- Added community and security guidance files
- Added roadmap and changelog visibility from README and docs

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
