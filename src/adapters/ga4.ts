import { copyEvent, type TrackEvent } from '../core/events.js';
import type { EventFilter, EventReceiver, ReceiverContext } from '../delivery/types.js';
import { createCallbackReceiver } from './callback.js';
import { requireEventName, requireRecord } from './payload.js';

/** A configured Google tag function; the adapter never issues config/consent commands. */
export type Ga4Client = (command: 'event', name: string, parameters: Record<string, unknown>) => unknown;
export interface Ga4Payload { name: string; params: Record<string, unknown> }
export interface Ga4ReceiverOptions {
  name?: string;
  /** Explicit routing wins over any send_to supplied by event properties or transform. */
  measurementId: string;
  /** Resolve at send time; return undefined while the application has no usable client. */
  getClient: () => Ga4Client | undefined;
  filter?: EventFilter<TrackEvent>;
  transform?: (event: TrackEvent, context: ReceiverContext) => Ga4Payload;
  /** Adapter guard, not a change to the account quota. Defaults to 25 non-routing parameters. */
  maxParameters?: number;
}

/**
 * Route a neutral event to one configured GA4 destination, without loading a script.
 * Top-level booleans become explicit "true"/"false" strings only for this receiver.
 * SDK queue acceptance is not server acknowledgement; genuine returned promises are awaited.
 * @throws {TypeError} Invalid destination, client getter or parameter limit at construction.
 */
export function createGa4Receiver(options: Ga4ReceiverOptions): EventReceiver<TrackEvent> {
  if (typeof options.measurementId !== 'string' || !options.measurementId.trim() || /\s/.test(options.measurementId)) {
    throw new TypeError('GA4 measurementId must be a non-empty destination without whitespace');
  }
  if (typeof options.getClient !== 'function') throw new TypeError('GA4 getClient must be a function');
  const limit = options.maxParameters ?? 25;
  const measurementId = options.measurementId;
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('GA4 maxParameters must be a positive integer');
  return createCallbackReceiver({
    name: options.name ?? 'ga4',
    filter: options.filter,
    transform: (event: TrackEvent, context) => {
      const payload = options.transform ? options.transform(event, context) : { name: event.name, params: event.properties };
      requireRecord(payload, 'GA4 payload');
      requireEventName(payload.name, 'GA4', 40);
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(payload.name)) throw new TypeError('Invalid GA4 event name characters');
      requireRecord(payload.params, 'GA4 params');
      const entries = Object.entries(payload.params).filter(([key]) => key !== 'send_to');
      if (entries.length > limit) throw new TypeError(`GA4 parameter limit exceeded: ${limit}`);
      const params = Object.fromEntries(entries.map(([key, value]) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`Invalid GA4 number: ${key}`);
        return [key, typeof value === 'boolean' ? String(value) : value];
      }));
      return { name: payload.name, params: { ...copyEvent(params), send_to: measurementId } };
    },
    send: async payload => {
      const client = options.getClient();
      if (typeof client !== 'function') throw new Error('GA4 client is unavailable');
      await client('event', payload.name, payload.params);
    },
  });
}
