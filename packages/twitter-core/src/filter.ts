import type { Tweet } from "./models";

const DEFAULT_WEIGHTS = {
  likes: 1,
  retweets: 3,
  replies: 2,
  bookmarks: 5,
  views_log: 0.5,
};

export function scoreTweet(tweet: Tweet, weights: Record<string, number> = DEFAULT_WEIGHTS): number {
  return (
    (weights.likes ?? 1) * tweet.metrics.likes +
    (weights.retweets ?? 3) * tweet.metrics.retweets +
    (weights.replies ?? 2) * tweet.metrics.replies +
    (weights.bookmarks ?? 5) * tweet.metrics.bookmarks +
    (weights.views_log ?? 0.5) * Math.log10(Math.max(tweet.metrics.views, 1))
  );
}

export function filterTweets(
  tweets: readonly Tweet[],
  config: {
    mode?: "topN" | "score" | "all";
    topN?: number;
    minScore?: number;
    lang?: string[];
    excludeRetweets?: boolean;
    weights?: Record<string, number>;
  } = {},
): Tweet[] {
  let filtered = [...tweets];

  if (config.lang?.length) {
    const allowed = new Set(config.lang.filter(Boolean));
    filtered = filtered.filter((tweet) => allowed.has(tweet.lang));
  }

  if (config.excludeRetweets) {
    filtered = filtered.filter((tweet) => !tweet.isRetweet);
  }

  const weights = { ...DEFAULT_WEIGHTS, ...(config.weights ?? {}) };
  const scored = filtered
    .map((tweet) => ({
      ...tweet,
      score: Number(scoreTweet(tweet, weights).toFixed(1)),
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  if (config.mode === "score") {
    return scored.filter((tweet) => (tweet.score ?? 0) >= (config.minScore ?? 50));
  }
  if (config.mode === "all") {
    return scored;
  }
  return scored.slice(0, Math.max(config.topN ?? 20, 1));
}
