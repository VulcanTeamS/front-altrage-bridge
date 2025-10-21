import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  BridgeSchema,
  BridgeSchemaError,
  createBridgeSchema,
  defineEvent,
  defineSchema,
} from '../../../core/src';
import {
  createRageMPBridge,
  type RageMPBridge,
  type RageMPBridgeOptions,
  type RageMPLike,
} from '../index';

type Schema = ReturnType<typeof createSchema>['schema'];
type Definitions = Schema['events'];
type BridgeInstance = RageMPBridge<Definitions>;

const createSchema = (): { schema: BridgeSchema<Record<string, unknown>> } => {
  const schema = createBridgeSchema()
    .event('mission:update', {
      direction: 'server-to-ui',
      payload: z.object({
        missionId: z.string(),
        status: z.enum(['pending', 'complete']),
      }),
    })
    .merge(
      defineSchema({
        'mission:accept': defineEvent('mission:accept', {
          direction: 'ui-to-server',
          payload: z.object({ missionId: z.string() }),
        }),
        'hud:toggle': defineEvent('hud:toggle', {
          direction: 'ui-to-client',
          payload: z.object({ visible: z.boolean() }),
        }),
        'cursor:position': defineEvent('cursor:position', {
          direction: 'client-to-ui',
          payload: z.object({ x: z.number(), y: z.number() }),
        }),
      }),
    )
    .build();

  return { schema };
};

interface HostFixture {
  host: RageMPLike;
  serverHandlers: Map<string, Set<(...args: unknown[]) => void>>;
  clientHandlers: Map<string, Set<(...args: unknown[]) => void>>;
}

const createHost = (): HostFixture => {
  const serverHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const clientHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const host: RageMPLike = {
    trigger: vi.fn((event, ...args) => {
      clientHandlers.get(event)?.forEach((handler) => handler(...args));
    }),
    events: {
      add: vi.fn((event, handler) => {
        const collection = clientHandlers.get(event) ?? new Set();
        collection.add(handler);
        clientHandlers.set(event, collection);
      }),
      remove: vi.fn((event, handler) => {
        clientHandlers.get(event)?.delete(handler);
      }),
      callRemote: vi.fn(),
    },
  };

  return { host, serverHandlers, clientHandlers };
};

describe('createRageMPBridge', () => {
  let schema: Schema;
  let hostFixture: HostFixture;
  let bridge: BridgeInstance;

  function createBridge(overrides?: Partial<RageMPBridgeOptions<Definitions>>): BridgeInstance {
    schema = createSchema().schema;
    hostFixture = createHost();

    bridge = createRageMPBridge({
      schema,
      host: hostFixture.host,
      registerServerEvent: (host, event, listener) => {
        const handlers = hostFixture.serverHandlers.get(event) ?? new Set();
        handlers.add(listener);
        hostFixture.serverHandlers.set(event, handlers);
      },
      removeServerEvent: (host, event, listener) => {
        hostFixture.serverHandlers.get(event)?.delete(listener);
      },
      ...overrides,
    });

    return bridge;
  }

  beforeEach(() => {
    createBridge();
  });

  it('emits typed payloads to the server', () => {
    bridge.emitToServer('mission:accept', { missionId: 'alpha' });

    expect(hostFixture.host.events.callRemote).toHaveBeenCalledWith('mission:accept', {
      missionId: 'alpha',
    });
  });

  it('throws when emitting with an invalid payload', () => {
    expect(() =>
      bridge.emitToServer('mission:accept', { missionId: 42 } as unknown as { missionId: string }),
    ).toThrow();
  });

  it('refuses to emit events declared for a different direction', () => {
    expect(() =>
      bridge.emitToServer('mission:update' as never, { missionId: 'alpha', status: 'pending' }),
    ).toThrow(BridgeSchemaError);
  });

  it('emits payloads to the client', () => {
    bridge.emitToClient('hud:toggle', { visible: true });

    expect(hostFixture.host.trigger).toHaveBeenCalledWith('hud:toggle', {
      visible: true,
    });
  });

  it('registers server events and validates incoming payloads', () => {
    const handler = vi.fn();
    const unsubscribe = bridge.onServerEvent('mission:update', handler);

    const wrapped = hostFixture.serverHandlers.get('mission:update')?.values().next().value;
    expect(wrapped).toBeTruthy();

    wrapped({ missionId: 'alpha', status: 'complete' });
    expect(handler).toHaveBeenCalledWith({ missionId: 'alpha', status: 'complete' });

    unsubscribe();
    expect(hostFixture.serverHandlers.get('mission:update')?.size ?? 0).toBe(0);
  });

  it('routes handler errors to the provided reporter', () => {
    const reporter = vi.fn();
    const localBridge = createRageMPBridge({
      schema,
      host: hostFixture.host,
      onError: reporter,
      registerServerEvent: (host, event, listener) => {
        const handlers = hostFixture.serverHandlers.get(event) ?? new Set();
        handlers.add(listener);
        hostFixture.serverHandlers.set(event, handlers);
      },
      removeServerEvent: (host, event, listener) => {
        hostFixture.serverHandlers.get(event)?.delete(listener);
      },
    });

    localBridge.onServerEvent('mission:update', () => {
      throw new Error('boom');
    });

    const wrapped = hostFixture.serverHandlers.get('mission:update')?.values().next().value;
    expect(wrapped).toBeTruthy();

    wrapped({ missionId: 'alpha', status: 'pending' });
    expect(reporter).toHaveBeenCalled();
  });

  it('subscribes to client-originated events', () => {
    const handler = vi.fn();
    const unsubscribe = bridge.onClientEvent('cursor:position', handler);

    const wrapped = hostFixture.host.events.add.mock.calls[0][1];
    expect(typeof wrapped).toBe('function');

    wrapped({ x: 100, y: 200 });
    expect(handler).toHaveBeenCalledWith({ x: 100, y: 200 });

    unsubscribe();
    expect(hostFixture.host.events.remove).toHaveBeenCalled();
  });

  it('supports custom payload transformers and emitters', () => {
    const customHost = createHost();
    const emitToServer = vi.fn();
    const emitToClient = vi.fn();
    const bridgeInstance = createRageMPBridge({
      schema,
      host: customHost.host,
      registerServerEvent: (host, event, listener) => {
        const handlers = customHost.serverHandlers.get(event) ?? new Set();
        handlers.add(listener);
        customHost.serverHandlers.set(event, handlers);
      },
      removeServerEvent: (host, event, listener) => {
        customHost.serverHandlers.get(event)?.delete(listener);
      },
      emitToServer,
      emitToClient,
      resolveIncomingPayload: (_id, args) => args[1],
      prepareOutgoingPayload: (_id, payload) => ['marker', payload],
    });

    bridgeInstance.emitToClient('hud:toggle', { visible: false });
    expect(emitToClient).toHaveBeenCalledWith(customHost.host, 'hud:toggle', [
      'marker',
      { visible: false },
    ]);

    bridgeInstance.emitToServer('mission:accept', { missionId: 'delta' });
    expect(emitToServer).toHaveBeenCalledWith(customHost.host, 'mission:accept', [
      'marker',
      { missionId: 'delta' },
    ]);

    const handler = vi.fn();
    bridgeInstance.onServerEvent('mission:update', handler);
    const stored = customHost.serverHandlers.get('mission:update')?.values().next().value;

    stored?.('meta', { missionId: 'bravo', status: 'pending' });

    expect(handler).toHaveBeenCalledWith({ missionId: 'bravo', status: 'pending' });
  });
});
