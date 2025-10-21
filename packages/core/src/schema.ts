import type { z } from 'zod';

import type {
  AnyBridgeEventDefinition,
  BridgeDirection as BridgeDirectionType,
  BridgeErrorDescriptor,
  BridgeEventDefinition,
  BridgeEventInput,
  BridgeEventRecord,
  BridgeSchemaJSON,
  BridgeSchemaJSONEvent,
} from './types';
import { freeze } from './utils/object';

type BridgeEventDraftRecord = Partial<Record<string, AnyBridgeEventDefinition>>;
type MaterialisedDefs<Defs extends BridgeEventDraftRecord> = {
  [Key in keyof Defs]-?: Exclude<Defs[Key], undefined>;
};

/**
 * Immutable snapshot of the bridge schema with convenience lookup helpers.
 */
export interface BridgeSchema<Defs extends BridgeEventRecord> {
  /** Total number of registered events in the schema. */
  readonly size: number;
  /** Immutable mapping of event identifiers to their definitions. */
  readonly events: Defs;
  /**
   * Retrieves the definition for a specific event.
   *
   * @param id - Identifier of the event to retrieve.
   * @returns The matching event definition.
   */
  getEvent<Id extends keyof Defs>(id: Id): Defs[Id];
  /**
   * Lists every event definition stored in the schema.
   *
   * @returns Array of event definitions in insertion order.
   */
  list(): ReadonlyArray<Defs[keyof Defs]>;
  /**
   * Lists events that travel in the specified direction.
   *
   * @param direction - Direction filter.
   * @returns Array of matching event definitions.
   */
  listByDirection<D extends BridgeDirectionType>(
    direction: D,
  ): ReadonlyArray<Extract<Defs[keyof Defs], { direction: D }>>;
  /**
   * Converts the schema into a JSON-friendly structure suitable for documentation.
   *
   * @returns Serialised schema metadata.
   */
  toJSON(): BridgeSchemaJSON;
}

interface BridgeSchemaBuilderState<Defs extends BridgeEventDraftRecord> {
  /**
   * Registers a new event definition within the builder.
   *
   * @param id - Identifier of the event being registered.
   * @param input - Event metadata and schemas.
   * @returns Updated builder state including the new event.
   */
  event<
    Id extends string,
    Direction extends BridgeDirectionType,
    PayloadSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny | null = null,
    ErrorSchema extends ReadonlyArray<BridgeErrorDescriptor> | undefined = undefined,
  >(
    id: Id,
    input: BridgeEventInput<Direction, PayloadSchema, ResponseSchema, ErrorSchema>,
  ): BridgeSchemaBuilderState<
    Defs &
      Record<Id, BridgeEventDefinition<Id, Direction, PayloadSchema, ResponseSchema, ErrorSchema>>
  >;
  /**
   * Merges an existing record of events into the builder state.
   *
   * @param events - Record of events to merge.
   * @returns Updated builder state containing the merged events.
   */
  merge<const OtherDefs extends BridgeEventDraftRecord>(
    events: OtherDefs,
  ): BridgeSchemaBuilderState<Defs & OtherDefs>;
  /**
   * Finalises the builder and produces an immutable schema snapshot.
   *
   * @returns Immutable schema containing every registered event.
   */
  build(): BridgeSchema<MaterialisedDefs<Defs>>;
}

/**
 * Entry point for building a bridge schema in a fluent manner.
 *
 * @returns Fluent builder for declaring bridge events.
 */
export const createBridgeSchema = (): BridgeSchemaBuilderState<BridgeEventDraftRecord> =>
  createBuilder({} as BridgeEventDraftRecord);

/**
 * Utility for declaring a single event definition with full type inference.
 *
 * @param id - Globally unique event identifier (e.g. `mission:update`).
 * @param input - Event metadata, payload schema, and optional RPC response schema.
 * @returns Immutable event definition object.
 */
export const defineEvent = <
  Id extends string,
  Direction extends BridgeDirectionType,
  PayloadSchema extends z.ZodTypeAny,
  ResponseSchema extends z.ZodTypeAny | null = null,
  ErrorSchema extends ReadonlyArray<BridgeErrorDescriptor> | undefined = undefined,
>(
  id: Id,
  input: BridgeEventInput<Direction, PayloadSchema, ResponseSchema, ErrorSchema>,
): BridgeEventDefinition<Id, Direction, PayloadSchema, ResponseSchema, ErrorSchema> => ({
  id,
  ...input,
});

/**
 * Utility for declaring a record of events in a single immutable object.
 *
 * @param events - Record of pre-defined events, typically built with {@link defineEvent}.
 * @returns Frozen schema record that can be consumed by {@link createBridgeSchema}.
 */
export const defineSchema = <
  const Defs extends Record<
    string,
    BridgeEventDefinition<string, BridgeDirectionType, z.ZodTypeAny, z.ZodTypeAny | null>
  >,
>(
  events: Defs,
): Defs => freeze(events);

const createBuilder = <Defs extends BridgeEventDraftRecord>(
  definitions: Defs,
): BridgeSchemaBuilderState<Defs> => ({
  event<
    Id extends string,
    Direction extends BridgeDirectionType,
    PayloadSchema extends z.ZodTypeAny,
    ResponseSchema extends z.ZodTypeAny | null = null,
    ErrorSchema extends ReadonlyArray<BridgeErrorDescriptor> | undefined = undefined,
  >(id: Id, input: BridgeEventInput<Direction, PayloadSchema, ResponseSchema, ErrorSchema>) {
    if (Object.prototype.hasOwnProperty.call(definitions, id)) {
      throw new Error(`Event with id "${id}" is already registered`);
    }

    const definition = defineEvent(id, input);

    const next = {
      ...definitions,
      [id]: definition,
    } as Defs &
      Record<Id, BridgeEventDefinition<Id, Direction, PayloadSchema, ResponseSchema, ErrorSchema>>;

    return createBuilder(next);
  },
  merge<const OtherDefs extends BridgeEventDraftRecord>(events: OtherDefs) {
    const next = {
      ...definitions,
      ...events,
    } as Defs & OtherDefs;

    return createBuilder(next);
  },
  build() {
    return createSchemaSnapshot(definitions);
  },
});

const createSchemaSnapshot = <Defs extends BridgeEventDraftRecord>(
  definitions: Defs,
): BridgeSchema<MaterialisedDefs<Defs>> => {
  const materialised = Object.create(null) as MaterialisedDefs<Defs>;

  for (const key of Object.keys(definitions)) {
    const event = definitions[key as keyof Defs];
    if (event) {
      materialised[key as keyof MaterialisedDefs<Defs>] =
        event as MaterialisedDefs<Defs>[keyof Defs];
    }
  }

  const events = freeze(materialised);
  const cachedByDirection = new Map<BridgeDirectionType, AnyBridgeEventDefinition[]>();

  const ensureDirectionIndex = (
    direction: BridgeDirectionType,
  ): ReadonlyArray<AnyBridgeEventDefinition> => {
    if (!cachedByDirection.has(direction)) {
      const filtered = Object.values(events).filter(
        (event) => event.direction === direction,
      ) as Array<AnyBridgeEventDefinition>;

      cachedByDirection.set(direction, freeze(filtered));
    }

    return cachedByDirection.get(direction) ?? [];
  };

  const getEvent = <Id extends keyof MaterialisedDefs<Defs>>(
    id: Id,
  ): MaterialisedDefs<Defs>[Id] => {
    const event = events[id];

    if (!event) {
      throw new Error(`Unknown bridge event "${String(id)}"`);
    }

    return event;
  };

  return {
    size: Object.keys(events).length,
    events,
    getEvent,
    list: () => freeze(Object.values(events)),
    listByDirection: (direction) =>
      ensureDirectionIndex(direction) as ReadonlyArray<
        Extract<
          MaterialisedDefs<Defs>[keyof MaterialisedDefs<Defs>],
          { direction: typeof direction }
        >
      >,
    toJSON: () => mapToJson(events as BridgeEventRecord),
  };
};

const mapToJson = (events: BridgeEventRecord): BridgeSchemaJSON => {
  const payload: BridgeSchemaJSONEvent[] = Object.values(events).map((event) => ({
    id: event.id,
    direction: event.direction,
    summary: event.summary,
    description: event.description,
    version: event.version,
    deprecated: event.deprecated,
    reliability: event.reliability,
    tags: event.tags,
    docUrl: event.docUrl,
  }));

  return {
    generatedAt: new Date().toISOString(),
    events: freeze(payload),
  };
};
