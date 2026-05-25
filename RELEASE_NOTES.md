## What's Changed

- Added optional readonly schema/table access policy controls:
  - `AJAN_SQL_ALLOWED_SCHEMAS`
  - `AJAN_SQL_ALLOWED_TABLES`
  - `AJAN_SQL_DENIED_TABLES`
- Added `AJAN_SQL_AUDIT_LOG=true` for stderr JSON audit events
- Exposed active access policy and audit settings through `server_info`
- Documented sandboxing, approvals, readonly DB user guidance, and policy configuration
- Bumped the package to `0.3.0`
