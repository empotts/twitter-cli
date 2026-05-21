import type { BookmarkFolder, Tweet, UserProfile } from "./models";
import { formatIso8601, formatLocalTime } from "./time";

export function tweetToData(tweet: Tweet): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: tweet.id,
    text: tweet.text,
    author: {
      id: tweet.author.id,
      name: tweet.author.name,
      screenName: tweet.author.screenName,
      profileImageUrl: tweet.author.profileImageUrl,
      verified: tweet.author.verified,
    },
    metrics: {
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
      replies: tweet.metrics.replies,
      quotes: tweet.metrics.quotes,
      views: tweet.metrics.views,
      bookmarks: tweet.metrics.bookmarks,
    },
    createdAt: tweet.createdAt,
    createdAtLocal: formatLocalTime(tweet.createdAt),
    createdAtISO: formatIso8601(tweet.createdAt),
    media: tweet.media.map((media) => ({
      type: media.type,
      url: media.url,
      width: media.width,
      height: media.height,
    })),
    urls: [...tweet.urls],
    isRetweet: tweet.isRetweet,
    retweetedBy: tweet.retweetedBy ?? null,
    lang: tweet.lang,
    score: tweet.score ?? null,
    isSubscriberOnly: tweet.isSubscriberOnly,
    isPromoted: tweet.isPromoted,
  };

  if (tweet.articleTitle !== undefined) {
    data.articleTitle = tweet.articleTitle;
  }
  if (tweet.articleText !== undefined) {
    data.articleText = tweet.articleText;
  }
  if (tweet.quotedTweet) {
    data.quotedTweet = {
      id: tweet.quotedTweet.id,
      text: tweet.quotedTweet.text,
      author: {
        screenName: tweet.quotedTweet.author.screenName,
        name: tweet.quotedTweet.author.name,
      },
    };
  }
  return data;
}

export function tweetsToData(tweets: Iterable<Tweet>): Record<string, unknown>[] {
  return [...tweets].map(tweetToData);
}

export function tweetToCompactData(tweet: Tweet): Record<string, unknown> {
  const text = tweet.text.length > 140 ? `${tweet.text.slice(0, 137)}...` : tweet.text;
  const parts = tweet.createdAt.split(" ");
  const time = parts.length >= 4 ? `${parts[1]} ${parts[2]} ${parts[3]?.slice(0, 5)}` : tweet.createdAt;
  return {
    id: tweet.id,
    author: `@${tweet.author.screenName}`,
    text: text.replaceAll("\n", " ").trim(),
    likes: tweet.metrics.likes,
    rts: tweet.metrics.retweets,
    time,
  };
}

export function userProfileToData(user: UserProfile): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    screenName: user.screenName,
    bio: user.bio,
    location: user.location,
    url: user.url,
    followers: user.followersCount,
    following: user.followingCount,
    tweets: user.tweetsCount,
    likes: user.likesCount,
    verified: user.verified,
    profileImageUrl: user.profileImageUrl,
    createdAt: user.createdAt,
    createdAtISO: formatIso8601(user.createdAt),
  };
}

export function usersToData(users: Iterable<UserProfile>): Record<string, unknown>[] {
  return [...users].map(userProfileToData);
}

export function bookmarkFoldersToData(folders: Iterable<BookmarkFolder>): Record<string, unknown>[] {
  return [...folders].map((folder) => ({ id: folder.id, name: folder.name }));
}
