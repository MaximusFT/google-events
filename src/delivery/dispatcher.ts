import { copyEvent } from '../core/events.js';
import type { DeliveryError, DeliveryErrorHandler, DeliveryOptions, EventReceiver, ReceiverContext, ReceiverPreview } from './types.js';

/** Route independent copies to configured receivers without creating SDK adapters. */
export function createDelivery<E>(options: DeliveryOptions<E> = {}) {
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
  setReceivers(options.receivers ?? []);

  function report(handler: DeliveryErrorHandler<E> | undefined, receiver: string, phase: DeliveryError<E>['phase'], error: unknown, event: E) {
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
