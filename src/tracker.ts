import { ancestorPath, eventElement } from './context.js';
import { copyEvent, type TrackEvent, type TrackProperties, type TrackTrigger, type TrackValue } from './events.js';
import { createDelivery, type DeliveryOptions, type ReceiverPreview } from './receivers.js';
import { prepareSchema, reservedAttributes, validPropertyName, validateEvent, type PreparedSchema, type TrackSchema, type ValidationIssue } from './schema.js';

export interface FieldSource {
  element: Element | null;
  attribute: string | null;
  raw: unknown;
}
export interface FieldTrace extends FieldSource {
  value?: TrackValue;
  overridden: FieldSource[];
}
export interface TrackInspection {
  event: TrackEvent | false;
  action: Element | null;
  boundary: Element | Document | null;
  fields: Record<string, FieldTrace>;
  issues: ValidationIssue[];
  receivers: ReceiverPreview[];
}
export interface TrackerOptions extends DeliveryOptions<TrackEvent> {
  root?: Document | Element;
  automatic?: boolean;
  /** Capture context before UI handlers mutate/remove the action. Default: bubble phase. */
  capture?: boolean;
  schema?: TrackSchema;
  /** Per-event fields override common field definitions. */
  events?: Record<string, TrackSchema>;
  onDiagnostic?: (inspection: TrackInspection) => void | Promise<void>;
}
export interface TrackElementOptions {
  name?: string;
  trigger?: TrackTrigger;
  properties?: TrackProperties;
}
export interface ManualTrackOptions { trigger?: TrackTrigger; document?: Document }

export function createTracker(options: TrackerOptions = {}) {
  const delivery = createDelivery<TrackEvent>(options);
  const commonSchema = prepareSchema(options.schema);
  const eventSchemas: Record<string, PreparedSchema> = Object.fromEntries(
    Object.entries(options.events ?? {}).map(([name, schema]) => [name, prepareSchema({ ...options.schema, ...schema })])
  );
  let root = options.root;
  let subscribedRoot: Document | Element | undefined;
  let unsubscribe: (() => void) | undefined;
  const schemaFor = (name: string) => Object.prototype.hasOwnProperty.call(eventSchemas, name) ? eventSchemas[name] : commonSchema;
  const documentFor = () => root?.nodeType === 9 ? root as Document : root?.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);

  function inspect(element: Element, overrides: TrackElementOptions = {}, preview = true): TrackInspection {
    const result: TrackInspection = { event: false, action: null, boundary: null, fields: {}, issues: [], receivers: [] };
    const path = ancestorPath(element);
    const bound = root ?? element.ownerDocument;
    const index = bound.nodeType === 1 ? path.indexOf(bound as Element) : path.length - 1;
    if (index < 0 || (bound.nodeType === 9 && element.ownerDocument !== bound)) {
      result.issues.push({ code: 'outside-root', message: 'Element is outside the tracker root', blocking: true });
      return result;
    }
    const bounded = path.slice(0, index + 1);
    const scopeIndex = bounded.findIndex((node) => node.hasAttribute('data-track-root'));
    const scope = scopeIndex < 0 ? bounded : bounded.slice(0, scopeIndex + 1);
    result.boundary = scopeIndex < 0 ? bound : scope[scope.length - 1];
    const actionIndex = scope.findIndex((node) => node.hasAttribute('data-track-event'));
    if (actionIndex < 0) {
      result.issues.push({ code: 'missing-action', message: 'No data-track-event within the boundary', blocking: true });
      return result;
    }
    const action = scope[actionIndex];
    result.action = action;
    const name = overrides.name ?? action.getAttribute('data-track-event')!;
    const trigger = overrides.trigger ?? action.getAttribute('data-track-trigger') ?? 'click';
    const schema = schemaFor(name);
    const propertyFor = new Map(Object.entries(schema).map(([key, field]) => [field.attribute, key]));
    const traces = new Map<string, FieldTrace>();
    for (const node of scope.slice(actionIndex)) {
      for (const attribute of Array.from(node.attributes)) {
        if (!attribute.name.startsWith('data-track-') || reservedAttributes.has(attribute.name)) continue;
        const key = propertyFor.get(attribute.name) ?? attribute.name.slice('data-track-'.length).replace(/-/g, '_');
        if (!validPropertyName(key)) continue;
        const source: FieldSource = { element: node, attribute: attribute.name, raw: attribute.value };
        const existing = traces.get(key);
        if (existing) existing.overridden.push(source);
        else traces.set(key, { ...source, overridden: [] });
      }
    }
    for (const [key, value] of Object.entries(overrides.properties ?? {})) {
      const existing = traces.get(key);
      traces.set(key, { element: null, attribute: null, raw: value,
        overridden: existing ? [{ element: existing.element, attribute: existing.attribute, raw: existing.raw }, ...existing.overridden] : [] });
    }
    const raw = Object.fromEntries(Array.from(traces, ([key, trace]) => [key, trace.raw]));
    const validated = validateEvent(name, trigger, raw, schema);
    for (const [key, field] of Object.entries(schema)) {
      if (!traces.has(key)) traces.set(key, { element: null, attribute: field.attribute, raw: undefined, overridden: [] });
    }
    for (const [key, trace] of Array.from(traces)) trace.value = validated.properties[key];
    result.fields = Object.fromEntries(traces);
    result.issues.push(...validated.issues);
    if (scope.some((node) => node.hasAttribute('data-track-off'))) {
      result.issues.push({ code: 'disabled', message: 'Tracking is disabled within this boundary', blocking: true });
    }
    result.event = result.issues.some((issue) => issue.blocking) ? false : validated.event;
    if (preview && result.event) result.receivers = delivery.inspect(result.event, { document: element.ownerDocument });
    return result;
  }

  function send(inspection: TrackInspection, sourceDocument?: Document) {
    if (inspection.issues.length && options.onDiagnostic) {
      const diagnostic: TrackInspection = {
        ...inspection,
        event: inspection.event ? copyEvent(inspection.event) : false,
        issues: inspection.issues.map((issue) => ({ ...issue })),
        fields: Object.fromEntries(Object.entries(inspection.fields).map(([key, field]) => [key, {
          ...field, overridden: field.overridden.map((source) => ({ ...source })),
        }])),
        receivers: inspection.receivers.map((receiver) => ({ ...receiver })),
      };
      try {
        Promise.resolve(options.onDiagnostic(diagnostic)).catch((error: unknown) => {
          console.error('Analytics onDiagnostic handler failed', error);
        });
      }
      catch (error) { console.error('Analytics onDiagnostic handler failed', error); }
    }
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
    inspect(element: Element, overrides?: TrackElementOptions) { return inspect(element, overrides); },
    trackElement(element: Element, overrides?: TrackElementOptions) {
      return send(inspect(element, overrides, false), element.ownerDocument);
    },
    track(name: string, properties: TrackProperties = {}, config: ManualTrackOptions = {}) {
      const validated = validateEvent(name, config.trigger ?? 'manual', properties, schemaFor(name));
      const inspection: TrackInspection = { event: validated.event, action: null, boundary: null, fields: {}, issues: validated.issues, receivers: [] };
      return send(inspection, config.document ?? documentFor());
    },
    start(nextRoot?: Document | Element) {
      const target = nextRoot ?? root ?? (typeof document !== 'undefined' ? document : undefined);
      if (!target) return false;
      if (unsubscribe && subscribedRoot === target) return true;
      stop();
      root = target;
      if (options.automatic === false) return true;
      const handler = (event: Event) => {
        const element = eventElement(event);
        if (!element) return;
        const inspection = inspect(element, {}, false);
        if (!inspection.action) return;
        const trigger = inspection.action.getAttribute('data-track-trigger') ?? 'click';
        if (trigger !== event.type) return;
        send(inspection, element.ownerDocument);
      };
      const capture = options.capture ?? false;
      for (const type of ['click', 'change', 'submit']) target.addEventListener(type, handler, capture);
      subscribedRoot = target;
      unsubscribe = () => {
        for (const type of ['click', 'change', 'submit']) target.removeEventListener(type, handler, capture);
      };
      return true;
    },
    stop,
    destroy: stop,
    flush() { return delivery.flush(); },
  };
}
