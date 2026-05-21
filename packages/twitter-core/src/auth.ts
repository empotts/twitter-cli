import { readFileSync } from "node:fs";

import type { TwitterAuth } from "./models";
import { AuthenticationError } from "./errors";

const TWITTER_DOMAINS = new Set(["x.com", "twitter.com", ".x.com", ".twitter.com"]);

export interface CookieSourceOptions {
  env?: NodeJS.ProcessEnv;
  cookieFile?: string;
}

export function loadEnvCookies(env: NodeJS.ProcessEnv = process.env): TwitterAuth | undefined {
  const cookieString = env.TWITTER_COOKIE_STRING?.trim();
  if (cookieString) {
    return authFromCookieString(cookieString);
  }

  const authToken = env.TWITTER_AUTH_TOKEN?.trim();
  const ct0 = env.TWITTER_CT0?.trim();
  if (authToken && ct0) {
    return { authToken, ct0 };
  }
  return undefined;
}

export function getCookies(options: CookieSourceOptions = {}): TwitterAuth {
  const env = options.env ?? process.env;
  const fromEnv = loadEnvCookies(env);
  if (fromEnv) {
    return fromEnv;
  }

  const cookieFile = options.cookieFile ?? env.TWITTER_COOKIE_FILE;
  if (cookieFile) {
    return loadCookieFile(cookieFile);
  }

  throw new AuthenticationError(
    "Twitter cookies not found. Set TWITTER_COOKIE_STRING, or set TWITTER_AUTH_TOKEN and TWITTER_CT0.",
  );
}

export function authFromCookieString(cookieString: string): TwitterAuth {
  const cookies = parseCookieString(cookieString);
  const authToken = cookies.get("auth_token");
  const ct0 = cookies.get("ct0");
  if (!authToken || !ct0) {
    throw new AuthenticationError("Cookie string must include auth_token and ct0.");
  }
  return {
    authToken,
    ct0,
    cookieString,
  };
}

export function loadCookieFile(path: string): TwitterAuth {
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) {
    throw new AuthenticationError(`Cookie file is empty: ${path}`);
  }

  if (raw.startsWith("{")) {
    return authFromJsonCookieFile(raw, path);
  }
  if (raw.includes("\t") && raw.includes("\n")) {
    return authFromNetscapeCookieFile(raw, path);
  }
  return authFromCookieString(raw);
}

function authFromJsonCookieFile(raw: string, path: string): TwitterAuth {
  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed)) {
    throw new AuthenticationError(`Cookie JSON must be an object: ${path}`);
  }

  const cookieString =
    typeof parsed.cookieString === "string"
      ? parsed.cookieString
      : typeof parsed.cookie_string === "string"
        ? parsed.cookie_string
        : undefined;
  if (cookieString) {
    return authFromCookieString(cookieString);
  }

  const authToken = stringValue(parsed.authToken) ?? stringValue(parsed.auth_token);
  const ct0 = stringValue(parsed.ct0);
  if (!authToken || !ct0) {
    throw new AuthenticationError(`Cookie JSON must include authToken/auth_token and ct0: ${path}`);
  }
  return { authToken, ct0 };
}

function authFromNetscapeCookieFile(raw: string, path: string): TwitterAuth {
  const cookiePairs: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = trimmed.split("\t");
    if (parts.length < 7) {
      continue;
    }
    const [domain, , , , , name, value] = parts;
    if (!domain || !name || value === undefined || !isTwitterDomain(domain)) {
      continue;
    }
    cookiePairs.push(`${name}=${value}`);
  }
  if (!cookiePairs.length) {
    throw new AuthenticationError(`Cookie file does not contain x.com/twitter.com cookies: ${path}`);
  }
  return authFromCookieString(cookiePairs.join("; "));
}

function parseCookieString(cookieString: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieString.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=");
    if (name && value) {
      cookies.set(name, value);
    }
  }
  return cookies;
}

function isTwitterDomain(domain: string): boolean {
  return TWITTER_DOMAINS.has(domain) || domain.endsWith(".x.com") || domain.endsWith(".twitter.com");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
