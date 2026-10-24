import type { TrackEvent, TrackProperties } from '../core/events.js';
import type { EventFilter, EventReceiver, ReceiverContext } from '../delivery/types.js';
import { createCallbackReceiver } from './callback.js';
import { requireEventName, requireRecord } from './payload.js';

/** The existing site's SDK; its website, pageviews and native tracking are owned by the application. */
export interface UmamiClient { track(name: string, data: TrackProperties): unknown }
export interface UmamiPayload { name: string; data: TrackProperties }
export interface UmamiReceiverOptions {
  name?: string;
  getClient: () => UmamiClient | undefined;
  filter?: EventFilter<TrackEvent>;
  transform?: (event: TrackEvent, context: ReceiverContext) => UmamiPayload;
}

/**
 * Send flat primitive event data using an injected Umami client, preserving method binding.
 * Missing clients fail this send without retries; a later event can use a newly available client.
 * Returned promises are awaited, without interpreting arbitrary SDK return values as receipts.
 * @throws {TypeError} The client getter is absent or invalid at construction.
 */
export function createUmamiReceiver(options: UmamiReceiverOptions): EventReceiver<TrackEvent> {
  if (typeof options.getClient !== 'function') throw new TypeError('Umami getClient must be a function');
  return createCallbackReceiver({
    name: options.name ?? 'umami',
    filter: options.filter,
    transform: (event: TrackEvent, context) => {
      const payload = options.transform ? options.transform(event, context) : { name: event.name, data: event.properties };
      requireRecord(payload, 'Umami payload');
      requireEventName(payload.name, 'Umami', 50);
      requireRecord(payload.data, 'Umami data');
      const entries = Object.entries(payload.data);
      if (entries.length > 50) throw new TypeError('Umami data exceeds 50 properties');
      for (const [key, value] of entries) {
        if (!['string', 'number', 'boolean'].includes(typeof value) ||
            (typeof value === 'number' && !Number.isFinite(value)) ||
            (typeof value === 'string' && value.length > 500)) throw new TypeError(`Invalid Umami property: ${key}`);
      }
      return { name: payload.name, data: Object.fromEntries(entries) as TrackProperties };
    },
    send: async payload => {
      const client = options.getClient();
      if (!client || typeof client.track !== 'function') throw new Error('Umami client is unavailable');
      await client.track(payload.name, payload.data);
    },
  });
}
