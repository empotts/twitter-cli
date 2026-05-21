import { readFile } from "node:fs/promises";

import YAML from "yaml";

import type { TwitterConfig } from "./models";

export const DEFAULT_CONFIG: TwitterConfig = {
  fetch: {
    count: 50,
  },
  filter: {
    mode: "topN",
    topN: 20,
    minScore: 50,
    lang: [],
    excludeRetweets: false,
    weights: {
      likes: 1,
      retweets: 3,
      replies: 2,
      bookmarks: 5,
      views_log: 0.5,
    },
  },
  rateLimit: {
    requestDelay: 2.5,
    maxRetries: 3,
    retryBaseDelay: 5,
    maxCount: 200,
  },
};

export function asInt(value: unknown, defaultValue: number): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function asFloat(value: unknown, defaultValue: number): number {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(target);
  for (const [key, value] of Object.entries(source)) {
    const current = result[key];
    if (isObject(current) && isObject(value)) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

export function normalizeConfig(raw: Record<string, unknown> = {}): TwitterConfig {
  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, raw) as unknown as TwitterConfig;

  merged.fetch.count = Math.max(asInt(merged.fetch.count, DEFAULT_CONFIG.fetch.count), 1);

  merged.filter.mode =
    merged.filter.mode === "all" || merged.filter.mode === "score" || merged.filter.mode === "topN"
      ? merged.filter.mode
      : "topN";
  merged.filter.topN = Math.max(asInt(merged.filter.topN, DEFAULT_CONFIG.filter.topN), 1);
  merged.filter.minScore = asFloat(merged.filter.minScore, DEFAULT_CONFIG.filter.minScore);
  merged.filter.excludeRetweets = Boolean(merged.filter.excludeRetweets);
  merged.filter.lang = Array.isArray(merged.filter.lang)
    ? merged.filter.lang.map((lang) => String(lang)).filter(Boolean)
    : [];

  const weights = isObject(merged.filter.weights) ? merged.filter.weights : {};
  merged.filter.weights = Object.fromEntries(
    Object.entries(DEFAULT_CONFIG.filter.weights).map(([key, value]) => [key, asFloat(weights[key], value)]),
  );

  merged.rateLimit.requestDelay = Math.max(
    asFloat(merged.rateLimit.requestDelay, DEFAULT_CONFIG.rateLimit.requestDelay),
    0,
  );
  merged.rateLimit.maxRetries = Math.max(asInt(merged.rateLimit.maxRetries, DEFAULT_CONFIG.rateLimit.maxRetries), 0);
  merged.rateLimit.retryBaseDelay = Math.max(
    asFloat(merged.rateLimit.retryBaseDelay, DEFAULT_CONFIG.rateLimit.retryBaseDelay),
    1,
  );
  merged.rateLimit.maxCount = Math.max(asInt(merged.rateLimit.maxCount, DEFAULT_CONFIG.rateLimit.maxCount), 1);

  return merged;
}

export async function loadConfig(configPath?: string): Promise<TwitterConfig> {
  if (!configPath) {
    return structuredClone(DEFAULT_CONFIG);
  }
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = YAML.parse(raw);
    return normalizeConfig(isObject(parsed) ? parsed : {});
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
