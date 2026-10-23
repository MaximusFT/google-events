/** Legacy GTM event contract. */
export interface AnalyticsEvent {
  action: string;
  event: string;
  data: Record<string, string | undefined>;
  ecommerce?: Record<string, string | undefined>;
}

export type TrackValue = string | number | boolean;
export type TrackProperties = Record<string, TrackValue>;
export type TrackTrigger = 'click' | 'change' | 'submit' | 'manual';

export interface TrackEvent {
  name: string;
  trigger: TrackTrigger;
  properties: TrackProperties;
}

/** Events contain plain data only; receiver copies share no mutable payload objects. */
export function copyEvent<T>(event: T): T {
  if (Array.isArray(event)) return event.map((item) => copyEvent(item)) as T;
  if (event !== null && typeof event === 'object') {
    return Object.fromEntries(Object.entries(event).map(([key, value]) => [key, copyEvent(value)])) as T;
  }
  return event;
}
