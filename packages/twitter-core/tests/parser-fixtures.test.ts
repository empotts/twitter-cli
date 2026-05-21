import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { deepGet, parseTimelineResponse, parseUserListResponse } from "../src/index";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf-8"),
  );
}

describe("parser fixtures", () => {
  test("home timeline fixture", () => {
    const payload = fixture("home_timeline.json");
    const { tweets, nextCursor } = parseTimelineResponse(
      payload,
      (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions"),
    );
    expect(tweets.map((tweet) => tweet.id)).toEqual(["1", "20"]);
    expect(nextCursor).toBe("cursor-bottom-1");
    expect(tweets[0]?.urls).toEqual(["https://example.com/post"]);
    expect(tweets[1]?.isRetweet).toBe(true);
    expect(tweets[1]?.retweetedBy).toBe("bob");
    expect(tweets[1]?.quotedTweet?.id).toBe("30");
  });

  test("tweet detail fixture", () => {
    const payload = fixture("tweet_detail.json");
    const { tweets, nextCursor } = parseTimelineResponse(
      payload,
      (data) => deepGet(data, "data", "threaded_conversation_with_injections_v2", "instructions"),
    );
    expect(tweets.map((tweet) => tweet.id)).toEqual(["100", "101"]);
    expect(nextCursor).toBe("conversation-cursor");
  });

  test("search timeline fixture", () => {
    const payload = fixture("search_timeline.json");
    const { tweets, nextCursor } = parseTimelineResponse(
      payload,
      (data) => deepGet(data, "data", "search_by_raw_query", "search_timeline", "timeline", "instructions"),
    );
    expect(tweets.map((tweet) => tweet.id)).toEqual(["500"]);
    expect(nextCursor).toBe("search-cursor");
    expect(tweets[0]?.media[0]?.type).toBe("video");
    expect(tweets[0]?.media[0]?.url).toBe("https://video-high.mp4");
  });

  test("list timeline fixture", () => {
    const payload = fixture("list_timeline.json");
    const { tweets, nextCursor } = parseTimelineResponse(
      payload,
      (data) => deepGet(data, "data", "list", "tweets_timeline", "timeline", "instructions"),
    );
    expect(tweets.map((tweet) => tweet.id)).toEqual(["700"]);
    expect(nextCursor).toBe("list-cursor");
    expect(tweets[0]?.author.verified).toBe(true);
    expect(tweets[0]?.lang).toBe("zh");
    expect(tweets[0]?.isSubscriberOnly).toBe(true);
  });

  test("followers fixture user list", () => {
    const payload = fixture("followers_page.json");
    const { users } = parseUserListResponse(
      payload,
      (data) => deepGet(data, "data", "user", "result", "timeline", "timeline", "instructions"),
    );
    expect(users.length).toBe(1);
    expect(users[0]?.screenName).toBe("follower1");
    expect(users[0]?.verified).toBe(true);
  });
});
