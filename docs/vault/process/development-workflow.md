# Development Workflow

1. **Sync main**
   - `git checkout main && git pull`.
   - `pnpm install` to refresh lockfile alignment.

2. **Create branch**
   - `git checkout -b feature/<scope>-<summary>`.
   - Update related tickets with branch link.

3. **Implement**
   - Keep changes scoped.
   - Update schemas + generated outputs together.
   - Write/refresh Vitest suites.

4. **Validate**
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
   - Run playground (when available) to sanity-check behaviours.

5. **Document**
   - Augment Obsidian notes (`docs/vault`).
   - Ensure JSDoc covers public surface.
   - Add/Update release notes when necessary.

6. **Commit & Push**
   - Follow Conventional Commits.
   - Husky pre-commit will run lint-staged; fix any failures.
   - Create PR with context + test evidence.

7. **Review Cycle**
   - Address feedback via follow-up commits.
   - Merge after approvals and green CI.

## Tooling References

- `pnpm lint --filter <package>` to target specific workspace members.
- `pnpm --filter @altrage/bridge-core test -- --runInBand` for deterministic runs.
- `pnpm exec changeset` (future) for release notes.
- Schemas live in `packages/core/src`; add new events through `createBridgeSchema` or `defineSchema` utilities.
- Environment-specific logic belongs in `packages/adapter-altv` and `packages/adapter-ragemp`; prefer consuming `createAltVBridge` / `createRageMPBridge` rather than accessing globals directly.

## Quality Gates

- 100% type coverage on exported APIs (no `any` leaks).
- Runtime validation for external payload boundaries.
- Documented fallback/error flows for cross-platform discrepancies.
