import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Tweet } from "@twitter-cli-ts/core";

const CACHE_DIR = join(homedir(), ".twitter-cli");
const CACHE_FILE = join(CACHE_DIR, "last_results.json");
const TTL_MS = 60 * 60 * 1000;

export async function saveTweetCache(tweets: Tweet[]): Promise<void> {
  const entries = tweets
    .filter((tweet) => tweet.id)
    .map((tweet, index) => ({
      index: index + 1,
      id: tweet.id,
      author: tweet.author.screenName,
      text: tweet.text.slice(0, 80),
    }));
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    CACHE_FILE,
    JSON.stringify({ created_at: Date.now(), tweets: entries }, null, 2),
    "utf-8",
  );
}

export async function resolveCachedTweet(index: number): Promise<{ tweetId?: string; cacheSize: number }> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { created_at?: number; tweets?: Array<{ index?: number; id?: string }> };
    if (!parsed.created_at || !Array.isArray(parsed.tweets) || Date.now() - parsed.created_at > TTL_MS) {
      return { cacheSize: 0 };
    }
    const match = parsed.tweets.find((entry) => entry.index === index);
    return match?.id ? { tweetId: match.id, cacheSize: parsed.tweets.length } : { cacheSize: parsed.tweets.length };
  } catch {
    return { cacheSize: 0 };
  }
}
