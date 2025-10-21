import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  BridgeValidationError,
  createBridgeRegistry,
  createBridgeSchema,
  defineEvent,
  defineSchema,
} from '../index';

const schema = createBridgeSchema()
  .event('mission:update', {
    direction: 'server-to-ui',
    summary: 'Broadcasts mission updates to the UI layer.',
    payload: z.object({
      missionId: z.string(),
      status: z.enum(['pending', 'in-progress', 'complete']),
    }),
  })
  .merge(
    defineSchema({
      'market:purchase': defineEvent('market:purchase', {
        direction: 'ui-to-server',
        reliability: 'rpc',
        payload: z.object({
          itemId: z.string(),
          quantity: z.number().int().positive(),
        }),
        response: z.object({
          receiptId: z.string(),
          total: z.number().positive(),
        }),
      }),
    }),
  )
  .build();

const registry = createBridgeRegistry(schema);

describe('bridge schema builder', () => {
  it('registers events with typed payloads', () => {
    const definition = schema.getEvent('mission:update');

    expect(definition.summary).toBe('Broadcasts mission updates to the UI layer.');
    expect(definition.payload.safeParse({ missionId: 'xyz', status: 'pending' }).success).toBe(
      true,
    );
  });

  it('lists events by direction', () => {
    const serverToUi = schema.listByDirection('server-to-ui');

    expect(serverToUi).toHaveLength(1);
    expect(serverToUi[0].id).toBe('mission:update');
  });

  it('serialises to documentation-friendly JSON', () => {
    const payload = schema.toJSON();

    expect(payload.events).toHaveLength(2);
    expect(payload.events[0]).toMatchObject({
      id: 'mission:update',
      direction: 'server-to-ui',
    });
  });
});

describe('bridge registry', () => {
  it('validates payloads using the declared schema', () => {
    expect(
      registry.parsePayload('mission:update', {
        missionId: 'abc',
        status: 'in-progress',
      }),
    ).toStrictEqual({
      missionId: 'abc',
      status: 'in-progress',
    });
  });

  it('throws a validation error for invalid payloads', () => {
    expect(() =>
      registry.parsePayload('mission:update', {
        missionId: 'abc',
        status: 'invalid',
      }),
    ).toThrow(BridgeValidationError);
  });

  it('validates RPC responses when defined', () => {
    const response = registry.parseResponse('market:purchase', {
      receiptId: '123',
      total: 99.5,
    });

    expect(response.receiptId).toBe('123');
  });

  it('throws when validating a response for an event without RPC schema', () => {
    expect(() => registry.parseResponse('mission:update', {})).toThrowError();
  });

  it('exposes the underlying schema snapshot', () => {
    const snapshot = registry.snapshot();

    expect(snapshot.size).toBe(schema.size);
    expect(snapshot.events).toBe(schema.events);
  });
});
