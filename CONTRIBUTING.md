# Contributing Guide

## Prerequisites

- Node.js ≥ 18.18, pnpm ≥ 8.
- Install workspace dependencies via `pnpm install`.
- Husky hooks install automatically; ensure Git is initialised.

## Branching Strategy

- `feature/<scope>-<summary>` – new capabilities or refactors.
- `fix/<scope>-<summary>` – bug fixes.
- `chore/<scope>-<summary>` – tooling, CI, or non-code changes.
- `release/<version>` – release preparation.
- `hotfix/<scope>-<summary>` – urgent fixes on top of the default branch.

## Commit Messages

We follow Conventional Commits. Examples:

- `feat(core): introduce message schema builder`
- `fix(adapter-altv): align event payload validation`
- `docs(docs): expand schema explorer overview`

`pnpm exec commitlint --from=HEAD~10 --to=HEAD` can lint recent commits.

## Code Quality Expectations

- TypeScript strict mode is mandatory. Prefer explicit return types for exported members.
- Document all exported types, functions, and classes using JSDoc (see [`docs/vault/standards/jsdoc.md`](docs/vault/standards/jsdoc.md)).
- Keep ESLint/Prettier warnings at zero. Run `pnpm lint` and `pnpm format` locally.
- Add Vitest coverage for new features or provide reasoning in PR description.

## Pull Request Checklist

- [ ] Branch and commit naming follow conventions.
- [ ] `pnpm lint`, `pnpm test`, and `pnpm build` succeed.
- [ ] JSDoc annotations reflect runtime behaviour and external contracts.
- [ ] Documentation in [`docs/vault`](docs/vault) updated as needed.
- [ ] Changelog/roadmap notes prepared if the change is user-facing.

## Reviews & Approvals

- Request review from the Tech Lead (Codex) and at least one domain engineer.
- Provide context: feature scope, integration points, manual test notes, and outstanding risks.
- Address review feedback promptly; follow-up commits should remain scoped and well-described.

## Release Flow

1. Create a `release/<version>` branch.
2. Update changelog and version metadata.
3. Merge via PR after test suite, docs build, and CI succeed.
4. Tag the release and publish packages via the release pipeline.

## Support

For questions or architecture discussion, start a thread in `#bridge-dev` and link the relevant documentation pages. Keep Obsidian vault notes up to date for shared understanding.
