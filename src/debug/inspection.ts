import { copyEvent } from '../core/events.js';
import type { DomCollection } from '../dom/types.js';
import type { ReceiverPreview } from '../delivery/types.js';

/** Collection plus selection preview; it contains neither a transformed SDK payload nor a delivery receipt. */
export interface TrackInspection extends DomCollection {
  receivers: ReceiverPreview[];
}

/** Isolate diagnostic mutation while preserving source-node identity for inspection tools. */
export function copyInspection(inspection: TrackInspection): TrackInspection {
  return {
    ...inspection,
    event: inspection.event ? copyEvent(inspection.event) : false,
    issues: inspection.issues.map((issue) => ({ ...issue })),
    fields: Object.fromEntries(Object.entries(inspection.fields).map(([key, field]) => [key, {
      ...field, overridden: field.overridden.map((source) => ({ ...source })),
    }])),
    receivers: inspection.receivers.map((receiver) => ({ ...receiver })),
  };
}

/** Hooks cannot interrupt dispatch; their asynchronous work is deliberately outside flush. */
export function notifyDiagnostic(inspection: TrackInspection, handler?: (inspection: TrackInspection) => void | Promise<void>) {
  if (!inspection.issues.length || !handler) return;
  try {
    Promise.resolve(handler(copyInspection(inspection))).catch((error: unknown) => {
      console.error('Analytics onDiagnostic handler failed', error);
    });
  } catch (error) { console.error('Analytics onDiagnostic handler failed', error); }
}
