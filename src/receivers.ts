import { copyEvent, type AnalyticsEvent } from './events.js';

export interface ReceiverContext {
  /** The source document, so dataLayer delivery uses the correct window, including iframes. */
  document?: Document;
}

export type EventFilter<E = AnalyticsEvent> = (event: E, context: ReceiverContext) => boolean;

export interface EventReceiver<E = AnalyticsEvent> {
  name: string;
  filter?: EventFilter<E>;
  send(event: E, context: ReceiverContext): void | Promise<void>;
}

export interface DeliveryError<E = AnalyticsEvent> {
  receiver: string;
  phase: 'filter' | 'send';
  error: unknown;
  /** Original collected data, unaffected by the failing receiver. */
  event: E;
}

export type DeliveryErrorHandler<E = AnalyticsEvent> = (failure: DeliveryError<E>) => void | Promise<void>;

export interface DeliveryOptions<E = AnalyticsEvent> {
  /** Omitted: dataLayer. Empty array: collection without delivery. Explicit array replaces defaults. */
  receivers?: EventReceiver<E>[];
  onError?: DeliveryErrorHandler<E>;
}

interface CallbackOptions<T, E = AnalyticsEvent> {
  name: string;
  filter?: EventFilter<E>;
  transform?: (event: E, context: ReceiverContext) => T;
  send(payload: T, context: ReceiverContext): void | Promise<void>;
}

export function createCallbackReceiver<E = AnalyticsEvent>(options: CallbackOptions<E, E> & { transform?: undefined }): EventReceiver<E>;
export function createCallbackReceiver<T, E = AnalyticsEvent>(options: CallbackOptions<T, E> & { transform: NonNullable<CallbackOptions<T, E>['transform']> }): EventReceiver<E>;
export function createCallbackReceiver<T, E>(options: CallbackOptions<T, E>): EventReceiver<E> {
  return {
    name: options.name,
    filter: options.filter,
    send(event, context) {
      const payload = options.transform ? options.transform(event, context) : event as unknown as T;
      return options.send(payload, context);
    },
  };
}

export interface DataLayerReceiverOptions<E = AnalyticsEvent> {
  name?: string;
  layerName?: string;
  window?: Window;
  filter?: EventFilter<E>;
  transform?: (event: E, context: ReceiverContext) => unknown;
}

export function createDataLayerReceiver<E = AnalyticsEvent>(options: DataLayerReceiverOptions<E> = {}): EventReceiver<E> {
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

/** Delivery has no listeners, retries, timers or dependency on a global document. */
export interface ReceiverPreview {
  name: string;
  selected: boolean;
  error?: unknown;
}

export function createDelivery<E = AnalyticsEvent>(options: DeliveryOptions<E> = {}) {
  let receivers: EventReceiver<E>[] = [];
  let onError = options.onError;
  const pending = new Set<Promise<void>>();

  function setReceivers(next: EventReceiver<E>[]) {
    const names = new Set<string>();
    for (const receiver of next) {
      if (!receiver.name?.trim() || typeof receiver.send !== 'function') {
        throw new TypeError('Each receiver needs a non-empty name and send method');
      }
      if (names.has(receiver.name)) throw new TypeError(`Duplicate receiver name: ${receiver.name}`);
      names.add(receiver.name);
    }
    receivers = [...next];
  }
  setReceivers(options.receivers ?? [createDataLayerReceiver<E>()]);

  function report(handler: DeliveryErrorHandler<E> | undefined, receiver: string, phase: DeliveryError['phase'], error: unknown, event: E) {
    const failure: DeliveryError<E> = { receiver, phase, error, event: copyEvent(event) };
    if (!handler) {
      console.error(`Analytics receiver "${receiver}" failed during ${phase}`, error);
      return;
    }
    try {
      Promise.resolve(handler(failure)).catch((handlerError: unknown) => {
        console.error('Analytics onError handler failed', handlerError);
      });
    } catch (handlerError) {
      console.error('Analytics onError handler failed', handlerError);
    }
  }

  return {
    configure(next: DeliveryOptions<E>) {
      if (next.receivers !== undefined) setReceivers(next.receivers);
      if ('onError' in next) onError = next.onError;
    },
    inspect(event: E, context: ReceiverContext = {}): ReceiverPreview[] {
      return receivers.map((receiver) => {
        try {
          return { name: receiver.name, selected: !receiver.filter || receiver.filter(copyEvent(event), { ...context }) };
        } catch (error) {
          return { name: receiver.name, selected: false, error };
        }
      });
    },
    dispatch(event: E, context: ReceiverContext = {}): Promise<void> {
      const original = copyEvent(event);
      const handler = onError;
      const deliveries: Promise<void>[] = [];
      // Snapshot configuration: reinit from inside a receiver affects only future events.
      for (const receiver of [...receivers]) {
        const snapshot = copyEvent(original);
        const receiverContext = { ...context };
        try {
          if (receiver.filter && !receiver.filter(snapshot, receiverContext)) continue;
        } catch (error) {
          report(handler, receiver.name, 'filter', error, original);
          continue;
        }
        try {
          const result = receiver.send(snapshot, receiverContext);
          deliveries.push(Promise.resolve(result).catch((error: unknown) => {
            report(handler, receiver.name, 'send', error, original);
          }));
        } catch (error) {
          report(handler, receiver.name, 'send', error, original);
        }
      }
      const completion = Promise.all(deliveries).then(() => {});
      pending.add(completion);
      completion.then(() => pending.delete(completion));
      return completion;
    },
    /** Wait for deliveries already started at the time of this call. */
    flush(): Promise<void> {
      return Promise.all(Array.from(pending)).then(() => {});
    },
  };
}
