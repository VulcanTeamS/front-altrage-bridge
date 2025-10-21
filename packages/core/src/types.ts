import type { z } from 'zod';

/**
 * Enumerates every supported direction that an event can travel between the server, client, and UI layers.
 */
export const BridgeDirections = {
  ServerToUi: 'server-to-ui',
  UiToServer: 'ui-to-server',
  ClientToUi: 'client-to-ui',
  UiToClient: 'ui-to-client',
} as const;

/**
 * Union of directional string literals derived from {@link BridgeDirections}.
 */
export type BridgeDirection = (typeof BridgeDirections)[keyof typeof BridgeDirections];

/**
 * Delivery guarantees available for bridge events. Used to describe reliability expectations.
 */
export const BridgeReliabilities = {
  FireAndForget: 'fire-and-forget',
  AtLeastOnce: 'at-least-once',
  ExactlyOnce: 'exactly-once',
  Rpc: 'rpc',
} as const;

/**
 * Union of reliability string literals derived from {@link BridgeReliabilities}.
 */
export type BridgeReliability = (typeof BridgeReliabilities)[keyof typeof BridgeReliabilities];

/**
 * Describes an error payload that can be emitted for a given event.
 */
export interface BridgeErrorDescriptor<
  Schema extends z.ZodTypeAny = z.ZodTypeAny,
  Code extends string = string,
> {
  /** Stable machine-readable error code. */
  readonly code: Code;
  /** Optional short summary shown in generated documentation. */
  readonly summary?: string;
  /** Optional long-form description detailing the failure mode. */
  readonly description?: string;
  /** Optional payload schema with structured error data. */
  readonly payload?: Schema;
}

/**
 * Common documentation metadata applied to all event definitions.
 */
export interface BridgeEventMetadata {
  /** One-line summary for docs and explorer UI. */
  readonly summary?: string;
  /** Detailed description of the event's semantics. */
  readonly description?: string;
  /** Semantic version that introduced the event. */
  readonly version?: string;
  /** Indicates whether the event is deprecated (optionally includes guidance). */
  readonly deprecated?: boolean | string;
  /** Arbitrary tags used for grouping events in docs. */
  readonly tags?: ReadonlyArray<string>;
  /** Optional link to long-form documentation. */
  readonly docUrl?: string;
}

/**
 * Input shape accepted by the schema builder when registering a new event.
 */
export type BridgeEventInput<
  Direction extends BridgeDirection,
  PayloadSchema extends z.ZodTypeAny,
  ResponseSchema extends z.ZodTypeAny | null = null,
  ErrorSchema extends ReadonlyArray<BridgeErrorDescriptor> | undefined = undefined,
> = BridgeEventMetadata & {
  /** Direction that the event travels across the bridge. */
  readonly direction: Direction;
  /** Delivery guarantee applied to the event. */
  readonly reliability?: BridgeReliability;
  /** Schema describing the payload emitted with the event. */
  readonly payload: PayloadSchema;
  /** Schema describing the RPC response payload (if any). */
  readonly response?: ResponseSchema;
  /** Collection of error descriptors for RPC error handling. */
  readonly errors?: ErrorSchema;
};

/**
 * Concrete event definition combining metadata, payload schemas, and assigned identifier.
 */
export interface BridgeEventDefinition<
  Id extends string,
  Direction extends BridgeDirection,
  PayloadSchema extends z.ZodTypeAny,
  ResponseSchema extends z.ZodTypeAny | null = null,
  ErrorSchema extends ReadonlyArray<BridgeErrorDescriptor> | undefined = undefined,
> extends BridgeEventInput<Direction, PayloadSchema, ResponseSchema, ErrorSchema> {
  /** Unique identifier of the event (e.g. `mission:update`). */
  readonly id: Id;
}

/**
 * Alias describing any valid bridge event definition.
 */
export type AnyBridgeEventDefinition = BridgeEventDefinition<
  string,
  BridgeDirection,
  z.ZodTypeAny,
  z.ZodTypeAny | null,
  ReadonlyArray<BridgeErrorDescriptor> | undefined
>;

/**
 * Runtime-ready map that stores event definitions keyed by their identifier.
 */
export type BridgeEventRecord = Record<string, AnyBridgeEventDefinition>;

/**
 * Type helper that resolves to the payload type represented by a given event definition.
 */
export type InferBridgePayload<TDefinition extends AnyBridgeEventDefinition> = z.infer<
  TDefinition['payload']
>;

/**
 * Type helper that resolves to the response type for RPC-style events.
 */
export type InferBridgeResponse<TDefinition extends AnyBridgeEventDefinition> =
  TDefinition['response'] extends z.ZodTypeAny ? z.infer<TDefinition['response']> : void;

/**
 * Subset of event metadata that is serialisable for documentation explorers.
 */
export interface BridgeSchemaJSONEvent {
  /** Event identifier. */
  readonly id: string;
  /** Direction that the event travels across the bridge. */
  readonly direction: BridgeDirection;
  /** Optional one-line summary. */
  readonly summary?: string;
  /** Optional human-readable description. */
  readonly description?: string;
  /** Version in which the event was introduced. */
  readonly version?: string;
  /** Deprecation status (boolean or replacement guidance). */
  readonly deprecated?: boolean | string;
  /** Reliability hint for documentation UIs. */
  readonly reliability?: BridgeReliability;
  /** Tag collection for grouping/filtering. */
  readonly tags?: ReadonlyArray<string>;
  /** Optional external documentation link. */
  readonly docUrl?: string;
}

/**
 * JSON payload produced when exporting the bridge schema for documentation purposes.
 */
export interface BridgeSchemaJSON {
  /** ISO timestamp describing when the snapshot was generated. */
  readonly generatedAt: string;
  /** Array of documented events. */
  readonly events: ReadonlyArray<BridgeSchemaJSONEvent>;
}

/**
 * Narrows a record of bridge events to those matching the provided direction.
 */
export type BridgeEventsByDirection<
  Defs extends BridgeEventRecord,
  Direction extends BridgeDirection,
> = {
  [Id in keyof Defs as Defs[Id]['direction'] extends Direction ? Id : never]: Defs[Id];
};

/**
 * Convenience alias returning the event identifiers declared for a specific direction.
 */
export type BridgeEventIdsByDirection<
  Defs extends BridgeEventRecord,
  Direction extends BridgeDirection,
> = keyof BridgeEventsByDirection<Defs, Direction>;
