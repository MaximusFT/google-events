import { ancestorPath } from './tree.js';
import type { FieldSource, FieldTrace, DomCollection, TrackElementOptions } from './types.js';
import type { PreparedSchema } from '../core/schema.js';
import { reservedAttributes, validPropertyName, validateEvent } from '../core/schema.js';

/** Collect bounded context without listeners, receiver previews or delivery side effects. */
export function collectContext(element: Element, root: Document | Element | undefined, schemaFor: (name: string) => PreparedSchema, overrides: TrackElementOptions = {}): DomCollection {
  const result: DomCollection = { event: false, action: null, boundary: null, fields: {}, issues: [] };
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
  return result;
}
