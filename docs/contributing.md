# Contributing

Thanks for contributing to `ajan-sql`.

## Development Setup

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the project:

```bash
npm run build
```

Run docs locally:

```bash
npm run docs:dev
```

## Development Rules

- Keep functions small and composable
- Avoid side effects where possible
- Route all DB logic through `db/`
- Route all query execution through `query-runner`
- Route all validation through `guard`
- Prefer simple working code over extra abstraction
- Maintain readonly query safety rules

## Commits

Use conventional-style commit messages:

- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`
- `test: ...`
- `refactor: ...`

## Pull Requests

Before opening a PR:

- run `npm test`
- run `npm run build`
- update docs when behavior changes
- keep the scope focused

## Local Integration Tests

The project may use local-only PostgreSQL integration setup during development. If you add local test assets, avoid committing machine-specific files unless they are intended to be shared project fixtures.
