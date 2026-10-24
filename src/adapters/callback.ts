import type { EventFilter, EventReceiver, ReceiverContext } from '../delivery/types.js';

export interface CallbackOptions<T, E> {
  name: string;
  filter?: EventFilter<E>;
  transform?: (event: E, context: ReceiverContext) => T;
  send(payload: T, context: ReceiverContext): void | Promise<void>;
}

/** Adapt an existing client callback; transformation happens only during send, never inspect. */
export function createCallbackReceiver<E>(options: CallbackOptions<E, E> & { transform?: undefined }): EventReceiver<E>;
export function createCallbackReceiver<T, E>(options: CallbackOptions<T, E> & { transform: NonNullable<CallbackOptions<T, E>['transform']> }): EventReceiver<E>;
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
