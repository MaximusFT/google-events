/** Validate adapter envelopes without adding provider-specific rules to the neutral core. */
export function requireRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

/** Names are checked without trimming/changing the event sent by the application. */
export function requireEventName(value: unknown, label: string, maxLength?: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || (maxLength !== undefined && value.length > maxLength)) {
    throw new TypeError(`Invalid ${label} event name`);
  }
}
