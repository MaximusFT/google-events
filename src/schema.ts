import type { TrackEvent, TrackProperties, TrackTrigger, TrackValue } from './events.js';

export type FieldType = 'string' | 'number' | 'boolean';
export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  /** Full HTML attribute name; otherwise derived from the property name. */
  attribute?: string;
}
export type TrackSchema = Record<string, FieldType | FieldDefinition>;
export interface PreparedField extends FieldDefinition { attribute: string }
export type PreparedSchema = Record<string, PreparedField>;

export interface ValidationIssue {
  code: 'required' | 'invalid-type' | 'missing-event' | 'missing-action' | 'disabled' | 'outside-root' | 'invalid-trigger';
  message: string;
  field?: string;
  blocking: boolean;
}

export const reservedAttributes = new Set(['data-track-event', 'data-track-root', 'data-track-off', 'data-track-trigger']);
export const validTriggers: TrackTrigger[] = ['click', 'change', 'submit', 'manual'];

export function validPropertyName(name: string) {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && !['constructor', 'prototype', '__proto__'].includes(name);
}

export function prepareSchema(schema: TrackSchema = {}): PreparedSchema {
  const prepared: [string, PreparedField][] = [];
  const attributes = new Set<string>();
  for (const [name, definition] of Object.entries(schema)) {
    const field = typeof definition === 'string' ? { type: definition } : definition;
    const attribute = field.attribute ?? ('data-track-' + name.replace(/_/g, '-').replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()));
    if (!validPropertyName(name) || !['string', 'number', 'boolean'].includes(field.type) ||
        !/^data-track-[a-z][a-z0-9-]*$/.test(attribute) || reservedAttributes.has(attribute)) {
      throw new TypeError(`Invalid field schema: ${name}`);
    }
    if (attributes.has(attribute)) throw new TypeError(`Duplicate field attribute: ${attribute}`);
    attributes.add(attribute);
    prepared.push([name, { ...field, attribute }]);
  }
  return Object.fromEntries(prepared);
}

function parseValue(raw: unknown, type?: FieldType): TrackValue | undefined {
  if (!type) return ['string', 'number', 'boolean'].includes(typeof raw) &&
    (typeof raw !== 'number' || Number.isFinite(raw)) ? raw as TrackValue : undefined;
  if (type === 'string') return typeof raw === 'string' ? raw : undefined;
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string' && raw.trim() === 'true') return true;
    if (typeof raw === 'string' && raw.trim() === 'false') return false;
    return undefined;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) ? number : undefined;
}

export function validateEvent(name: string, trigger: string, raw: Record<string, unknown>, schema: PreparedSchema) {
  const issues: ValidationIssue[] = [];
  const entries: [string, TrackValue][] = [];
  if (typeof name !== 'string' || !name.trim()) issues.push({ code: 'missing-event', message: 'Event name must not be empty', blocking: true });
  if (!validTriggers.includes(trigger as TrackTrigger)) issues.push({ code: 'invalid-trigger', message: `Unsupported trigger: ${trigger}`, blocking: true });
  const fields = new Set([...Object.keys(raw), ...Object.keys(schema)]);
  for (const key of Array.from(fields)) {
    const field = schema[key];
    const present = Object.prototype.hasOwnProperty.call(raw, key);
    const value = present ? raw[key] : undefined;
    if (!present) {
      if (field?.required) issues.push({ code: 'required', field: key, message: `Required field is absent: ${key}`, blocking: true });
      continue;
    }
    if (!validPropertyName(key)) {
      issues.push({ code: 'invalid-type', field: key, message: `Invalid property name: ${key}`, blocking: true });
      continue;
    }
    const parsed = parseValue(value, field?.type);
    if (parsed === undefined) {
      issues.push({ code: 'invalid-type', field: key, message: `Invalid ${field?.type ?? 'primitive'} value: ${key}`, blocking: Boolean(field?.required) });
    } else if (field?.required && typeof parsed === 'string' && !parsed.trim()) {
      issues.push({ code: 'required', field: key, message: `Required string is empty: ${key}`, blocking: true });
    } else {
      entries.push([key, parsed]);
    }
  }
  const properties: TrackProperties = Object.fromEntries(entries);
  const event: TrackEvent | false = issues.some((issue) => issue.blocking) ? false : { name, trigger: trigger as TrackTrigger, properties };
  return { event, properties, issues };
}
