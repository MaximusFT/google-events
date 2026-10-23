import type { EventFilter, EventReceiver, ReceiverContext } from '../delivery/types.js';
import { createCallbackReceiver } from './callback.js';

export interface DataLayerReceiverOptions<E> {
  name?: string;
  layerName?: string;
  window?: Window;
  filter?: EventFilter<E>;
  transform?: (event: E, context: ReceiverContext) => unknown;
}

/**
 * Push into the configured layer without replacing its existing push implementation.
 * The source document selects the default window, including iframe events.
 * @throws {TypeError} Empty layer name; delivery reports a malformed queue during send.
 */
export function createDataLayerReceiver<E>(options: DataLayerReceiverOptions<E> = {}): EventReceiver<E> {
  const layerName = options.layerName ?? 'dataLayer';
  if (!layerName.trim()) throw new TypeError('dataLayer name must not be empty');
  return createCallbackReceiver({
    name: options.name ?? 'dataLayer',
    filter: options.filter,
    transform: (event, context) => options.transform ? options.transform(event, context) : event,
    send(payload, context) {
      const view = options.window ?? context.document?.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
      if (!view) throw new Error('dataLayer receiver requires a browser window');
      const target = view as unknown as Record<string, unknown>;
      const layer = target[layerName] ?? (target[layerName] = []);
      if (typeof layer !== 'object' || layer === null || !('push' in layer) || typeof layer.push !== 'function') {
        throw new TypeError(`${layerName} must provide a push method`);
      }
      layer.push(payload);
    },
  });
}
