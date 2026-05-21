import { describe, expect, test } from "vitest";
import YAML from "yaml";

import { encodeStructured, errorPayload, successPayload } from "../src/index";

describe("output", () => {
  test("success payload structure", () => {
    const payload = successPayload({ key: "value" });
    expect(payload.ok).toBe(true);
    expect(payload.schema_version).toBe("1");
    expect(payload.data).toEqual({ key: "value" });
  });

  test("error payload with details", () => {
    const payload = errorPayload("api_error", "oops", { id: "123" });
    expect(payload.ok).toBe(false);
    expect(payload.error.details).toEqual({ id: "123" });
  });

  test("encodeStructured json", () => {
    const encoded = encodeStructured(successPayload({ key: "val" }), "json");
    const parsed = JSON.parse(encoded) as { ok: boolean; data: { key: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.key).toBe("val");
  });

  test("encodeStructured yaml", () => {
    const encoded = encodeStructured(successPayload({ key: "val" }), "yaml");
    const parsed = YAML.parse(encoded) as { ok: boolean; data: { key: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.key).toBe("val");
  });
});
