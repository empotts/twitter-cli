import { encodeStructured, errorPayload, successPayload } from "@twitter-cli-ts/core";

export type StructuredMode = "json" | "yaml" | undefined;

export function defaultStructuredFormat({
  asJson,
  asYaml,
  isStdoutTty,
  outputEnv = process.env.OUTPUT ?? "auto",
}: {
  asJson: boolean;
  asYaml: boolean;
  isStdoutTty: boolean;
  outputEnv?: string;
}): StructuredMode {
  if (asJson && asYaml) {
    throw new Error("Use only one of --json or --yaml.");
  }
  if (asYaml) {
    return "yaml";
  }
  if (asJson) {
    return "json";
  }
  const normalized = outputEnv.trim().toLowerCase();
  if (normalized === "yaml") {
    return "yaml";
  }
  if (normalized === "json") {
    return "json";
  }
  if (normalized === "rich") {
    return undefined;
  }
  return isStdoutTty ? undefined : "yaml";
}

export function emitSuccess(data: unknown, mode: StructuredMode, pagination?: { nextCursor?: string }): string | undefined {
  if (!mode) {
    return undefined;
  }
  return encodeStructured(successPayload(data, pagination), mode);
}

export function emitError(code: string, message: string, mode: StructuredMode, details?: unknown): string | undefined {
  if (!mode) {
    return undefined;
  }
  return encodeStructured(errorPayload(code, message, details), mode);
}
