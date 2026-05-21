import { QueryIdError } from "./errors";

export const FALLBACK_QUERY_IDS: Record<string, string> = {
  HomeTimeline: "c-CzHF1LboFilMpsx4ZCrQ",
  HomeLatestTimeline: "BKB7oi212Fi7kQtCBGE4zA",
  UserByScreenName: "1VOOyvKkiI3FMmkeDNxM9A",
  UserTweets: "q6xj5bs0hapm9309hexA_g",
  TweetDetail: "xd_EMdYvB9hfZsZ6Idri0w",
  Likes: "lIDpu_NWL7_VhimGGt0o6A",
  SearchTimeline: "VhUd6vHVmLBcw0uX-6jMLA",
  Bookmarks: "2neUNDqrrFzbLui8yallcQ",
  ListLatestTweetsTimeline: "RlZzktZY_9wJynoepm8ZsA",
  Followers: "IOh4aS6UdGWGJUYTqliQ7Q",
  Following: "zx6e-TLzRkeDO_a7p4b3JQ",
  TweetResultByRestId: "7xflPyRiUxGVbJd4uWmbfg",
  BookmarkFoldersSlice: "i78YDd0Tza-dV4SYs58kRg",
  BookmarkFolderTimeline: "hNY7X2xE2N7HVF6Qb_mu6w",
};

export const FEATURES: Record<string, boolean> = {
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  rweb_video_timestamps_enabled: true,
  responsive_web_media_download_video_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  responsive_web_enhance_cards_enabled: false,
};

export function buildGraphqlUrl(
  queryId: string,
  operationName: string,
  variables: Record<string, unknown>,
  features: Record<string, unknown>,
  fieldToggles?: Record<string, unknown>,
): string {
  const compactFeatures = Object.fromEntries(Object.entries(features).filter(([, value]) => value !== false));
  const search = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(compactFeatures),
  });
  if (fieldToggles) {
    search.set("fieldToggles", JSON.stringify(fieldToggles));
  }
  return `https://x.com/i/api/graphql/${queryId}/${operationName}?${search.toString()}`;
}

export class QueryIdResolver {
  private readonly cached = new Map<string, string>();

  resolve(operationName: string): string {
    const cached = this.cached.get(operationName);
    if (cached) {
      return cached;
    }
    const fallback = FALLBACK_QUERY_IDS[operationName];
    if (!fallback) {
      throw new QueryIdError(`Cannot resolve queryId for "${operationName}"`);
    }
    this.cached.set(operationName, fallback);
    return fallback;
  }

  invalidate(operationName: string): void {
    this.cached.delete(operationName);
  }
}
