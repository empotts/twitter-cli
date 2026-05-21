import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  buildSearchQuery,
  filterTweets,
  parseTimelineResponse,
  deepGet,
  formatIso8601,
  formatLocalTime,
  formatRelativeTime,
  tweetToData,
  type Tweet,
} from "../src/index";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf-8"),
  );
}

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: "1",
    text: "hello",
    author: {
      id: "u1",
      name: "Alice",
      screenName: "alice",
      profileImageUrl: "",
      verified: false,
    },
    metrics: {
      likes: 10,
      retweets: 2,
      replies: 1,
      quotes: 0,
      views: 120,
      bookmarks: 3,
    },
    createdAt: "Sat Mar 08 12:00:00 +0000 2026",
    media: [],
    urls: [],
    isRetweet: false,
    lang: "en",
    isSubscriberOnly: false,
    isPromoted: false,
    ...overrides,
  };
}

describe("twitter-core", () => {
  test("buildSearchQuery matches advanced search operators", () => {
    expect(
      buildSearchQuery({
        query: "machine learning",
        fromUser: "openai",
        lang: "en",
        since: "2026-01-01",
        has: ["links"],
        minLikes: 50,
        exclude: ["retweets"],
      }),
    ).toBe("machine learning from:openai lang:en since:2026-01-01 filter:links -filter:retweets min_faves:50");
  });

  test("filterTweets scores and sorts without mutating input", () => {
    const low = makeTweet({ id: "low", metrics: { likes: 1, retweets: 0, replies: 0, quotes: 0, views: 1, bookmarks: 0 } });
    const high = makeTweet({ id: "high", metrics: { likes: 100, retweets: 5, replies: 3, quotes: 0, views: 1000, bookmarks: 10 } });
    const output = filterTweets([low, high], { mode: "all" });
    expect(output[0]?.id).toBe("high");
    expect(low.score).toBeUndefined();
    expect(output[0]?.score).toBeGreaterThan(0);
  });

  test("parseTimelineResponse matches fixture behavior", () => {
    const payload = loadFixture("home_timeline.json");
    const parsed = parseTimelineResponse(
      payload,
      (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions"),
    );
    expect(parsed.tweets.map((tweet) => tweet.id)).toEqual(["1", "20"]);
    expect(parsed.nextCursor).toBe("cursor-bottom-1");
    expect(parsed.tweets[0]?.media[0]?.type).toBe("photo");
    expect(parsed.tweets[1]?.isRetweet).toBe(true);
    expect(parsed.tweets[1]?.quotedTweet?.id).toBe("30");
  });

  test("tweetToData preserves schema field names", () => {
    const tweet = makeTweet({
      articleTitle: "Long-form title",
      articleText: "Intro\n\n## Details",
      isPromoted: true,
    });
    const data = tweetToData(tweet);
    expect(data.createdAtISO).toBe("2026-03-08T12:00:00+00:00");
    expect(data.isPromoted).toBe(true);
    expect(data.articleTitle).toBe("Long-form title");
  });

  test("time utilities preserve expected formats", () => {
    const timestamp = "Sat Mar 08 12:00:00 +0000 2026";
    expect(formatIso8601(timestamp)).toBe("2026-03-08T12:00:00+00:00");
    expect(formatLocalTime(timestamp)).toMatch(/^2026-03-\d{2} \d{2}:\d{2}$/);
    expect(formatRelativeTime("Sat Jan 01 00:00:00 +0000 2020")).toMatch(/ago$/);
  });
});
