import {
  BridgeEventIdsByDirection,
  BridgeEventRecord,
  BridgeEventsByDirection,
  BridgeRegistry,
  BridgeSchema,
  BridgeSchemaError,
  createBridgeRegistry,
  InferBridgePayload,
} from '@altrage/bridge-core';

type ServerToUiEvents<Defs extends BridgeEventRecord> = BridgeEventsByDirection<
  Defs,
  'server-to-ui'
>;
type ServerToUiEventId<Defs extends BridgeEventRecord> = BridgeEventIdsByDirection<
  Defs,
  'server-to-ui'
>;
type ClientToUiEvents<Defs extends BridgeEventRecord> = BridgeEventsByDirection<
  Defs,
  'client-to-ui'
>;
type ClientToUiEventId<Defs extends BridgeEventRecord> = BridgeEventIdsByDirection<
  Defs,
  'client-to-ui'
>;
type UiToServerEvents<Defs extends BridgeEventRecord> = BridgeEventsByDirection<
  Defs,
  'ui-to-server'
>;
type UiToServerEventId<Defs extends BridgeEventRecord> = BridgeEventIdsByDirection<
  Defs,
  'ui-to-server'
>;
type UiToClientEvents<Defs extends BridgeEventRecord> = BridgeEventsByDirection<
  Defs,
  'ui-to-client'
>;
type UiToClientEventId<Defs extends BridgeEventRecord> = BridgeEventIdsByDirection<
  Defs,
  'ui-to-client'
>;

type ServerInboundHandler<Defs extends BridgeEventRecord, Id extends ServerToUiEventId<Defs>> = (
  payload: InferBridgePayload<ServerToUiEvents<Defs>[Id]>,
) => void | Promise<void>;

type ClientInboundHandler<Defs extends BridgeEventRecord, Id extends ClientToUiEventId<Defs>> = (
  payload: InferBridgePayload<ClientToUiEvents<Defs>[Id]>,
) => void | Promise<void>;

/**
 * Minimal ALT:V WebView host surface consumed by the bridge adapter.
 */
export interface AltVLike {
  /** Emits an event to the UI context. */
  emit(eventName: string, ...args: unknown[]): unknown;
  /** Emits an event to the server context. */
  emitServer(eventName: string, ...args: unknown[]): unknown;
  /** Registers a listener for UI-originated events. */
  on(eventName: string, listener: (...args: unknown[]) => void): unknown;
  /** Removes a previously registered UI listener. */
  off(eventName: string, listener: (...args: unknown[]) => void): unknown;
  /** Registers a listener for server-originated events. */
  onServer(eventName: string, listener: (...args: unknown[]) => void): unknown;
  /** Removes a previously registered server listener. */
  offServer(eventName: string, listener: (...args: unknown[]) => void): unknown;
}

type IncomingResolver = (id: string, args: unknown[]) => unknown;
type OutgoingPreparer = (id: string, payload: unknown) => unknown[];
type ErrorReporter = (error: unknown) => void;
type HostResolver = () => AltVLike;

/**
 * Customisation options for the ALT:V bridge adapter.
 */
export interface AltVBridgeOptions<Defs extends BridgeEventRecord> {
  /**
   * Immutable schema describing the events supported by the bridge instance.
   */
  schema: BridgeSchema<Defs>;
  /**
   * Optional host instance; defaults to resolving the global `alt` object.
   */
  host?: AltVLike;
  /**
   * Pre-built registry, enabling shared caching across multiple adapters.
   */
  registry?: BridgeRegistry<Defs>;
  /**
   * Custom resolver for inbound payloads emitted by the host.
   */
  resolveIncomingPayload?: IncomingResolver;
  /**
   * Serializer invoked before delegating payloads to host emitters.
   */
  prepareOutgoingPayload?: OutgoingPreparer;
  /**
   * Error reporting hook triggered when handlers throw.
   */
  onError?: ErrorReporter;
  /**
   * Resolver executed when `host` is omitted; should return an ALT:V host instance.
   */
  hostResolver?: HostResolver;
}

/**
 * API surface exposed by `createAltVBridge`.
 */
export interface AltVBridge<Defs extends BridgeEventRecord> {
  /**
   * Schema snapshot used by this bridge instance.
   */
  readonly schema: BridgeSchema<Defs>;
  /**
   * Runtime registry providing typed payload parsing helpers.
   */
  readonly registry: BridgeRegistry<Defs>;
  /**
   * Emits payloads towards the server using `emitServer` after validation.
   */
  emitToServer<Id extends UiToServerEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToServerEvents<Defs>[Id]>,
  ): void;
  /**
   * Emits payloads towards the client runtime via ALT:V's global `emit`.
   *
   * @param id - Identifier of the UI → client event.
   * @param payload - Data that must satisfy the event schema.
   */
  emitToClient<Id extends UiToClientEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToClientEvents<Defs>[Id]>,
  ): void;
  /**
   * Subscribes to server-originated events and validates incoming payloads.
   *
   * @param id - Identifier of the server → UI event to subscribe to.
   * @param handler - Callback executed when a validated payload arrives.
   * @returns Unsubscribe function removing the handler.
   */
  onServerEvent<Id extends ServerToUiEventId<Defs>>(
    id: Id,
    handler: ServerInboundHandler<Defs, Id>,
  ): () => void;
  /**
   * Registers a handler for client-originated events.
   *
   * @param id - Identifier of the client → UI event.
   * @param handler - Callback executed after payload validation.
   * @returns Unsubscribe function removing the handler.
   */
  onClientEvent<Id extends ClientToUiEventId<Defs>>(
    id: Id,
    handler: ClientInboundHandler<Defs, Id>,
  ): () => void;
}

/**
 * Resolves incoming payloads from the host argument vector.
 *
 * @param _id - Event identifier.
 * @param args - Raw argument array provided by the ALT:V host.
 * @returns Payload forwarded to the bridge registry.
 * @internal
 */
const defaultResolveIncoming: IncomingResolver = (_id, args) => (args.length <= 1 ? args[0] : args);

/**
 * Normalises outbound payloads before emitting to the host.
 *
 * @param _id - Event identifier.
 * @param payload - Parsed payload ready to emit.
 * @returns Arguments passed to the ALT:V emitters.
 * @internal
 */
const defaultPrepareOutgoing: OutgoingPreparer = (_id, payload) => [payload];

/**
 * Default error reporter used for handler exceptions.
 *
 * @param error - Captured runtime error.
 * @returns void
 * @internal
 */
const defaultErrorReporter: ErrorReporter = (error) => {
  console.error('[bridge][altv] handler error', error);
};

/**
 * Resolves the ALT:V host from overrides, custom resolvers, or global scope.
 *
 * @param explicit - Host instance supplied via options.
 * @param resolver - Optional custom resolver used when host is omitted.
 * @returns ALT:V host implementation.
 * @throws Error when no host can be resolved.
 * @internal
 */
const resolveHost = (explicit?: AltVLike, resolver?: HostResolver): AltVLike => {
  if (explicit) {
    return explicit;
  }

  if (resolver) {
    const resolved = resolver();
    if (!resolved) {
      throw new Error('ALT:V bridge host resolver returned a falsy value.');
    }
    return resolved;
  }

  const globalTarget = globalThis as { alt?: AltVLike };

  if (globalTarget?.alt) {
    return globalTarget.alt;
  }

  throw new Error('ALT:V bridge host is not available. Provide a host explicitly.');
};

type HandlerRegistry = Map<string, Map<(...args: unknown[]) => void, (...args: unknown[]) => void>>;

/**
 * Creates a handler registry map for unsubscribe bookkeeping.
 *
 * @returns Fresh handler registry map keyed by event identifier.
 * @internal
 */
const createHandlerRegistry = (): HandlerRegistry => new Map();

/**
 * Tracks the association between user handlers and wrapped host handlers.
 *
 * @param registry - Handler registry map.
 * @param id - Event identifier.
 * @param handler - Original handler provided by the consumer.
 * @param wrapped - Wrapped handler subscribed to the host.
 * @returns Cleanup function removing the mapping.
 * @internal
 */
const registerHandler = (
  registry: HandlerRegistry,
  id: string,
  handler: (...args: unknown[]) => void,
  wrapped: (...args: unknown[]) => void,
): (() => void) => {
  const handlers = registry.get(id) ?? new Map();
  handlers.set(handler, wrapped);
  registry.set(id, handlers);
  return () => {
    const current = registry.get(id);
    current?.delete(handler);
    if (current && current.size === 0) {
      registry.delete(id);
    }
  };
};

/**
 * Retrieves the wrapped handler for a previously registered listener.
 *
 * @param registry - Handler registry map.
 * @param id - Event identifier.
 * @param handler - Original handler provided by the consumer.
 * @returns Wrapped handler or undefined if not registered.
 * @internal
 */
const findWrappedHandler = (
  registry: HandlerRegistry,
  id: string,
  handler: (...args: unknown[]) => void,
): ((...args: unknown[]) => void) | undefined => {
  const handlers = registry.get(id);
  return handlers?.get(handler);
};

/**
 * Creates an ALT:V WebView bridge that enforces typed emit/listen behaviour.
 *
 * @param options - Adapter configuration and host customisations.
 * @returns ALT:V bridge instance bound to the provided schema.
 */
export const createAltVBridge = <Defs extends BridgeEventRecord>(
  options: AltVBridgeOptions<Defs>,
): AltVBridge<Defs> => {
  const host = resolveHost(options.host, options.hostResolver);
  const schema = options.schema;
  const registry = options.registry ?? createBridgeRegistry(schema);
  const resolveIncoming = options.resolveIncomingPayload ?? defaultResolveIncoming;
  const prepareOutgoing = options.prepareOutgoingPayload ?? defaultPrepareOutgoing;
  const reportError = options.onError ?? defaultErrorReporter;

  const serverHandlers = createHandlerRegistry();
  const clientHandlers = createHandlerRegistry();

  const assertDirection = (
    id: keyof Defs,
    direction: Defs[keyof Defs]['direction'],
  ): Defs[keyof Defs] => {
    const event = registry.getEvent(id);

    if (event.direction !== direction) {
      throw new BridgeSchemaError(
        `Event "${String(id)}" is declared as "${event.direction}" but was used as "${direction}"`,
      );
    }

    return event;
  };

  const emitToServer = <Id extends UiToServerEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToServerEvents<Defs>[Id]>,
  ): void => {
    const event = assertDirection(id, 'ui-to-server');
    const parsed = event.payload.parse(payload);
    const args = prepareOutgoing(String(id), parsed);
    host.emitServer(String(id), ...args);
  };

  const emitToClient = <Id extends UiToClientEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToClientEvents<Defs>[Id]>,
  ): void => {
    const event = assertDirection(id, 'ui-to-client');
    const parsed = event.payload.parse(payload);
    const args = prepareOutgoing(String(id), parsed);
    host.emit(String(id), ...args);
  };

  const onServerEvent = <Id extends ServerToUiEventId<Defs>>(
    id: Id,
    handler: ServerInboundHandler<Defs, Id>,
  ): (() => void) => {
    assertDirection(id, 'server-to-ui');

    const wrapped: (...args: unknown[]) => void = (...args: unknown[]) => {
      try {
        const incoming = resolveIncoming(String(id), args);
        const parsed = registry.parsePayload(id, incoming);
        const result = handler(parsed as InferBridgePayload<ServerToUiEvents<Defs>[Id]>);
        if (result instanceof Promise) {
          void result.catch(reportError);
        }
      } catch (error) {
        reportError(error);
      }
    };

    const cleanupRegistry = registerHandler(
      serverHandlers,
      String(id),
      handler as (...args: unknown[]) => void,
      wrapped,
    );

    host.onServer(String(id), wrapped);

    return () => {
      const stored = findWrappedHandler(
        serverHandlers,
        String(id),
        handler as (...args: unknown[]) => void,
      );

      if (stored) {
        host.offServer(String(id), stored);
      }

      cleanupRegistry();
    };
  };

  const onClientEvent = <Id extends ClientToUiEventId<Defs>>(
    id: Id,
    handler: ClientInboundHandler<Defs, Id>,
  ): (() => void) => {
    assertDirection(id, 'client-to-ui');

    const wrapped: (...args: unknown[]) => void = (...args: unknown[]) => {
      try {
        const incoming = resolveIncoming(String(id), args);
        const parsed = registry.parsePayload(id, incoming);
        const result = handler(parsed as InferBridgePayload<ClientToUiEvents<Defs>[Id]>);
        if (result instanceof Promise) {
          void result.catch(reportError);
        }
      } catch (error) {
        reportError(error);
      }
    };

    const cleanupRegistry = registerHandler(
      clientHandlers,
      String(id),
      handler as (...args: unknown[]) => void,
      wrapped,
    );

    host.on(String(id), wrapped);

    return () => {
      const stored = findWrappedHandler(
        clientHandlers,
        String(id),
        handler as (...args: unknown[]) => void,
      );

      if (stored) {
        host.off(String(id), stored);
      }

      cleanupRegistry();
    };
  };

  return {
    schema,
    registry,
    emitToServer,
    emitToClient,
    onServerEvent,
    onClientEvent,
  };
};
