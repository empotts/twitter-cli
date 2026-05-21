import Table from "cli-table3";
import chalk from "chalk";

import { formatLocalTime, formatRelativeTime, type Tweet, type UserProfile } from "@twitter-cli-ts/core";

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export function renderTweetTable(tweets: Tweet[], title = `Twitter — ${tweets.length} tweets`, fullText = false): string {
  const table = new Table({
    head: [title, "Author", "Tweet", "Stats", "Score"],
    style: { head: ["cyan"] },
    wordWrap: true,
    colWidths: [6, 20, 72, 24, 8],
  });
  tweets.forEach((tweet, index) => {
    let text = tweet.text.replaceAll("\n", " ").trim();
    if (!fullText && text.length > 120) {
      text = `${text.slice(0, 117)}...`;
    }
    if (tweet.media.length) {
      text += ` ${tweet.media.map((media) => (media.type === "photo" ? "📷" : media.type === "video" ? "📹" : "🎞")).join(" ")}`;
    }
    if (tweet.quotedTweet) {
      text += `\n┌ @${tweet.quotedTweet.author.screenName}: ${tweet.quotedTweet.text.replaceAll("\n", " ")}`;
    }
    text += `\n🔗 x.com/${tweet.author.screenName}/status/${tweet.id}`;
    const stats = `❤️ ${formatNumber(tweet.metrics.likes)} 🔄 ${formatNumber(tweet.metrics.retweets)}\n💬 ${formatNumber(tweet.metrics.replies)} 👁 ${formatNumber(tweet.metrics.views)}\n🕐 ${formatRelativeTime(tweet.createdAt)}`;
    table.push([
      String(index + 1),
      `@${tweet.author.screenName}${tweet.author.verified ? " ✓" : ""}`,
      text,
      stats,
      tweet.score?.toFixed(1) ?? "-",
    ]);
  });
  return table.toString();
}

export function renderTweetDetail(tweets: Tweet[], fullText = false): string {
  if (!tweets.length) {
    return "No tweet found.";
  }
  const tweet = tweets[0]!;
  const replies = tweets.slice(1);
  const blocks = [
    `${chalk.cyan(`@${tweet.author.screenName}`)}${tweet.author.verified ? " ✓" : ""} (${tweet.author.name})`,
    tweet.text,
    "",
    `❤️ ${formatNumber(tweet.metrics.likes)}  🔄 ${formatNumber(tweet.metrics.retweets)}  💬 ${formatNumber(tweet.metrics.replies)}  🔖 ${formatNumber(tweet.metrics.bookmarks)}  👁 ${formatNumber(tweet.metrics.views)}`,
    `🕐 ${formatLocalTime(tweet.createdAt)} (${formatRelativeTime(tweet.createdAt)})`,
    `🔗 https://x.com/${tweet.author.screenName}/status/${tweet.id}`,
  ];
  if (replies.length) {
    blocks.push("", renderTweetTable(replies, `Replies — ${replies.length} tweets`, fullText));
  }
  return blocks.join("\n");
}

export function renderArticleMarkdown(tweet: Tweet): string {
  const lines = [
    `# ${tweet.articleTitle ?? "Twitter Article"}`,
    "",
    `- Author: @${tweet.author.screenName} (${tweet.author.name})`,
    `- Published: ${tweet.createdAt || "unknown"}`,
    `- URL: https://x.com/${tweet.author.screenName}/status/${tweet.id}`,
    `- Likes: ${formatNumber(tweet.metrics.likes)}`,
    `- Retweets: ${formatNumber(tweet.metrics.retweets)}`,
    `- Replies: ${formatNumber(tweet.metrics.replies)}`,
    `- Bookmarks: ${formatNumber(tweet.metrics.bookmarks)}`,
    `- Views: ${formatNumber(tweet.metrics.views)}`,
  ];
  if (tweet.articleText) {
    lines.push("", tweet.articleText.trim());
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderUserProfile(user: UserProfile): string {
  const lines = [
    `${chalk.cyan(`@${user.screenName}`)}${user.verified ? " ✓" : ""} (${user.name})`,
  ];
  if (user.bio) {
    lines.push(user.bio);
  }
  lines.push(
    `Followers: ${formatNumber(user.followersCount)}  Following: ${formatNumber(user.followingCount)}`,
    `Tweets: ${formatNumber(user.tweetsCount)}  Likes: ${formatNumber(user.likesCount)}`,
  );
  if (user.location) {
    lines.push(`Location: ${user.location}`);
  }
  if (user.url) {
    lines.push(`URL: ${user.url}`);
  }
  return lines.join("\n");
}

export function renderUsersTable(users: UserProfile[], title = `Users — ${users.length}`): string {
  const table = new Table({
    head: [title, "Name", "Bio", "Stats"],
    style: { head: ["cyan"] },
    wordWrap: true,
    colWidths: [20, 24, 60, 24],
  });
  users.forEach((user) => {
    table.push([
      `@${user.screenName}${user.verified ? " ✓" : ""}`,
      user.name,
      user.bio || "-",
      `Followers ${formatNumber(user.followersCount)}\nFollowing ${formatNumber(user.followingCount)}`,
    ]);
  });
  return table.toString();
}
