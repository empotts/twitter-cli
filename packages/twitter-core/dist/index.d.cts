interface Author {
    id: string;
    name: string;
    screenName: string;
    profileImageUrl: string;
    verified: boolean;
}
interface Metrics {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
    bookmarks: number;
}
interface TweetMedia {
    type: "photo" | "video" | "animated_gif" | string;
    url: string;
    width?: number;
    height?: number;
}
interface Tweet {
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
interface BookmarkFolder {
    id: string;
    name: string;
}
interface UserProfile {
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
interface TimelinePage<T> {
    items: T[];
    nextCursor?: string;
}
interface WriteResult {
    ok: true;
    action: string;
    targetId?: string;
}
interface RateLimitConfig {
    requestDelay?: number;
    maxRetries?: number;
    retryBaseDelay?: number;
    maxCount?: number;
}
interface TwitterAuth {
    authToken: string;
    ct0: string;
    cookieString?: string;
}
interface TwitterConfig {
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
interface SearchOptions {
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

interface CookieSourceOptions {
    env?: NodeJS.ProcessEnv;
    cookieFile?: string;
}
declare function loadEnvCookies(env?: NodeJS.ProcessEnv): TwitterAuth | undefined;
declare function getCookies(options?: CookieSourceOptions): TwitterAuth;
declare function authFromCookieString(cookieString: string): TwitterAuth;
declare function loadCookieFile(path: string): TwitterAuth;

interface CreateTwitterClientOptions {
    auth?: TwitterAuth;
    rateLimit?: RateLimitConfig;
    fetch?: typeof globalThis.fetch;
}
declare class TwitterClient {
    private readonly auth;
    private readonly requestDelay;
    private readonly maxRetries;
    private readonly retryBaseDelay;
    private readonly maxCount;
    private readonly fetchImpl;
    private readonly queryIds;
    constructor(options?: CreateTwitterClientOptions);
    resolveUserId(identifier: string): Promise<string>;
    fetchHomeTimeline(options?: {
        count?: number;
        includePromoted?: boolean;
        cursor?: string;
    }): Promise<TimelinePage<Tweet>>;
    fetchFollowingFeed(options?: {
        count?: number;
        includePromoted?: boolean;
        cursor?: string;
    }): Promise<TimelinePage<Tweet>>;
    fetchBookmarks(count?: number): Promise<Tweet[]>;
    fetchBookmarkFolders(): Promise<BookmarkFolder[]>;
    fetchBookmarkFolderTimeline(folderId: string, count?: number): Promise<Tweet[]>;
    fetchUser(screenName: string): Promise<UserProfile>;
    fetchUserTweets(userId: string, count?: number): Promise<Tweet[]>;
    fetchUserLikes(userId: string, count?: number): Promise<Tweet[]>;
    fetchSearch(query: string, count?: number, product?: "Top" | "Latest" | "Photos" | "Videos"): Promise<Tweet[]>;
    fetchTweetDetail(tweetId: string, count?: number): Promise<Tweet[]>;
    fetchArticle(tweetId: string): Promise<Tweet>;
    fetchListTimeline(listId: string, options?: {
        count?: number;
        cursor?: string;
    }): Promise<TimelinePage<Tweet>>;
    fetchFollowers(userId: string, count?: number): Promise<UserProfile[]>;
    fetchFollowing(userId: string, count?: number): Promise<UserProfile[]>;
    fetchMe(): Promise<UserProfile>;
    private fetchUserList;
    private fetchTimelinePage;
    private graphqlGet;
    private graphqlPost;
    private apiGet;
    private apiRequest;
    private buildHeaders;
}
declare function createTwitterClient(options?: CreateTwitterClientOptions): TwitterClient;

declare const DEFAULT_CONFIG: TwitterConfig;
declare function asInt(value: unknown, defaultValue: number): number;
declare function asFloat(value: unknown, defaultValue: number): number;
declare function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown>;
declare function normalizeConfig(raw?: Record<string, unknown>): TwitterConfig;
declare function loadConfig(configPath?: string): Promise<TwitterConfig>;

declare const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
declare function syncChromeVersion(target: string): void;
declare function getUserAgent(): string;
declare function getSecChUa(): string;
declare function getSecChUaFullVersion(): string;
declare function getSecChUaFullVersionList(): string;
declare function getAcceptLanguage(): string;
declare function getTwitterClientLanguage(): string;

declare class TwitterError extends Error {
    readonly errorCode: string;
    constructor(message: string, errorCode?: string);
}
declare class AuthenticationError extends TwitterError {
    constructor(message: string);
}
declare class RateLimitError extends TwitterError {
    constructor(message: string);
}
declare class NotFoundError extends TwitterError {
    constructor(message: string);
}
declare class NetworkError extends TwitterError {
    constructor(message: string);
}
declare class QueryIdError extends TwitterError {
    constructor(message: string);
}
declare class InvalidInputError extends TwitterError {
    constructor(message: string);
}
declare class TwitterApiError extends TwitterError {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}

declare function scoreTweet(tweet: Tweet, weights?: Record<string, number>): number;
declare function filterTweets(tweets: readonly Tweet[], config?: {
    mode?: "topN" | "score" | "all";
    topN?: number;
    minScore?: number;
    lang?: string[];
    excludeRetweets?: boolean;
    weights?: Record<string, number>;
}): Tweet[];

declare const FALLBACK_QUERY_IDS: Record<string, string>;
declare const FEATURES: Record<string, boolean>;
declare function buildGraphqlUrl(queryId: string, operationName: string, variables: Record<string, unknown>, features: Record<string, unknown>, fieldToggles?: Record<string, unknown>): string;
declare class QueryIdResolver {
    private readonly cached;
    resolve(operationName: string): string;
    invalidate(operationName: string): void;
}

declare const SCHEMA_VERSION = "1";
interface StructuredSuccess<T> {
    ok: true;
    schema_version: "1";
    data: T;
    pagination?: {
        nextCursor?: string;
    };
}
interface StructuredError {
    ok: false;
    schema_version: "1";
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
declare function successPayload<T>(data: T, pagination?: {
    nextCursor?: string;
}): StructuredSuccess<T>;
declare function errorPayload(code: string, message: string, details?: unknown): StructuredError;
declare function encodeStructured(data: unknown, format: "json" | "yaml"): string;

declare function deepGet(value: unknown, ...keys: Array<string | number>): unknown;
declare function parseIntSafe(value: unknown, defaultValue: number): number;
declare function parseUserResult(userData: unknown): UserProfile | undefined;
declare function parseTweetResult(result: unknown, depth?: number): Tweet | undefined;
declare function parseTimelineResponse(data: unknown, getInstructions: (input: unknown) => unknown): {
    tweets: Tweet[];
    nextCursor?: string;
};
declare function parseBookmarkFolders(data: unknown): BookmarkFolder[];
declare function parseUserListResponse(data: unknown, getInstructions: (input: unknown) => unknown): {
    users: UserProfile[];
    nextCursor?: string;
};

declare function buildSearchQuery({ query, fromUser, toUser, lang, since, until, has, exclude, minLikes, minRetweets, }?: {
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
}): string;

declare function tweetToData(tweet: Tweet): Record<string, unknown>;
declare function tweetsToData(tweets: Iterable<Tweet>): Record<string, unknown>[];
declare function tweetToCompactData(tweet: Tweet): Record<string, unknown>;
declare function userProfileToData(user: UserProfile): Record<string, unknown>;
declare function usersToData(users: Iterable<UserProfile>): Record<string, unknown>[];
declare function bookmarkFoldersToData(folders: Iterable<BookmarkFolder>): Record<string, unknown>[];

declare function createConfiguredClient(config?: Partial<TwitterConfig>, auth?: TwitterAuth): TwitterClient;
declare function feed(client: TwitterClient, options?: {
    type?: "for-you" | "following";
    count?: number;
    cursor?: string;
    includePromoted?: boolean;
}): Promise<TimelinePage<Tweet>>;
declare function searchTweets(client: TwitterClient, options?: SearchOptions): Promise<Tweet[]>;
declare function getTweetDetail(client: TwitterClient, tweetId: string, count?: number): Promise<Tweet[]>;
declare function getArticle(client: TwitterClient, tweetId: string): Promise<Tweet>;
declare function getBookmarks(client: TwitterClient, count?: number): Promise<Tweet[]>;
declare function getBookmarkFolders(client: TwitterClient): Promise<BookmarkFolder[]>;
declare function getBookmarkFolderTimeline(client: TwitterClient, folderId: string, count?: number): Promise<Tweet[]>;
declare function getUserProfile(client: TwitterClient, screenName: string): Promise<UserProfile>;
declare function getUserPosts(client: TwitterClient, screenName: string, count?: number): Promise<Tweet[]>;
declare function getLikes(client: TwitterClient, screenName: string, count?: number): Promise<Tweet[]>;
declare function getFollowers(client: TwitterClient, screenName: string, count?: number): Promise<UserProfile[]>;
declare function getFollowing(client: TwitterClient, screenName: string, count?: number): Promise<UserProfile[]>;
declare function getListTimeline(client: TwitterClient, listId: string, options?: {
    count?: number;
    cursor?: string;
}): Promise<TimelinePage<Tweet>>;
declare function getMe(client: TwitterClient): Promise<UserProfile>;

declare function parseTwitterTime(createdAt: string): Date | undefined;
declare function formatLocalTime(createdAt: string): string;
declare function formatRelativeTime(createdAt: string): string;
declare function formatIso8601(createdAt: string): string;

export { AuthenticationError, type Author, BEARER_TOKEN, type BookmarkFolder, type CookieSourceOptions, type CreateTwitterClientOptions, DEFAULT_CONFIG, FALLBACK_QUERY_IDS, FEATURES, InvalidInputError, type Metrics, NetworkError, NotFoundError, QueryIdError, QueryIdResolver, type RateLimitConfig, RateLimitError, SCHEMA_VERSION, type SearchOptions, type StructuredError, type StructuredSuccess, type TimelinePage, type Tweet, type TweetMedia, TwitterApiError, type TwitterAuth, TwitterClient, type TwitterConfig, TwitterError, type UserProfile, type WriteResult, asFloat, asInt, authFromCookieString, bookmarkFoldersToData, buildGraphqlUrl, buildSearchQuery, createConfiguredClient, createTwitterClient, deepGet, deepMerge, encodeStructured, errorPayload, feed, filterTweets, formatIso8601, formatLocalTime, formatRelativeTime, getAcceptLanguage, getArticle, getBookmarkFolderTimeline, getBookmarkFolders, getBookmarks, getCookies, getFollowers, getFollowing, getLikes, getListTimeline, getMe, getSecChUa, getSecChUaFullVersion, getSecChUaFullVersionList, getTweetDetail, getTwitterClientLanguage, getUserAgent, getUserPosts, getUserProfile, loadConfig, loadCookieFile, loadEnvCookies, normalizeConfig, parseBookmarkFolders, parseIntSafe, parseTimelineResponse, parseTweetResult, parseTwitterTime, parseUserListResponse, parseUserResult, scoreTweet, searchTweets, successPayload, syncChromeVersion, tweetToCompactData, tweetToData, tweetsToData, userProfileToData, usersToData };
