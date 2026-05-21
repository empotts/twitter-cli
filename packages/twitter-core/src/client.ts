import { setTimeout as sleep } from "node:timers/promises";

import { AuthenticationError, NotFoundError, RateLimitError, TwitterApiError } from "./errors";
import { getCookies } from "./auth";
import { DEFAULT_CONFIG } from "./config";
import { FEATURES, buildGraphqlUrl, QueryIdResolver } from "./graphql";
import {
  parseBookmarkFolders,
  parseIntSafe,
  deepGet,
  parseTimelineResponse,
  parseTweetResult,
  parseUserListResponse,
  parseUserResult,
} from "./parser";
import type { BookmarkFolder, RateLimitConfig, TimelinePage, Tweet, TwitterAuth, UserProfile } from "./models";
import { BEARER_TOKEN, getAcceptLanguage, getSecChUa, getSecChUaFullVersion, getSecChUaFullVersionList, getTwitterClientLanguage, getUserAgent } from "./constants";

const ABSOLUTE_MAX_COUNT = 500;

export interface CreateTwitterClientOptions {
  auth?: TwitterAuth;
  rateLimit?: RateLimitConfig;
  fetch?: typeof globalThis.fetch;
}

export class TwitterClient {
  private readonly auth: TwitterAuth;
  private readonly requestDelay: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly maxCount: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly queryIds = new QueryIdResolver();

  constructor(options: CreateTwitterClientOptions = {}) {
    this.auth = options.auth ?? getCookies();
    this.requestDelay = options.rateLimit?.requestDelay ?? DEFAULT_CONFIG.rateLimit.requestDelay;
    this.maxRetries = options.rateLimit?.maxRetries ?? DEFAULT_CONFIG.rateLimit.maxRetries;
    this.retryBaseDelay = options.rateLimit?.retryBaseDelay ?? DEFAULT_CONFIG.rateLimit.retryBaseDelay;
    this.maxCount = Math.min(options.rateLimit?.maxCount ?? DEFAULT_CONFIG.rateLimit.maxCount, ABSOLUTE_MAX_COUNT);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async resolveUserId(identifier: string): Promise<string> {
    return /^\d+$/.test(identifier) ? identifier : (await this.fetchUser(identifier)).id;
  }

  async fetchHomeTimeline(options: {
    count?: number;
    includePromoted?: boolean;
    cursor?: string;
  } = {}): Promise<TimelinePage<Tweet>> {
    return this.fetchTimelinePage("HomeTimeline", {
      ...(options.count !== undefined ? { count: options.count } : {}),
      ...(options.includePromoted !== undefined ? { includePromoted: options.includePromoted } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
      getInstructions: (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions"),
    });
  }

  async fetchFollowingFeed(options: {
    count?: number;
    includePromoted?: boolean;
    cursor?: string;
  } = {}): Promise<TimelinePage<Tweet>> {
    return this.fetchTimelinePage("HomeLatestTimeline", {
      ...(options.count !== undefined ? { count: options.count } : {}),
      ...(options.includePromoted !== undefined ? { includePromoted: options.includePromoted } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
      getInstructions: (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions"),
    });
  }

  async fetchBookmarks(count = 50): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("Bookmarks", {
      count,
      getInstructions: (data) =>
        deepGet(data, "data", "bookmark_timeline", "timeline", "instructions") ??
        deepGet(data, "data", "bookmark_timeline_v2", "timeline", "instructions"),
    });
    return page.items;
  }

  async fetchBookmarkFolders(): Promise<BookmarkFolder[]> {
    const folders: BookmarkFolder[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 10; page += 1) {
      const variables: Record<string, unknown> = {};
      if (cursor) {
        variables.cursor = cursor;
      }
      const data = await this.graphqlGet("BookmarkFoldersSlice", variables, FEATURES);
      folders.push(...parseBookmarkFolders(data));
      const nextCursor = deepGet(data, "data", "viewer", "user_results", "result", "bookmark_collections_slice", "slice_info", "next_cursor");
      if (typeof nextCursor !== "string" || nextCursor === cursor) {
        break;
      }
      cursor = nextCursor;
    }

    return folders;
  }

  async fetchBookmarkFolderTimeline(folderId: string, count = 50): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("BookmarkFolderTimeline", {
      count,
      overrideBaseVariables: true,
      extraVariables: {
        bookmark_collection_id: folderId,
        includePromotedContent: false,
      },
      getInstructions: (data) =>
        deepGet(data, "data", "bookmark_collection_timeline", "timeline", "instructions"),
    });
    return page.items;
  }

  async fetchUser(screenName: string): Promise<UserProfile> {
    const data = await this.graphqlGet(
      "UserByScreenName",
      {
        screen_name: screenName,
        withSafetyModeUserFields: true,
      },
      {
        hidden_profile_subscriptions_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        subscriptions_verification_info_is_identity_verified_enabled: true,
        subscriptions_verification_info_verified_since_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        responsive_web_twitter_article_notes_tab_enabled: true,
        subscriptions_feature_can_gift_premium: true,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
      },
    );
    const result = parseUserResult(deepGet(data, "data", "user", "result"));
    if (!result) {
      throw new NotFoundError(`User @${screenName} not found`);
    }
    return result;
  }

  async fetchUserTweets(userId: string, count = 20): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("UserTweets", {
      count,
      extraVariables: {
        userId,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true,
      },
      getInstructions: (data) =>
        deepGet(data, "data", "user", "result", "timeline", "timeline", "instructions") ??
        deepGet(data, "data", "user", "result", "timeline_v2", "timeline", "instructions"),
    });
    return page.items;
  }

  async fetchUserLikes(userId: string, count = 20): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("Likes", {
      count,
      overrideBaseVariables: true,
      extraVariables: {
        userId,
        includePromotedContent: false,
        withClientEventToken: false,
        withBirdwatchNotes: false,
        withVoice: true,
      },
      getInstructions: (data) =>
        deepGet(data, "data", "user", "result", "timeline", "timeline", "instructions") ??
        deepGet(data, "data", "user", "result", "timeline_v2", "timeline", "instructions"),
    });
    return page.items;
  }

  async fetchSearch(query: string, count = 20, product: "Top" | "Latest" | "Photos" | "Videos" = "Top"): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("SearchTimeline", {
      count,
      usePost: true,
      overrideBaseVariables: true,
      extraVariables: {
        rawQuery: query,
        querySource: "typed_query",
        product,
      },
      getInstructions: (data) =>
        deepGet(data, "data", "search_by_raw_query", "search_timeline", "timeline", "instructions"),
    });
    return page.items;
  }

  async fetchTweetDetail(tweetId: string, count = 20): Promise<Tweet[]> {
    const page = await this.fetchTimelinePage("TweetDetail", {
      count,
      overrideBaseVariables: true,
      extraVariables: {
        focalTweetId: tweetId,
        referrer: "tweet",
        with_rux_injections: false,
        includePromotedContent: true,
        rankingMode: "Relevance",
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      },
      fieldToggles: {
        withArticleRichContentState: true,
        withArticlePlainText: false,
        withGrokAnalyze: false,
        withDisallowedReplyControls: false,
      },
      getInstructions: (data) =>
        deepGet(data, "data", "tweetResult", "result", "timeline", "instructions") ??
        deepGet(data, "data", "threaded_conversation_with_injections_v2", "instructions"),
    });
    return page.items;
  }

  async fetchArticle(tweetId: string): Promise<Tweet> {
    const data = await this.graphqlGet(
      "TweetResultByRestId",
      {
        tweetId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false,
      },
      {
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        articles_preview_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
      },
      {
        withArticleRichContentState: true,
        withArticlePlainText: true,
      },
    );
    const tweet = parseTweetResult(deepGet(data, "data", "tweetResult", "result"));
    if (!tweet || (!tweet.articleTitle && !tweet.articleText)) {
      throw new NotFoundError(`Tweet ${tweetId} has no article content`);
    }
    return tweet;
  }

  async fetchListTimeline(listId: string, options: { count?: number; cursor?: string } = {}): Promise<TimelinePage<Tweet>> {
    return this.fetchTimelinePage("ListLatestTweetsTimeline", {
      ...(options.count !== undefined ? { count: options.count } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
      overrideBaseVariables: true,
      extraVariables: { listId },
      getInstructions: (data) => deepGet(data, "data", "list", "tweets_timeline", "timeline", "instructions"),
    });
  }

  async fetchFollowers(userId: string, count = 20): Promise<UserProfile[]> {
    return this.fetchUserList("Followers", userId, count);
  }

  async fetchFollowing(userId: string, count = 20): Promise<UserProfile[]> {
    return this.fetchUserList("Following", userId, count);
  }

  async fetchMe(): Promise<UserProfile> {
    const data = await this.apiGet("https://x.com/i/api/1.1/account/multi/list.json");
    const users = Array.isArray((data as { users?: unknown[] }).users) ? (data as { users?: unknown[] }).users : undefined;
    let screenName: string | undefined;
    if (users?.[0] && typeof (users[0] as { screen_name?: unknown }).screen_name === "string") {
      screenName = String((users[0] as { screen_name?: unknown }).screen_name);
    } else if (Array.isArray(data) && data[0] && typeof deepGet(data[0], "user", "screen_name") === "string") {
      screenName = String(deepGet(data[0], "user", "screen_name"));
    }
    if (!screenName) {
      throw new TwitterApiError(0, "Failed to fetch current user info");
    }
    return this.fetchUser(screenName);
  }

  private async fetchUserList(operationName: string, userId: string, count: number): Promise<UserProfile[]> {
    const targetCount = Math.min(Math.max(count, 0), this.maxCount);
    if (targetCount <= 0) {
      return [];
    }
    const users: UserProfile[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    const maxAttempts = Math.ceil(targetCount / 20) + 2;

    for (let attempt = 0; attempt < maxAttempts && users.length < targetCount; attempt += 1) {
      const variables: Record<string, unknown> = {
        userId,
        count: Math.min(targetCount - users.length + 5, 40),
        includePromotedContent: false,
      };
      if (cursor) {
        variables.cursor = cursor;
      }
      const data = await this.graphqlPost(operationName, variables, FEATURES);
      const parsed = parseUserListResponse(
        data,
        (payload) => deepGet(payload, "data", "user", "result", "timeline", "timeline", "instructions"),
      );
      for (const user of parsed.users) {
        if (user.id && !seen.has(user.id)) {
          seen.add(user.id);
          users.push(user);
        }
      }
      if (!parsed.nextCursor || parsed.nextCursor === cursor) {
        break;
      }
      cursor = parsed.nextCursor;
      if (users.length < targetCount && this.requestDelay > 0) {
        await sleep(this.requestDelay * 1000);
      }
    }
    return users.slice(0, targetCount);
  }

  private async fetchTimelinePage(
    operationName: string,
    options: {
      count?: number;
      cursor?: string;
      includePromoted?: boolean;
      extraVariables?: Record<string, unknown>;
      overrideBaseVariables?: boolean;
      fieldToggles?: Record<string, unknown>;
      usePost?: boolean;
      getInstructions: (data: unknown) => unknown;
    },
  ): Promise<TimelinePage<Tweet>> {
    const count = Math.min(Math.max(options.count ?? 20, 0), this.maxCount);
    if (count <= 0) {
      return { items: [] };
    }
    const tweets: Tweet[] = [];
    const seen = new Set<string>();
    let cursor = options.cursor;
    let continuationCursor: string | undefined;
    const maxAttempts = Math.ceil(count / 20) + 2;

    for (let attempt = 0; attempt < maxAttempts && tweets.length < count; attempt += 1) {
      const variables: Record<string, unknown> = options.overrideBaseVariables
        ? { count: Math.min(count - tweets.length + 5, 40) }
        : {
            count: Math.min(count - tweets.length + 5, 40),
            includePromotedContent: options.includePromoted ?? false,
            latestControlAvailable: true,
            requestContext: "launch",
          };
      if (options.extraVariables) {
        Object.assign(variables, options.extraVariables);
      }
      if (cursor) {
        variables.cursor = cursor;
      }
      const data = options.usePost
        ? await this.graphqlPost(operationName, variables, FEATURES)
        : await this.graphqlGet(operationName, variables, FEATURES, options.fieldToggles);
      const parsed = parseTimelineResponse(data, options.getInstructions);
      for (const tweet of parsed.tweets) {
        if (tweet.id && !seen.has(tweet.id)) {
          seen.add(tweet.id);
          tweets.push(tweet);
        }
      }
      if (!parsed.nextCursor || parsed.nextCursor === cursor) {
        continuationCursor = undefined;
        break;
      }
      continuationCursor = parsed.nextCursor;
      cursor = parsed.nextCursor;
      if (tweets.length < count && this.requestDelay > 0) {
        await sleep(this.requestDelay * 1000);
      }
    }
    return continuationCursor ? { items: tweets.slice(0, count), nextCursor: continuationCursor } : { items: tweets.slice(0, count) };
  }

  private async graphqlGet(
    operationName: string,
    variables: Record<string, unknown>,
    features: Record<string, unknown>,
    fieldToggles?: Record<string, unknown>,
  ): Promise<unknown> {
    const queryId = this.queryIds.resolve(operationName);
    const url = buildGraphqlUrl(queryId, operationName, variables, features, fieldToggles);
    return this.apiGet(url);
  }

  private async graphqlPost(
    operationName: string,
    variables: Record<string, unknown>,
    features?: Record<string, unknown>,
  ): Promise<unknown> {
    const queryId = this.queryIds.resolve(operationName);
    return this.apiRequest(`https://x.com/i/api/graphql/${queryId}/${operationName}`, "POST", {
      variables,
      queryId,
      ...(features ? { features } : {}),
    });
  }

  private async apiGet(url: string): Promise<unknown> {
    return this.apiRequest(url, "GET");
  }

  private async apiRequest(url: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<unknown> {
    const headers = this.buildHeaders(url, method);
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        await sleep((this.retryBaseDelay * (2 ** attempt)) * 1000);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(`Cookie expired or invalid (HTTP ${response.status}). Please re-login to x.com.`);
      }
      if (response.status === 429) {
        throw new RateLimitError("Twitter rate limited the request");
      }
      if (!response.ok) {
        throw new TwitterApiError(response.status, (await response.text()).slice(0, 500));
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    }
    throw new TwitterApiError(429, "Rate limited");
  }

  private buildHeaders(url: string, method: "GET" | "POST"): Headers {
    const headers = new Headers({
      Authorization: `Bearer ${BEARER_TOKEN}`,
      Cookie: this.auth.cookieString ?? `auth_token=${this.auth.authToken}; ct0=${this.auth.ct0}`,
      "Content-Type": "application/json",
      Origin: "https://x.com",
      Referer: "https://x.com/",
      "User-Agent": getUserAgent(),
      "X-Csrf-Token": this.auth.ct0,
      "X-Twitter-Active-User": "yes",
      "X-Twitter-Auth-Type": "OAuth2Session",
      "X-Twitter-Client-Language": getTwitterClientLanguage(),
      "Accept-Language": getAcceptLanguage(),
      "sec-ch-ua": getSecChUa(),
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": `"${process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : "Linux"}"`,
      "sec-ch-ua-full-version": getSecChUaFullVersion(),
      "sec-ch-ua-full-version-list": getSecChUaFullVersionList(),
      "x-client-transaction-id": Buffer.from(`${method}:${url}:${Date.now()}`).toString("base64url").slice(0, 94),
    });
    return headers;
  }
}

export function createTwitterClient(options: CreateTwitterClientOptions = {}): TwitterClient {
  return new TwitterClient(options);
}
