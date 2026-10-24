import { Injectable, signal } from '@angular/core';
import type { TrackEvent } from '@maximusft/google-events';

/** A local receiver, shared across routes; no SDK or network is involved. */
@Injectable({ providedIn: 'root' })
export class EventLog {
  readonly events = signal<TrackEvent[]>([]);
  record(event: TrackEvent) { this.events.update(events => [...events, event]); }
}
