# JSDoc Standards

## General Rules

- Document every exported function, class, type alias, interface, and constant.
- Keep summaries imperative and short: _"Initialises the ALT:V bridge adapter."_
- Describe params and return types with context (even if TypeScript already specifies them).
- Annotate error scenarios using `@throws` (useful for adapters that can surface platform errors).

## Template

```ts
/**
 * Short summary in one sentence.
 *
 * Longer description explaining behaviour, side effects, and assumptions.
 *
 * @param options - Explain relevant properties and expectations.
 * @returns Description of the return value or promise resolution payload.
 * @throws {BridgeTimeoutError} When a call exceeds the configured timeout.
 */
export function example(options: ExampleOptions): ExampleResult {
  // implementation
}
```

## Tags

| Tag           | Usage                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| `@param`      | Required for each parameter. Nest object props via dot-notation when helpful.   |
| `@returns`    | Always describe resolved payload (include `Promise<...>` details).              |
| `@throws`     | Document non-happy path flows (timeouts, validation errors, platform failures). |
| `@deprecated` | Include replacement guidance and a sunset date/version.                         |
| `@example`    | Provide at least one when showcasing event payload structures.                  |

## ALT:V & RageMP Specifics

- Note environment-specific behaviour in descriptions (e.g., `ALT:V emits arrays, RageMP emits varargs`).
- Include pointer to related schema entry (e.g., `@see MissionUpdateEvent`).
- Ensure bridging utilities mention expected `emit/call` direction for quick reference.

## Validation Helpers

Document validation helpers and guard functions with precise contracts:

```ts
/**
 * Validates that the payload conforms to the MissionUpdate schema.
 *
 * @param payload - Candidate payload to validate.
 * @returns Validation result containing the parsed payload or formatted errors.
 */
export function validateMissionUpdate(payload: unknown): ValidationResult<MissionUpdatePayload>;
```

## Documentation Workflow

1. Add/Update JSDoc within source files.
2. Regenerate Markdown/JSON docs via `pnpm docs:generate` (TBD pipeline).
3. Verify Obsidian-friendly Markdown updates under `docs/vault`.
4. Confirm interactive docs reflect new metadata.
