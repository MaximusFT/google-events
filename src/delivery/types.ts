export interface ReceiverContext {
  /** The source document, so dataLayer delivery uses the correct window, including iframes. */
  document?: Document;
}

export type EventFilter<E> = (event: E, context: ReceiverContext) => boolean;

/** Named destination; send owns its asynchronous work and must not attach DOM listeners. */
export interface EventReceiver<E> {
  name: string;
  filter?: EventFilter<E>;
  send(event: E, context: ReceiverContext): void | Promise<void>;
}

export interface DeliveryError<E> {
  receiver: string;
  phase: 'filter' | 'send';
  error: unknown;
  /** Original collected data, unaffected by the failing receiver. */
  event: E;
}

export type DeliveryErrorHandler<E> = (failure: DeliveryError<E>) => void | Promise<void>;

export interface DeliveryOptions<E> {
  /** Empty means no delivery. Public factories supply their compatibility default when omitted. */
  receivers?: EventReceiver<E>[];
  onError?: DeliveryErrorHandler<E>;
}

/** Selection preview; it never implies successful delivery. */
export interface ReceiverPreview {
  name: string;
  selected: boolean;
  error?: unknown;
}
