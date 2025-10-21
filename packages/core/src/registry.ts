import type { z } from 'zod';

import { BridgeSchemaError, BridgeValidationError } from './errors';
import type { BridgeSchema } from './schema';
import type { BridgeEventRecord, InferBridgePayload, InferBridgeResponse } from './types';

/**
 * Runtime registry that exposes helpers for payload validation and event lookup.
 */
export class BridgeRegistry<Defs extends BridgeEventRecord> {
  /**
   * @param schema - Schema snapshot used for lookups and validation.
   */
  constructor(private readonly schema: BridgeSchema<Defs>) {}

  /**
   * Retrieves the definition for the provided event identifier.
   *
   * @param id - Identifier of the event to look up.
   * @returns Frozen event definition from the schema snapshot.
   * @throws BridgeSchemaError When the identifier is unknown.
   */
  getEvent<Id extends keyof Defs>(id: Id): Defs[Id] {
    return this.schema.getEvent(id);
  }

  /**
   * Perform strict validation of an event payload using the associated Zod schema.
   *
   * @param id - Identifier of the event to validate against.
   * @param payload - Data that should match the event's payload schema.
   * @returns Parsed and typed payload.
   * @throws BridgeValidationError When validation fails for the provided payload.
   */
  parsePayload<Id extends keyof Defs>(id: Id, payload: unknown): InferBridgePayload<Defs[Id]> {
    const definition = this.getEvent(id);

    try {
      return definition.payload.parse(payload) as InferBridgePayload<Defs[Id]>;
    } catch (error) {
      throw new BridgeValidationError(`Payload validation failed for event "${String(id)}"`, {
        cause: error,
        details: unwrapZodIssues(error),
      });
    }
  }

  /**
   * Perform strict validation of an RPC response payload. Throws if the event does not define a response schema.
   *
   * @param id - Identifier of the event to validate against.
   * @param payload - Response payload sourced from the remote endpoint.
   * @returns Parsed and typed response body.
   * @throws BridgeSchemaError When the event does not declare a response schema.
   * @throws BridgeValidationError When validation fails for the provided response payload.
   */
  parseResponse<Id extends keyof Defs>(id: Id, payload: unknown): InferBridgeResponse<Defs[Id]> {
    const definition = this.getEvent(id);

    if (!definition.response) {
      throw new BridgeSchemaError(`Event "${String(id)}" does not declare a response schema`);
    }

    try {
      return definition.response.parse(payload) as InferBridgeResponse<Defs[Id]>;
    } catch (error) {
      throw new BridgeValidationError(`Response validation failed for event "${String(id)}"`, {
        cause: error,
        details: unwrapZodIssues(error),
      });
    }
  }

  /**
   * Provides access to the schema snapshot powering this registry.
   *
   * @returns Immutable schema instance used during registry construction.
   */
  snapshot(): BridgeSchema<Defs> {
    return this.schema;
  }
}

/**
 * Convenience helper for creating a {@link BridgeRegistry} from a schema instance.
 *
 * @param schema - Immutable schema snapshot defining bridge events.
 * @returns New registry bound to the provided schema.
 */
export const createBridgeRegistry = <Defs extends BridgeEventRecord>(
  schema: BridgeSchema<Defs>,
): BridgeRegistry<Defs> => new BridgeRegistry(schema);

const unwrapZodIssues = (error: unknown): z.ZodIssue[] | undefined => {
  if (isZodError(error)) {
    return error.issues;
  }

  return undefined;
};

const isZodError = (error: unknown): error is z.ZodError => {
  return Boolean(error) && typeof error === 'object' && 'issues' in (error as object);
};
