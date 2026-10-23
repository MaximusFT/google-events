export type TrackValue = string | number | boolean;
export type TrackProperties = Record<string, TrackValue>;
export type TrackTrigger = 'click' | 'change' | 'submit' | 'manual';

/** Provider-neutral event; DOM sources and SDK configuration are deliberately kept outside it. */
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
