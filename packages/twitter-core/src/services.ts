import { normalizeConfig } from "./config";
import { buildSearchQuery } from "./search";
import type { SearchOptions, TimelinePage, Tweet, TwitterConfig, TwitterAuth, UserProfile } from "./models";
import { createTwitterClient, TwitterClient } from "./client";

export function createConfiguredClient(config?: Partial<TwitterConfig>, auth?: TwitterAuth): TwitterClient {
  const normalized = normalizeConfig(config as Record<string, unknown> | undefined);
  return createTwitterClient({
    ...(auth ? { auth } : {}),
    rateLimit: normalized.rateLimit,
  });
}

export async function feed(
  client: TwitterClient,
  options: { type?: "for-you" | "following"; count?: number; cursor?: string; includePromoted?: boolean } = {},
): Promise<TimelinePage<Tweet>> {
  return options.type === "following"
    ? client.fetchFollowingFeed(options)
    : client.fetchHomeTimeline(options);
}

export async function searchTweets(client: TwitterClient, options: SearchOptions = {}): Promise<Tweet[]> {
  const query = buildSearchQuery(options);
  return client.fetchSearch(query, options.count ?? 20, options.product ?? "Top");
}

export async function getTweetDetail(client: TwitterClient, tweetId: string, count = 20): Promise<Tweet[]> {
  return client.fetchTweetDetail(tweetId, count);
}

export async function getArticle(client: TwitterClient, tweetId: string): Promise<Tweet> {
  return client.fetchArticle(tweetId);
}

export async function getBookmarks(client: TwitterClient, count = 50): Promise<Tweet[]> {
  return client.fetchBookmarks(count);
}

export async function getBookmarkFolders(client: TwitterClient) {
  return client.fetchBookmarkFolders();
}

export async function getBookmarkFolderTimeline(client: TwitterClient, folderId: string, count = 50): Promise<Tweet[]> {
  return client.fetchBookmarkFolderTimeline(folderId, count);
}

export async function getUserProfile(client: TwitterClient, screenName: string): Promise<UserProfile> {
  return client.fetchUser(screenName);
}

export async function getUserPosts(client: TwitterClient, screenName: string, count = 20): Promise<Tweet[]> {
  const userId = await client.resolveUserId(screenName);
  return client.fetchUserTweets(userId, count);
}

export async function getLikes(client: TwitterClient, screenName: string, count = 20): Promise<Tweet[]> {
  const userId = await client.resolveUserId(screenName);
  return client.fetchUserLikes(userId, count);
}

export async function getFollowers(client: TwitterClient, screenName: string, count = 20): Promise<UserProfile[]> {
  const userId = await client.resolveUserId(screenName);
  return client.fetchFollowers(userId, count);
}

export async function getFollowing(client: TwitterClient, screenName: string, count = 20): Promise<UserProfile[]> {
  const userId = await client.resolveUserId(screenName);
  return client.fetchFollowing(userId, count);
}

export async function getListTimeline(
  client: TwitterClient,
  listId: string,
  options: { count?: number; cursor?: string } = {},
): Promise<TimelinePage<Tweet>> {
  return client.fetchListTimeline(listId, options);
}

export async function getMe(client: TwitterClient): Promise<UserProfile> {
  return client.fetchMe();
}
