import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { authFromCookieString, getCookies, loadCookieFile, loadEnvCookies } from "../src/index";
import { AuthenticationError } from "../src/errors";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("TypeScript auth", () => {
  test("loads auth token and ct0 from env", () => {
    expect(loadEnvCookies({ TWITTER_AUTH_TOKEN: "token", TWITTER_CT0: "csrf" })).toEqual({
      authToken: "token",
      ct0: "csrf",
    });
  });

  test("loads full cookie string from env", () => {
    const auth = loadEnvCookies({
      TWITTER_COOKIE_STRING: "guest_id=guest; auth_token=token; ct0=csrf",
    });
    expect(auth).toEqual({
      authToken: "token",
      ct0: "csrf",
      cookieString: "guest_id=guest; auth_token=token; ct0=csrf",
    });
  });

  test("parses cookie string directly", () => {
    expect(authFromCookieString("auth_token=token; ct0=csrf")).toEqual({
      authToken: "token",
      ct0: "csrf",
      cookieString: "auth_token=token; ct0=csrf",
    });
  });

  test("loads Netscape cookie file", () => {
    const dir = mkdtempSync(join(tmpdir(), "twitter-core-auth-"));
    tempDirs.push(dir);
    const path = join(dir, "cookies.txt");
    writeFileSync(
      path,
      [
        "# Netscape HTTP Cookie File",
        ".x.com\tTRUE\t/\tTRUE\t0\tauth_token\ttoken",
        ".x.com\tTRUE\t/\tTRUE\t0\tct0\tcsrf",
      ].join("\n"),
      "utf-8",
    );

    expect(loadCookieFile(path)).toEqual({
      authToken: "token",
      ct0: "csrf",
      cookieString: "auth_token=token; ct0=csrf",
    });
  });

  test("throws a TypeScript-side auth error when no cookies are configured", () => {
    expect(() => getCookies({ env: {} })).toThrow(AuthenticationError);
  });
});
