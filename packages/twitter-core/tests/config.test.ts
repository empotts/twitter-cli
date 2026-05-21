import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { DEFAULT_CONFIG, loadConfig, normalizeConfig } from "../src/index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("config", () => {
  test("loadConfig supports block list YAML", async () => {
    const dir = mkdtempSync(join(tmpdir(), "twitter-core-config-"));
    tempDirs.push(dir);
    const path = join(dir, "config.yaml");
    writeFileSync(
      path,
      [
        "fetch:",
        "  count: 25",
        "filter:",
        "  mode: score",
        "  lang:",
        "    - en",
        "    - zh",
      ].join("\n"),
      "utf-8",
    );

    const config = await loadConfig(path);
    expect(config.fetch.count).toBe(25);
    expect(config.filter.mode).toBe("score");
    expect(config.filter.lang).toEqual(["en", "zh"]);
  });

  test("loadConfig invalid yaml falls back to defaults", async () => {
    const dir = mkdtempSync(join(tmpdir(), "twitter-core-config-"));
    tempDirs.push(dir);
    const path = join(dir, "config.yaml");
    writeFileSync(path, "fetch: [", "utf-8");

    const config = await loadConfig(path);
    expect(config.fetch.count).toBe(DEFAULT_CONFIG.fetch.count);
    expect(config.filter.mode).toBe(DEFAULT_CONFIG.filter.mode);
  });

  test("normalizeConfig does not mutate defaults", () => {
    const config = normalizeConfig({ filter: { weights: { likes: 999 } } });
    expect(config.filter.weights.likes).toBe(999);
    expect(DEFAULT_CONFIG.filter.weights.likes).toBe(1);
  });
});
