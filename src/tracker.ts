import type { TrackEvent, TrackProperties, TrackTrigger } from './core/events.js';
import { createSchemaResolver } from './core/configuration.js';
import { validateEvent, type TrackSchema } from './core/schema.js';
import { collectContext } from './dom/collector.js';
import { subscribeInteractions } from './dom/listeners.js';
import type { TrackElementOptions } from './dom/types.js';
import { notifyDiagnostic, type TrackInspection } from './debug/inspection.js';
import { createDelivery } from './delivery/dispatcher.js';
import type { DeliveryOptions } from './delivery/types.js';
import { createDataLayerReceiver } from './adapters/data-layer.js';

export type { TrackInspection } from './debug/inspection.js';
export type { FieldSource, FieldTrace, TrackElementOptions } from './dom/types.js';

/** Instance configuration; SDK-specific mapping belongs to its receiver. */
export interface TrackerOptions extends DeliveryOptions<TrackEvent> {
  /** Hard upper bound for collection and the target for delegated DOM listeners. */
  root?: Document | Element;
  /** False keeps manual calls available without registering DOM listeners. */
  automatic?: boolean;
  /** Capture context before UI handlers mutate/remove the action. Default: bubble phase. */
  capture?: boolean;
  schema?: TrackSchema;
  /** Per-event fields override common field definitions. */
  events?: Record<string, TrackSchema>;
  /** Reports collection issues, isolated from receiver delivery. */
  onDiagnostic?: (inspection: TrackInspection) => void | Promise<void>;
}
/** Source document for window-based receivers; manual validation itself requires no DOM. */
export interface ManualTrackOptions { trigger?: TrackTrigger; document?: Document }

/**
 * Compose an isolated neutral tracker from collection, validation and delivery.
 * Importing or constructing it does not attach listeners or load an SDK.
 * @throws {TypeError} Invalid schema or invalid/duplicate receiver names.
 */
export function createTracker(options: TrackerOptions = {}) {
  const delivery = createDelivery<TrackEvent>({
    ...options, receivers: options.receivers ?? [createDataLayerReceiver<TrackEvent>()],
  });
  const schemaFor = createSchemaResolver(options.schema, options.events);
  let root = options.root;
  let subscribedRoot: Document | Element | undefined;
  let unsubscribe: (() => void) | undefined;
  const documentFor = () => root?.nodeType === 9 ? root as Document : root?.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);

  function inspect(element: Element, overrides: TrackElementOptions = {}, preview = true): TrackInspection {
    const result: TrackInspection = { ...collectContext(element, root, schemaFor, overrides), receivers: [] };
    if (preview && result.event) result.receivers = delivery.inspect(result.event, { document: element.ownerDocument });
    return result;
  }

  function send(inspection: TrackInspection, sourceDocument?: Document) {
    notifyDiagnostic(inspection, options.onDiagnostic);
    if (!inspection.event) return false;
    delivery.dispatch(inspection.event, { document: sourceDocument });
    return inspection.event;
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = undefined;
    subscribedRoot = undefined;
  }

  return {
    /** Collect and preview filters without sending or executing receiver transforms. */
    inspect(element: Element, overrides?: TrackElementOptions) { return inspect(element, overrides); },
    /** Send collected context; return false for blocking collection/validation issues. */
    trackElement(element: Element, overrides?: TrackElementOptions) {
      return send(inspect(element, overrides, false), element.ownerDocument);
    },
    /** Send explicit properties through the same schema/receivers, bypassing DOM root/off. */
    track(name: string, properties: TrackProperties = {}, config: ManualTrackOptions = {}) {
      const validated = validateEvent(name, config.trigger ?? 'manual', properties, schemaFor(name));
      const inspection: TrackInspection = { event: validated.event, action: null, boundary: null, fields: {}, issues: validated.issues, receivers: [] };
      return send(inspection, config.document ?? documentFor());
    },
    /** Idempotently subscribe; return false if no DOM root is available. */
    start(nextRoot?: Document | Element) {
      const target = nextRoot ?? root ?? (typeof document !== 'undefined' ? document : undefined);
      if (!target) return false;
      if (unsubscribe && subscribedRoot === target) return true;
      stop();
      root = target;
      if (options.automatic === false) return true;
      unsubscribe = subscribeInteractions(target, (element, event) => {
        const inspection = inspect(element, {}, false);
        if (!inspection.action) return;
        const trigger = inspection.action.getAttribute('data-track-trigger') ?? 'click';
        if (trigger !== event.type) return;
        send(inspection, element.ownerDocument);
      }, options.capture ?? false);
      subscribedRoot = target;
      return true;
    },
    /** Remove listeners, keeping manual calls and in-flight delivery available. */
    stop,
    /** Compatibility alias for stop; the instance can be started again. */
    destroy: stop,
    /** Await deliveries started before this call, not a server acknowledgement or SDK queue flush. */
    flush() { return delivery.flush(); },
  };
}
