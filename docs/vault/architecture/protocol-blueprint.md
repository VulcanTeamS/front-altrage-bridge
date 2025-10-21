# Protocol Blueprint

## Schema Strategy

- Source-of-truth defined via TypeScript-first DSL (leveraging `zod` or `typebox`) with metadata for runtime validation and documentation.
- Schemas compiled into:
  - TypeScript types (`EmitEventMap`, `CallRequestMap`, `CallResponseMap`).
  - Runtime validators (to guard payloads in adapters and dev tooling).
  - Documentation JSON consumed by `apps/docs`.
  - Mock data factories for the playground.
- Core tooling lives in `@altrage/bridge-core`:
  - `createBridgeSchema()` – fluent builder for composing event registries.
  - `defineEvent()` / `defineSchema()` – helpers for modularising contracts across packages.
  - `BridgeRegistry` – runtime validation + lookup façade used by adapters.

## Event Categories

| Direction     | Example Use Case                          | Notes                                    |
| ------------- | ----------------------------------------- | ---------------------------------------- |
| `server → ui` | Push mission updates to WebView           | Requires ack + retry settings.           |
| `ui → server` | Submit player action forms                | Validate payload, optional response.     |
| `ui → client` | Trigger local-only effects (sound/FX)     | Should be sandboxed to client event bus. |
| `client → ui` | Sync client state (position, stats, etc.) | Provide throttling & diff strategies.    |

## Typed Emit/Call

- Every schema entry yields both compile-time and runtime typing.
- Example shape (pseudo-code):

```ts
bridge.emit.serverToUi('mission:update', {
  missionId: 'abc',
  status: 'in-progress',
});

const result = await bridge.call.uiToServer('market:purchase', {
  itemId: 'drone',
  quantity: 2,
});
```

- Calls include correlation IDs, configurable timeouts, and structured error payloads.

### Registry Workflow

1. Feature packages declare events using `defineEvent` and aggregate them via `defineSchema`.
2. Host applications call `createBridgeSchema().merge(...).build()` to produce an immutable snapshot.
3. Adapters instantiate `createBridgeRegistry(schema)` to access type-safe payload/response parsing.
4. Documentation tooling consumes `schema.toJSON()` for explorer views and Obsidian exports.

## Metadata Requirements

- Category (`server-ui`, `ui-server`, `client-ui`, `ui-client`).
- Reliability (`fire-and-forget`, `requires-ack`, `rpc`).
- Payload schema.
- Error schema.
- Version (semver) and deprecated flags.
- Documentation strings (title, description, examples).

## Documentation Generation

1. Traverse schema registry.
2. Produce Markdown (for Obsidian) + JSON (for docs app).
3. Render Swagger-like explorer with request/response samples.
4. Expose CLI to regenerate docs and type definitions (`pnpm docs:generate`).

## Open Questions

- Final choice of schema DSL (`zod`, `typebox`, or custom AST?).
- Handling binary payloads (e.g., ArrayBuffer) within WebView constraints.
- Version negotiation between server modules and UI bundles.
