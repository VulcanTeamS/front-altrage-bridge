# Altrage Bridge Monorepo

A multi-package workspace for building a typed communication bridge that unifies ALT:V and RageMP WebView front-ends.

## Packages

- `@altrage/bridge-core` – shared contracts, schema tooling, and messaging protocol abstractions.
- `@altrage/bridge-adapter-altv` – runtime adapter for ALT:V WebViews.
- `@altrage/bridge-adapter-ragemp` – runtime adapter for RageMP browser UIs.
- `@altrage/bridge-docs` (`apps/docs`) – interactive documentation portal (Swagger-like) generated from bridge schemas.
- `@altrage/bridge-playground` (`apps/playground`) – sandbox for validating bridge behaviours and integration scenarios.

## Getting Started

```bash
pnpm install
pnpm lint
pnpm test
```

## Workspace Scripts

- `pnpm build` – builds every package/app.
- `pnpm lint` – runs ESLint across the workspace using the shared flat config.
- `pnpm test` – executes package and app tests (Vitest).
- `pnpm format` / `pnpm format:write` – Prettier check and write modes.
- `pnpm lint:staged` – lint-staged pipeline (automatically executed via Husky).

### Core DSL Highlights

- `createBridgeSchema()` – compose event registries with fluent builder ergonomics.
- `defineEvent()` / `defineSchema()` – modular helpers for sharing event definitions across packages.
- `BridgeRegistry` – runtime validation façade that adapters use to parse payloads/responses.
- All schemas leverage `zod` to share type-level and runtime guarantees.

### Environment Adapters

- `createAltVBridge()` – strongly typed ALT:V WebView bridge with inbound/outbound validation.
- `createRageMPBridge()` – RageMP CEF bridge exposing the same typed surface as the ALT:V adapter.
- Both adapters accept custom payload transformers and error handlers to align with project-specific plumbing.

## Branching & Commits

- Feature branches: `feature/<scope>-<short-description>` (e.g. `feature/core-schema-drafts`).
- Fix branches: `fix/<scope>-<issue>`.
- Release branches: `release/<version>`.
- Hotfix branches: `hotfix/<scope>-<issue>`.

Commits follow the Conventional Commits specification. Husky enforces lint-staged checks and commit message validation.

## Documentation

- Markdown knowledge base stored under [`docs/vault`](docs/vault) (Obsidian-friendly).
- JSDoc guidelines in [`docs/vault/standards/jsdoc.md`](docs/vault/standards/jsdoc.md).
- Contribution guidelines in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Architectural notes in [`docs/vault/architecture/overview.md`](docs/vault/architecture/overview.md).

The documentation portal (`apps/docs`) will ingest the same schema definitions to present an interactive event catalogue similar to Swagger.

## Roadmap Snapshot

1. **Protocol Draft** – define schema DSL, code generation pipeline, and validation utilities.
2. **Adapter MVP** – ALT:V & RageMP adapters using the shared protocol with typed emit/call wrappers.
3. **Documentation Portal** – auto-generated event explorer with live contract previews and payload examples.
4. **Playground Tooling** – dev overlay, WebView emulator, and integration test harness.

## Requirements

- Node.js ≥ 18.18
- pnpm ≥ 8

Husky hooks install automatically via `pnpm install` (prepare script). Ensure Git is available when bootstrapping the workspace.
