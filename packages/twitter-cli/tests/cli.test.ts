import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { run } from "../src/index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("twitter-cli-ts", () => {
  test("feed --input --json emits structured tweet output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "twitter-cli-ts-"));
    tempDirs.push(dir);
    const inputPath = join(dir, "tweets.json");
    writeFileSync(
      inputPath,
      JSON.stringify([
        {
          id: "1",
          text: "hello",
          author: { id: "u1", name: "Alice", screenName: "alice", profileImageUrl: "", verified: false },
          metrics: { likes: 10, retweets: 2, replies: 1, quotes: 0, views: 120, bookmarks: 3 },
          createdAt: "Sat Mar 08 12:00:00 +0000 2026",
          media: [],
          urls: [],
          isRetweet: false,
          lang: "en",
          isSubscriberOnly: false,
          isPromoted: false,
        },
      ], null, 2),
      "utf-8",
    );

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const cwd = process.cwd();
    process.chdir(dir);

    try {
      const exitCode = await run(["node", "twitter-ts", "feed", "--input", inputPath, "--json"]);
      expect(exitCode).toBe(0);
      const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
      const parsed = JSON.parse(output) as { ok: boolean; data: Array<{ id: string }> };
      expect(parsed.ok).toBe(true);
      expect(parsed.data[0]?.id).toBe("1");
    } finally {
      process.chdir(cwd);
    }
  });

  test("auth import writes env file from Netscape cookie export", async () => {
    const dir = mkdtempSync(join(tmpdir(), "twitter-cli-ts-auth-"));
    tempDirs.push(dir);
    const cookiesPath = join(dir, "cookies.txt");
    const envPath = join(dir, ".env.twitter");
    writeFileSync(
      cookiesPath,
      [
        "# Netscape HTTP Cookie File",
        ".x.com\tTRUE\t/\tTRUE\t0\tauth_token\ttoken",
        ".x.com\tTRUE\t/\tTRUE\t0\tct0\tcsrf",
      ].join("\n"),
      "utf-8",
    );

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const exitCode = await run([
      "node",
      "twitter-ts",
      "auth",
      "import",
      cookiesPath,
      "--write-env",
      envPath,
      "--json",
    ]);

    expect(exitCode).toBe(0);
    expect(readFileSync(envPath, "utf-8")).toBe("TWITTER_COOKIE_STRING='auth_token=token; ct0=csrf'\n");
    const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
    const parsed = JSON.parse(output) as { ok: boolean; data: { authenticated: boolean; hasCookieString: boolean } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.authenticated).toBe(true);
    expect(parsed.data.hasCookieString).toBe(true);
  });
});
