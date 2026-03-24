# Changelog

## 0.1.9

- Added `server_info` for lightweight server diagnostics and client onboarding
- Added `search_schema` for table and column discovery across large schemas
- Standardized more server metadata around a shared runtime version constant
- Expanded tool contract coverage and updated release documentation

## 0.1.8

- Centralized MCP tool names and derived tool argument types from shared schemas
- Tightened MCP tool and resource contract assertions in server tests
- Added dedicated MCP resource contract documentation and docs navigation links
- Simplified MCP tool registration and README header links

## 0.1.7

- Pointed npm homepage metadata to the published docs site
- Added bundled TypeScript declaration output and package `types` metadata
- Centralized MCP tool argument and response type definitions

## 0.1.6

- Added initial SQLite dialect support with `better-sqlite3`
- Added `DATABASE_DIALECT=sqlite` runtime and configuration support
- Added SQLite unit coverage for schema discovery, guarded queries, sampling, and explain output
- Updated README and docs for PostgreSQL, MySQL, and SQLite usage

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
