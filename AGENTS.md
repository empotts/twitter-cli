# AGENTS.md — Agent Developer Guide for twitter-cli-ts

This file provides context for AI agents working in this repository.

## Project Overview

- **Project**: twitter-cli-ts — TypeScript-first CLI + package for Twitter/X workflows
- **Language**: TypeScript (Node 20+)
- **Package Manager**: pnpm
- **Repository**: https://github.com/empotts/twitter-cli-ts

## Build, Lint, and Test Commands

```bash
# Install dependencies
pnpm install

# Typecheck all packages
pnpm -r typecheck

# Run all tests
pnpm -r test

# Build all packages
pnpm -r build
```

## Code Style

- TypeScript strict mode is enabled
- Prefer explicit types at module boundaries
- Keep CLI as thin adapters and business logic in `twitter-core`
- Structured output contract is documented in `SCHEMA.md`

## Project Structure

```text
packages/
├── twitter-core/            # Importable core library
│   ├── src/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── parser.ts
│   │   ├── serialization.ts
│   │   ├── services.ts
│   │   └── ...
│   └── tests/               # Vitest suites + fixtures
└── twitter-cli/             # Thin CLI wrapper over core
    ├── src/
    │   ├── cli.ts
    │   ├── bin.ts
    │   ├── formatters.ts
    │   └── ...
    └── tests/               # Vitest CLI tests
```

## CI

- GitHub Actions runs:
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm -r build`
