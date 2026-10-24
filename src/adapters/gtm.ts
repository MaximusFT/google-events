import { copyEvent, type TrackEvent } from '../core/events.js';
import type { EventFilter, EventReceiver, ReceiverContext } from '../delivery/types.js';
import { createDataLayerReceiver } from './data-layer.js';
import { requireEventName, requireRecord } from './payload.js';

export interface GtmPayload { event: string; [key: string]: unknown }
export interface GtmReceiverOptions {
  name?: string;
  layerName?: string;
  window?: Window;
  filter?: EventFilter<TrackEvent>;
  transform?: (event: TrackEvent, context: ReceiverContext) => GtmPayload;
}

/**
 * Push a GTM Custom Event envelope into the chosen layer, without loading a container.
 * The default event key wins over a user property named event; custom transforms can rename it explicitly.
 * Queue acceptance does not mean a tag fired or data reached an analytics server.
 */
export function createGtmReceiver(options: GtmReceiverOptions = {}): EventReceiver<TrackEvent> {
  return createDataLayerReceiver<TrackEvent>({
    name: options.name ?? 'gtm',
    layerName: options.layerName,
    window: options.window,
    filter: options.filter,
    transform: (event, context) => {
      const payload = options.transform ? options.transform(event, context) : { ...event.properties, event: event.name };
      requireRecord(payload, 'GTM payload');
      requireEventName(payload.event, 'GTM');
      return copyEvent(payload);
    },
  });
}
