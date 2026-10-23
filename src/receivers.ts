import type { AnalyticsEvent } from './legacy/events.js';
import { createCallbackReceiver as callbackAdapter, type CallbackOptions } from './adapters/callback.js';
import { createDataLayerReceiver as dataLayerAdapter, type DataLayerReceiverOptions as LayerOptions } from './adapters/data-layer.js';
import { createDelivery as createDispatcher } from './delivery/dispatcher.js';
import type * as Delivery from './delivery/types.js';

/** Compatibility defaults stay at the facade; generic delivery does not depend on legacy events. */
export interface ReceiverContext extends Delivery.ReceiverContext {}
export type EventFilter<E = AnalyticsEvent> = Delivery.EventFilter<E>;
export interface EventReceiver<E = AnalyticsEvent> extends Delivery.EventReceiver<E> {}
export interface DeliveryError<E = AnalyticsEvent> extends Delivery.DeliveryError<E> {}
export type DeliveryErrorHandler<E = AnalyticsEvent> = Delivery.DeliveryErrorHandler<E>;
export interface DeliveryOptions<E = AnalyticsEvent> extends Delivery.DeliveryOptions<E> {}
export interface DataLayerReceiverOptions<E = AnalyticsEvent> extends LayerOptions<E> {}
export type { ReceiverPreview } from './delivery/types.js';

/** Wrap a supplied SDK callback; filters/transforms are synchronous and send may be asynchronous. */
export const createCallbackReceiver: {
  <E = AnalyticsEvent>(options: CallbackOptions<E, E> & { transform?: undefined }): EventReceiver<E>;
  <T, E = AnalyticsEvent>(options: CallbackOptions<T, E> & { transform: NonNullable<CallbackOptions<T, E>['transform']> }): EventReceiver<E>;
} = callbackAdapter;

/** Preserve the source window and its existing queue; a push is not a server acknowledgement. */
export const createDataLayerReceiver: <E = AnalyticsEvent>(options?: DataLayerReceiverOptions<E>) => EventReceiver<E> = dataLayerAdapter;

/** Historical source entry: public factories supply the same default adapter at composition time. */
export function createDelivery<E = AnalyticsEvent>(options: DeliveryOptions<E> = {}) {
  return createDispatcher<E>({ ...options, receivers: options.receivers ?? [dataLayerAdapter<E>()] });
}
