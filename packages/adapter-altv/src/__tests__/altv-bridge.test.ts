import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  BridgeSchema,
  BridgeSchemaError,
  createBridgeSchema,
  defineEvent,
  defineSchema,
} from '../../../core/src';
import { AltVBridge, AltVBridgeOptions, type AltVLike, createAltVBridge } from '../index';

type Schema = ReturnType<typeof createSchema>['schema'];
type Definitions = Schema['events'];
type BridgeInstance = AltVBridge<Definitions>;

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
  host: AltVLike;
  onHandlers: Map<string, Set<(...args: unknown[]) => void>>;
  onServerHandlers: Map<string, Set<(...args: unknown[]) => void>>;
}

const createHost = (): HostFixture => {
  const onHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const onServerHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const host: AltVLike = {
    emit: vi.fn(),
    emitServer: vi.fn(),
    on: vi.fn((event, handler) => {
      const handlers = onHandlers.get(event) ?? new Set();
      handlers.add(handler);
      onHandlers.set(event, handlers);
    }),
    onServer: vi.fn((event, handler) => {
      const handlers = onServerHandlers.get(event) ?? new Set();
      handlers.add(handler);
      onServerHandlers.set(event, handlers);
    }),
    off: vi.fn((event, handler) => {
      onHandlers.get(event)?.delete(handler);
    }),
    offServer: vi.fn((event, handler) => {
      onServerHandlers.get(event)?.delete(handler);
    }),
  };

  return { host, onHandlers, onServerHandlers };
};

describe('createAltVBridge', () => {
  let schema: Schema;
  let hostFixture: ReturnType<typeof createHost>;
  let bridge: BridgeInstance;

  function createBridge(overrides?: Partial<AltVBridgeOptions<Definitions>>): BridgeInstance {
    hostFixture = createHost();
    schema = createSchema().schema;

    bridge = createAltVBridge({
      schema,
      host: hostFixture.host,
      ...overrides,
    });

    return bridge;
  }

  beforeEach(() => {
    createBridge();
  });

  it('emits typed payloads to the server', () => {
    bridge.emitToServer('mission:accept', { missionId: 'alpha' });

    expect(hostFixture.host.emitServer).toHaveBeenCalledWith('mission:accept', {
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

    expect(hostFixture.host.emit).toHaveBeenCalledWith('hud:toggle', {
      visible: true,
    });
  });

  it('registers server events and validates incoming payloads', () => {
    const handler = vi.fn();

    const unsubscribe = bridge.onServerEvent('mission:update', handler);
    const wrappedHandler = hostFixture.onServerHandlers
      .get('mission:update')
      ?.values()
      .next().value;

    expect(hostFixture.host.onServer).toHaveBeenCalled();
    expect(typeof wrappedHandler).toBe('function');

    wrappedHandler({ missionId: 'alpha', status: 'complete' });
    expect(handler).toHaveBeenCalledWith({ missionId: 'alpha', status: 'complete' });

    unsubscribe();
    expect(hostFixture.host.offServer).toHaveBeenCalled();
  });

  it('routes handler errors to the provided reporter', () => {
    const errorReporter = vi.fn();
    const localBridge = createAltVBridge({
      schema,
      host: hostFixture.host,
      onError: errorReporter,
    });

    localBridge.onServerEvent('mission:update', () => {
      throw new Error('boom');
    });

    const wrappedHandler = hostFixture.onServerHandlers
      .get('mission:update')
      ?.values()
      .next().value;
    expect(wrappedHandler).toBeTruthy();

    wrappedHandler({ missionId: 'alpha', status: 'pending' });
    expect(errorReporter).toHaveBeenCalled();
  });

  it('subscribes to client-originated events', () => {
    const handler = vi.fn();
    const unsubscribe = bridge.onClientEvent('cursor:position', handler);
    const wrapped = hostFixture.onHandlers.get('cursor:position')?.values().next().value;

    expect(hostFixture.host.on).toHaveBeenCalled();
    wrapped({ x: 100, y: 200 });
    expect(handler).toHaveBeenCalledWith({ x: 100, y: 200 });

    unsubscribe();
    expect(hostFixture.host.off).toHaveBeenCalled();
  });

  it('supports custom payload transformers', () => {
    const localHost = createHost();
    const localBridge = createAltVBridge({
      schema,
      host: localHost.host,
      resolveIncomingPayload: (_id, args) => args[1],
      prepareOutgoingPayload: (_id, payload) => ['marker', payload],
    });

    localBridge.emitToClient('hud:toggle', { visible: false });
    expect(localHost.host.emit).toHaveBeenCalledWith('hud:toggle', 'marker', { visible: false });

    const handler = vi.fn();
    localBridge.onServerEvent('mission:update', handler);
    const wrapped = localHost.onServerHandlers.get('mission:update')?.values().next().value;

    wrapped('meta', { missionId: 'bravo', status: 'pending' });
    expect(handler).toHaveBeenCalledWith({ missionId: 'bravo', status: 'pending' });
  });
});
