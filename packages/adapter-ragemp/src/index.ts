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
 * Minimal RageMP event facade exposed to the browser runtime.
 */
export interface RageMPEventsLike {
  /** Registers a listener for browser-level events. */
  add(eventName: string, listener: (...args: unknown[]) => void): unknown;
  /** Removes a previously registered listener. */
  remove?(eventName: string, listener: (...args: unknown[]) => void): unknown;
  /** Emits events towards the server runtime. */
  callRemote?(eventName: string, ...args: unknown[]): unknown;
}

/**
 * Minimal RageMP host API used by the adapter.
 */
export interface RageMPLike {
  /** Emits events towards the client runtime. */
  trigger(eventName: string, ...args: unknown[]): unknown;
  /** Host event facade used for registration/removal and remote calls. */
  events: RageMPEventsLike;
}

interface RageMPGlobal {
  mp?: RageMPLike;
}

type IncomingResolver = (id: string, args: unknown[]) => unknown;
type OutgoingPreparer = (id: string, payload: unknown) => unknown[];
type ErrorReporter = (error: unknown) => void;
type HostResolver = () => RageMPLike;
type ListenerRegistrar = (
  host: RageMPLike,
  event: string,
  listener: (...args: unknown[]) => void,
) => void;
type ListenerRemover = (
  host: RageMPLike,
  event: string,
  listener: (...args: unknown[]) => void,
) => void;
type Emitter = (host: RageMPLike, event: string, args: unknown[]) => void;

/**
 * Configuration options for the RageMP bridge adapter.
 */
export interface RageMPBridgeOptions<Defs extends BridgeEventRecord> {
  /** Immutable schema describing the bridge catalogue. */
  schema: BridgeSchema<Defs>;
  /** Optional host instance; defaults to resolving the global `mp` object. */
  host?: RageMPLike;
  /** Pre-built registry instance shared across adapters. */
  registry?: BridgeRegistry<Defs>;
  /** Custom resolver for inbound payloads emitted by the host. */
  resolveIncomingPayload?: IncomingResolver;
  /** Serializer invoked before delegating payloads to the host emitters. */
  prepareOutgoingPayload?: OutgoingPreparer;
  /** Error reporting hook triggered when handlers throw. */
  onError?: ErrorReporter;
  /** Custom registration hook for server → UI events. */
  registerServerEvent?: ListenerRegistrar;
  /** Custom removal hook for server → UI events. */
  removeServerEvent?: ListenerRemover;
  /** Custom registration hook for client → UI events. */
  registerClientEvent?: ListenerRegistrar;
  /** Custom removal hook for client → UI events. */
  removeClientEvent?: ListenerRemover;
  /** Emitter used to forward payloads to the server runtime. */
  emitToServer?: Emitter;
  /** Emitter used to forward payloads to the client runtime. */
  emitToClient?: Emitter;
  /** Resolver executed when `host` is omitted; should return a RageMP host instance. */
  hostResolver?: HostResolver;
}

/**
 * API surface exposed by `createRageMPBridge`.
 */
export interface RageMPBridge<Defs extends BridgeEventRecord> {
  /**
   *
   */
  readonly schema: BridgeSchema<Defs>;
  /**
   *
   */
  readonly registry: BridgeRegistry<Defs>;
  /**
   *
   */
  emitToServer<Id extends UiToServerEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToServerEvents<Defs>[Id]>,
  ): void;
  /**
   *
   */
  emitToClient<Id extends UiToClientEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToClientEvents<Defs>[Id]>,
  ): void;
  /**
   *
   */
  onServerEvent<Id extends ServerToUiEventId<Defs>>(
    id: Id,
    handler: ServerInboundHandler<Defs, Id>,
  ): () => void;
  /**
   *
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
 * @param args - Raw argument array provided by RageMP.
 * @returns Payload forwarded to the bridge registry.
 * @internal
 */
const defaultResolveIncoming: IncomingResolver = (_id, args) => (args.length <= 1 ? args[0] : args);

/**
 * Normalises outbound payloads before emitting to the host.
 *
 * @param _id - Event identifier.
 * @param payload - Parsed payload ready to emit.
 * @returns Arguments passed to RageMP emitters.
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
  console.error('[bridge][ragemp] handler error', error);
};

/**
 * Resolves the RageMP host from overrides, custom resolvers, or global scope.
 *
 * @param explicit - Optional host instance supplied by the consumer.
 * @param resolver - Custom resolver executed when host is omitted.
 * @returns RageMP host implementation.
 * @internal
 */
const resolveHost = (explicit?: RageMPLike, resolver?: HostResolver): RageMPLike => {
  if (explicit) {
    return explicit;
  }

  if (resolver) {
    const resolved = resolver();
    if (!resolved) {
      throw new Error('RageMP bridge host resolver returned a falsy value.');
    }
    return resolved;
  }

  const globalTarget = globalThis as RageMPGlobal;

  if (globalTarget?.mp) {
    return globalTarget.mp;
  }

  throw new Error('RageMP bridge host is not available. Provide a host explicitly.');
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
 * Default implementation for registering events with RageMP.
 *
 * @param host - RageMP host reference.
 * @param event - Event identifier.
 * @param listener - Handler subscribed to the host.
 * @returns void
 * @internal
 */
const defaultRegisterEvent: ListenerRegistrar = (host, event, listener) => {
  if (typeof host.events?.add !== 'function') {
    throw new Error('RageMP host cannot register events: events.add is not defined.');
  }

  host.events.add(event, listener);
};

/**
 * Default implementation for removing registered handlers.
 *
 * @param host - RageMP host reference.
 * @param event - Event identifier.
 * @param listener - Handler previously registered.
 * @returns void
 * @internal
 */
const defaultRemoveEvent: ListenerRemover = (host, event, listener) => {
  if (typeof host.events?.remove === 'function') {
    host.events.remove(event, listener);
  }
};

/**
 * Emits payloads towards the client runtime.
 *
 * @param host - RageMP host reference.
 * @param event - Event identifier.
 * @param args - Payload arguments after normalisation.
 * @returns void
 * @internal
 */
const defaultEmitToClient: Emitter = (host, event, args) => {
  host.trigger(event, ...args);
};

/**
 * Emits payloads towards the server runtime.
 *
 * @param host - RageMP host reference.
 * @param event - Event identifier.
 * @param args - Payload arguments after normalisation.
 * @returns void
 * @internal
 */
const defaultEmitToServer: Emitter = (host, event, args) => {
  if (!host.events.callRemote) {
    throw new Error('RageMP host cannot emit to server: events.callRemote is not defined.');
  }

  host.events.callRemote(event, ...args);
};

/**
 * Creates a RageMP bridge that mirrors the ALT:V adapter surface.
 *
 * @param options - Adapter configuration and host customisations.
 * @returns RageMP bridge instance bound to the provided schema.
 */
export const createRageMPBridge = <Defs extends BridgeEventRecord>(
  options: RageMPBridgeOptions<Defs>,
): RageMPBridge<Defs> => {
  const host = resolveHost(options.host, options.hostResolver);
  const schema = options.schema;
  const registry = options.registry ?? createBridgeRegistry(schema);
  const resolveIncoming = options.resolveIncomingPayload ?? defaultResolveIncoming;
  const prepareOutgoing = options.prepareOutgoingPayload ?? defaultPrepareOutgoing;
  const reportError = options.onError ?? defaultErrorReporter;
  const registerServerEvent = options.registerServerEvent ?? defaultRegisterEvent;
  const removeServerEvent = options.removeServerEvent ?? defaultRemoveEvent;
  const registerClientEvent = options.registerClientEvent ?? defaultRegisterEvent;
  const removeClientEvent = options.removeClientEvent ?? defaultRemoveEvent;
  const emitToServerImpl = options.emitToServer ?? defaultEmitToServer;
  const emitToClientImpl = options.emitToClient ?? defaultEmitToClient;

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
    emitToServerImpl(host, String(id), args);
  };

  const emitToClient = <Id extends UiToClientEventId<Defs>>(
    id: Id,
    payload: InferBridgePayload<UiToClientEvents<Defs>[Id]>,
  ): void => {
    const event = assertDirection(id, 'ui-to-client');
    const parsed = event.payload.parse(payload);
    const args = prepareOutgoing(String(id), parsed);
    emitToClientImpl(host, String(id), args);
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

    registerServerEvent(host, String(id), wrapped);

    return () => {
      const stored = findWrappedHandler(
        serverHandlers,
        String(id),
        handler as (...args: unknown[]) => void,
      );

      if (stored) {
        removeServerEvent(host, String(id), stored);
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

    registerClientEvent(host, String(id), wrapped);

    return () => {
      const stored = findWrappedHandler(
        clientHandlers,
        String(id),
        handler as (...args: unknown[]) => void,
      );

      if (stored) {
        removeClientEvent(host, String(id), stored);
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
