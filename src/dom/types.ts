import type { TrackEvent, TrackProperties, TrackTrigger, TrackValue } from '../core/events.js';
import type { ValidationIssue } from '../core/schema.js';

/** A DOM source or a manual override; source nodes are debug metadata, never event properties. */
export interface FieldSource {
  element: Element | null;
  attribute: string | null;
  raw: unknown;
}

/** The nearest source wins; overridden entries retain the remaining ancestor sources. */
export interface FieldTrace extends FieldSource {
  value?: TrackValue;
  overridden: FieldSource[];
}

/** Context collection result before receiver selection. */
export interface DomCollection {
  event: TrackEvent | false;
  action: Element | null;
  boundary: Element | Document | null;
  fields: Record<string, FieldTrace>;
  issues: ValidationIssue[];
}

/** Explicit values take precedence over collected DOM data and use the final event's schema. */
export interface TrackElementOptions {
  name?: string;
  trigger?: TrackTrigger;
  properties?: TrackProperties;
}
