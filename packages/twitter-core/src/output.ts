import YAML from "yaml";

export const SCHEMA_VERSION = "1";

export interface StructuredSuccess<T> {
  ok: true;
  schema_version: "1";
  data: T;
  pagination?: {
    nextCursor?: string;
  };
}

export interface StructuredError {
  ok: false;
  schema_version: "1";
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function successPayload<T>(data: T, pagination?: { nextCursor?: string }): StructuredSuccess<T> {
  return pagination?.nextCursor
    ? { ok: true, schema_version: SCHEMA_VERSION, data, pagination }
    : { ok: true, schema_version: SCHEMA_VERSION, data };
}

export function errorPayload(code: string, message: string, details?: unknown): StructuredError {
  return details === undefined
    ? { ok: false, schema_version: SCHEMA_VERSION, error: { code, message } }
    : { ok: false, schema_version: SCHEMA_VERSION, error: { code, message, details } };
}

export function encodeStructured(data: unknown, format: "json" | "yaml"): string {
  if (format === "json") {
    return `${JSON.stringify(data, null, 2)}\n`;
  }
  return YAML.stringify(data);
}
