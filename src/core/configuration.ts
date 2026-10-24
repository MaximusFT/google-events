import { prepareSchema, type PreparedSchema, type TrackSchema } from './schema.js';

/** Prepare once; per-event field definitions replace common definitions as a whole. */
export function createSchemaResolver(schema?: TrackSchema, events?: Record<string, TrackSchema>) {
  const common = prepareSchema(schema);
  const perEvent: Record<string, PreparedSchema> = Object.fromEntries(
    Object.entries(events ?? {}).map(([name, fields]) => [name, prepareSchema({ ...schema, ...fields })])
  );
  return (name: string) => Object.prototype.hasOwnProperty.call(perEvent, name) ? perEvent[name] : common;
}
