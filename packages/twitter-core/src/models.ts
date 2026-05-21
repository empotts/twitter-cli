export interface Author {
  id: string;
  name: string;
  screenName: string;
  profileImageUrl: string;
  verified: boolean;
}

export interface Metrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
  bookmarks: number;
}

export interface TweetMedia {
  type: "photo" | "video" | "animated_gif" | string;
  url: string;
  width?: number;
  height?: number;
}

export interface Tweet {
  id: string;
  text: string;
  author: Author;
  metrics: Metrics;
  createdAt: string;
  media: TweetMedia[];
  urls: string[];
  isRetweet: boolean;
  lang: string;
  retweetedBy?: string;
  quotedTweet?: Pick<Tweet, "id" | "text" | "author">;
  score?: number;
  articleTitle?: string;
  articleText?: string;
  isSubscriberOnly: boolean;
  isPromoted: boolean;
}

export interface BookmarkFolder {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  name: string;
  screenName: string;
  bio: string;
  location: string;
  url: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  likesCount: number;
  verified: boolean;
  profileImageUrl: string;
  createdAt: string;
}

export interface TimelinePage<T> {
  items: T[];
  nextCursor?: string;
}

export interface WriteResult {
  ok: true;
  action: string;
  targetId?: string;
}

export interface RateLimitConfig {
  requestDelay?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
  maxCount?: number;
}

export interface TwitterAuth {
  authToken: string;
  ct0: string;
  cookieString?: string;
}

export interface TwitterConfig {
  fetch: {
    count: number;
  };
  filter: {
    mode: "topN" | "score" | "all";
    topN: number;
    minScore: number;
    lang: string[];
    excludeRetweets: boolean;
    weights: Record<string, number>;
  };
  rateLimit: Required<RateLimitConfig>;
}

export interface SearchOptions {
  query?: string;
  fromUser?: string;
  toUser?: string;
  lang?: string;
  since?: string;
  until?: string;
  has?: string[];
  exclude?: string[];
  minLikes?: number;
  minRetweets?: number;
  product?: "Top" | "Latest" | "Photos" | "Videos";
  count?: number;
}
