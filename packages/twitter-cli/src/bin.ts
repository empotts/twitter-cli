#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { Command } from "commander";
import {
  createConfiguredClient,
  filterTweets,
  getArticle,
  getCookies,
  getBookmarkFolderTimeline,
  getBookmarkFolders,
  getBookmarks,
  getFollowers,
  getFollowing,
  getLikes,
  getListTimeline,
  getMe,
  getTweetDetail,
  getUserPosts,
  getUserProfile,
  loadConfig,
  loadCookieFile,
  tweetsToData,
  tweetsToData as toTweetData,
  tweetToCompactData,
  tweetToData,
  type Tweet,
  type UserProfile,
  userProfileToData,
  usersToData,
  feed,
  searchTweets,
} from "@twitter-cli-ts/core";

import { renderArticleMarkdown, renderTweetDetail, renderTweetTable, renderUserProfile, renderUsersTable } from "./formatters";
import { emitError, emitSuccess, defaultStructuredFormat } from "./output";
import { resolveCachedTweet, saveTweetCache } from "./cache";

export async function run(argv = process.argv): Promise<number> {
  const program = new Command()
    .name("twitter-ts")
    .option("-c, --compact", "Compact output (minimal fields, LLM-friendly).")
    .option("-v, --verbose", "Enable verbose logging.")
    .showHelpAfterError();

  addReadCommands(program);
  addAuthCommands(program);

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    const mode = defaultStructuredFormat({
      asJson: false,
      asYaml: false,
      isStdoutTty: process.stdout.isTTY ?? false,
    });
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error && "errorCode" in error ? String((error as { errorCode?: unknown }).errorCode ?? "api_error") : "api_error";
    const structured = emitError(code, message, mode);
    if (structured) {
      process.stdout.write(structured);
    } else {
      process.stderr.write(`${message}\n`);
    }
    return 1;
  }
}

function addAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Inspect and prepare TypeScript auth cookie configuration.");

  auth
    .command("status")
    .description("Show whether cookies are configured without making a network request.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (options) => {
      const mode = resolveMode(options);
      const configured = getCookies();
      const data = authStatusData(configured);
      const structured = emitSuccess(data, mode);
      if (structured) {
        process.stdout.write(structured);
      } else {
        process.stdout.write(formatAuthStatus(data) + "\n");
      }
    });

  auth
    .command("import <file>")
    .description("Validate a cookie export and emit configuration for this CLI.")
    .option("--write-env <file>", "Write TWITTER_COOKIE_STRING to an env file.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (file, options) => {
      const authConfig = loadCookieFile(resolve(file));
      const envLine = `TWITTER_COOKIE_STRING=${shellQuote(authConfig.cookieString ?? `auth_token=${authConfig.authToken}; ct0=${authConfig.ct0}`)}`;
      if (options.writeEnv) {
        await writeFile(resolve(options.writeEnv), `${envLine}\n`, "utf-8");
      }

      const data = {
        ...authStatusData(authConfig),
        env: envLine,
        writeEnv: options.writeEnv ? resolve(options.writeEnv) : undefined,
      };
      const mode = resolveMode(options);
      const structured = emitSuccess(data, mode);
      if (structured) {
        process.stdout.write(structured);
      } else {
        const lines = [
          formatAuthStatus(data),
          "",
          options.writeEnv
            ? `Wrote ${resolve(options.writeEnv)}`
            : `Run this in your shell:\n${envLine}`,
        ];
        process.stdout.write(lines.join("\n") + "\n");
      }
    });

  auth
    .command("guide")
    .description("Print the shortest supported cookie setup path.")
    .action(() => {
      process.stdout.write(
        [
          "Fastest TypeScript auth setup:",
          "",
          "1. Log in to x.com in your browser.",
          "2. Export x.com cookies as a Netscape cookies.txt file using a browser cookie export extension.",
          "3. Run: twitter-ts auth import ./cookies.txt --write-env .env.twitter",
          "4. Load it before using the CLI: set -a; source .env.twitter; set +a",
          "",
          "You can also set TWITTER_COOKIE_STRING directly if you already have a full Cookie header.",
        ].join("\n") + "\n",
      );
    });
}

function addReadCommands(program: Command): void {
  program
    .command("feed")
    .option("-t, --type <type>", "Feed type: for-you or following.", "for-you")
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--cursor <cursor>", "Pagination cursor for continuing a previous feed request.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-i, --input <file>", "Load tweets from JSON file.")
    .option("-o, --output <file>", "Save filtered tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .option("--include-promoted", "Include promoted tweets when the timeline endpoint exposes them.")
    .action(async (options, command) => {
      const config = await loadLocalConfig();
      const tweets = options.input ? await loadTweetsFromFile(options.input) : undefined;
      const mode = resolveMode(options);
      const compact = command.parent?.opts().compact ?? false;
      const client = tweets ? undefined : createConfiguredClient(config);
      const page = tweets
        ? { items: tweets }
        : await feed(client!, {
            type: options.type === "following" ? "following" : "for-you",
            count: options.max ?? config.fetch.count,
            cursor: options.cursor,
            includePromoted: Boolean(options.includePromoted),
          });
      await outputTweets(page.items, {
        mode,
        compact,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        ...(options.output ? { outputFile: options.output } : {}),
        config,
        title: options.type === "following" ? "Following" : "Twitter",
        ...(page.nextCursor ? { pagination: { nextCursor: page.nextCursor } } : {}),
      });
    });

  program
    .command("favorites")
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getBookmarks(client, options.max ?? config.fetch.count);
      await outputTweets(tweets, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: "Bookmarks",
      });
    });

  const bookmarks = program
    .command("bookmarks")
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getBookmarks(client, options.max ?? config.fetch.count);
      await outputTweets(tweets, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: "Bookmarks",
      });
    });

  bookmarks
    .command("folders [folderId]")
    .option("-n, --max <count>", "Max tweets to fetch from folder.", parseInt)
    .option("--since <date>", "Only show tweets after this date (YYYY-MM-DD).")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (folderId, options, command) => {
      const config = await loadLocalConfig();
      const mode = resolveMode(options);
      const compact = command.parent?.parent?.opts().compact ?? false;
      const client = createConfiguredClient(config);
      if (!folderId) {
        const folders = await getBookmarkFolders(client);
        const structured = emitSuccess(
          folders.map((folder: { id: string; name: string }) => ({ id: folder.id, name: folder.name })),
          mode,
        );
        if (structured) {
          process.stdout.write(structured);
        } else {
          process.stdout.write(
            folders.map((folder: { id: string; name: string }) => `${folder.id}\t${folder.name}`).join("\n") + "\n",
          );
        }
        return;
      }
      const tweets = await getBookmarkFolderTimeline(client, folderId, options.max ?? config.fetch.count);
      await outputTweets(filterSince(tweets, options.since), {
        mode,
        compact,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: `Bookmark Folder ${folderId}`,
      });
    });

  program
    .command("user <screenName>")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (screenName, options) => {
      const client = createConfiguredClient(await loadLocalConfig());
      const user = await getUserProfile(client, screenName);
      await outputUser(user, resolveMode(options));
    });

  program
    .command("user-posts <screenName>")
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (screenName, options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getUserPosts(client, screenName, options.max ?? config.fetch.count);
      await outputTweets(tweets, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: false,
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: `@${screenName}`,
      });
    });

  program
    .command("search [query]")
    .option("-t, --type <product>", "Search tab: Top, Latest, Photos, Videos.", "Top")
    .option("--from <screenName>", "Only tweets from this user.")
    .option("--to <screenName>", "Only tweets directed at this user.")
    .option("--lang <lang>", "Filter by language.")
    .option("--since <date>", "Tweets since date (YYYY-MM-DD).")
    .option("--until <date>", "Tweets until date (YYYY-MM-DD).")
    .option("--has <type...>", "Required content types.")
    .option("--exclude <type...>", "Excluded content types.")
    .option("--min-likes <count>", "Minimum number of likes.", parseInt)
    .option("--min-retweets <count>", "Minimum number of retweets.", parseInt)
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (query, options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await searchTweets(client, {
        query,
        fromUser: options.from,
        toUser: options.to,
        lang: options.lang,
        since: options.since,
        until: options.until,
        has: options.has,
        exclude: options.exclude,
        minLikes: options.minLikes,
        minRetweets: options.minRetweets,
        product: options.type,
        count: options.max ?? config.fetch.count,
      });
      await outputTweets(tweets, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: `Search: ${query ?? ""}`.trim(),
      });
    });

  program
    .command("likes <screenName>")
    .option("-n, --max <count>", "Max number of tweets to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("-o, --output <file>", "Save tweets to JSON file.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (screenName, options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getLikes(client, screenName, options.max ?? config.fetch.count);
      await outputTweets(tweets, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        outputFile: options.output,
        config,
        title: `Likes: @${screenName}`,
      });
    });

  program
    .command("tweet <tweetId>")
    .option("-n, --max <count>", "Max replies to fetch.", parseInt)
    .option("--full-text", "Show full reply text in table output.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (tweetId, options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getTweetDetail(client, normalizeTweetId(tweetId), options.max ?? config.fetch.count);
      const mode = resolveMode(options);
      const compact = command.parent?.opts().compact ?? false;
      if (compact) {
        process.stdout.write(JSON.stringify(tweets.map(tweetToCompactData), null, 2) + "\n");
        return;
      }
      const structured = emitSuccess(tweetsToData(tweets), mode);
      if (structured) {
        process.stdout.write(structured);
      } else {
        process.stdout.write(renderTweetDetail(tweets, Boolean(options.fullText)) + "\n");
      }
    });

  program
    .command("show <index>")
    .option("-n, --max <count>", "Max replies to fetch.", parseInt)
    .option("--full-text", "Show full reply text in table output.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (index, options, command) => {
      const resolved = await resolveCachedTweet(Number(index));
      if (!resolved.tweetId) {
        throw new Error(resolved.cacheSize ? `Tweet #${index} is out of range (cache has ${resolved.cacheSize} items).` : "No recent cached tweet list found.");
      }
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const tweets = await getTweetDetail(client, resolved.tweetId, options.max ?? config.fetch.count);
      const mode = resolveMode(options);
      const compact = command.parent?.opts().compact ?? false;
      if (compact) {
        process.stdout.write(JSON.stringify(tweets.map(tweetToCompactData), null, 2) + "\n");
        return;
      }
      const structured = emitSuccess(tweetsToData(tweets), mode);
      if (structured) {
        process.stdout.write(structured);
      } else {
        process.stdout.write(renderTweetDetail(tweets, Boolean(options.fullText)) + "\n");
      }
    });

  program
    .command("article <tweetId>")
    .option("--markdown", "Output article as Markdown.")
    .option("-o, --output <file>", "Save article Markdown to file.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (tweetId, options) => {
      const client = createConfiguredClient(await loadLocalConfig());
      const article = await getArticle(client, normalizeTweetId(tweetId));
      if (options.markdown) {
        const markdown = renderArticleMarkdown(article);
        if (options.output) {
          await writeFile(resolve(options.output), markdown, "utf-8");
        } else {
          process.stdout.write(markdown);
        }
        return;
      }
      const mode = resolveMode(options);
      const structured = emitSuccess(tweetToData(article), mode);
      if (structured) {
        process.stdout.write(structured);
      } else {
        process.stdout.write(renderArticleMarkdown(article));
      }
    });

  program
    .command("list <listId>")
    .option("-n, --max <count>", "Max tweets to fetch.", parseInt)
    .option("--cursor <cursor>", "Pagination cursor for continuing a previous list request.")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .option("--filter", "Enable score-based filtering.")
    .option("--full-text", "Show full tweet text in table output.")
    .action(async (listId, options, command) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const page = await getListTimeline(client, listId, { count: options.max ?? config.fetch.count, cursor: options.cursor });
      await outputTweets(page.items, {
        mode: resolveMode(options),
        compact: command.parent?.opts().compact ?? false,
        filter: Boolean(options.filter),
        fullText: Boolean(options.fullText),
        config,
        title: `List ${listId}`,
        ...(page.nextCursor ? { pagination: { nextCursor: page.nextCursor } } : {}),
      });
    });

  program
    .command("followers <screenName>")
    .option("-n, --max <count>", "Max users to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (screenName, options) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const users = await getFollowers(client, screenName, options.max ?? config.fetch.count);
      await outputUsers(users, resolveMode(options));
    });

  program
    .command("following <screenName>")
    .option("-n, --max <count>", "Max users to fetch.", parseInt)
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (screenName, options) => {
      const config = await loadLocalConfig();
      const client = createConfiguredClient(config);
      const users = await getFollowing(client, screenName, options.max ?? config.fetch.count);
      await outputUsers(users, resolveMode(options));
    });

  program
    .command("whoami")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (options) => {
      const client = createConfiguredClient(await loadLocalConfig());
      await outputUser(await getMe(client), resolveMode(options));
    });

  program
    .command("status")
    .option("--json", "Output as JSON.")
    .option("--yaml", "Output as YAML.")
    .action(async (options) => {
      const client = createConfiguredClient(await loadLocalConfig());
      const user = await getMe(client);
      const data = {
        authenticated: true,
        user: userProfileToData(user),
      };
      const mode = resolveMode(options);
      const structured = emitSuccess(data, mode);
      process.stdout.write(structured ?? `${user.screenName}\n`);
    });
}

function authStatusData(authConfig: ReturnType<typeof getCookies>) {
  return {
    authenticated: true,
    authToken: redactSecret(authConfig.authToken),
    ct0: redactSecret(authConfig.ct0),
    hasCookieString: Boolean(authConfig.cookieString),
    cookieNames: authConfig.cookieString ? cookieNames(authConfig.cookieString) : ["auth_token", "ct0"],
  };
}

function formatAuthStatus(data: ReturnType<typeof authStatusData>): string {
  return [
    "Twitter auth is configured.",
    `auth_token: ${data.authToken}`,
    `ct0: ${data.ct0}`,
    `full cookie string: ${data.hasCookieString ? "yes" : "no"}`,
    `cookie names: ${data.cookieNames.join(", ")}`,
  ].join("\n");
}

function cookieNames(cookieString: string): string[] {
  return cookieString
    .split(";")
    .map((part) => part.trim().split("=", 1)[0] ?? "")
    .filter((name): name is string => Boolean(name))
    .sort();
}

function redactSecret(value: string): string {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function loadLocalConfig() {
  const candidate = resolve(process.cwd(), "config.yaml");
  return loadConfig(candidate);
}

async function loadTweetsFromFile(filePath: string): Promise<Tweet[]> {
  const raw = await readFile(resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const payload = isStructuredTweetEnvelope(parsed) ? parsed.data : parsed;
  if (!Array.isArray(payload)) {
    throw new Error(`Tweet JSON payload must be a list: ${basename(filePath)}`);
  }
  return payload.map(tweetFromInput);
}

function tweetFromInput(value: unknown): Tweet {
  const data = value as Record<string, any>;
  return compactOptional({
    id: String(data.id ?? ""),
    text: String(data.text ?? ""),
    author: {
      id: String(data.author?.id ?? ""),
      name: String(data.author?.name ?? ""),
      screenName: String(data.author?.screenName ?? ""),
      profileImageUrl: String(data.author?.profileImageUrl ?? ""),
      verified: Boolean(data.author?.verified),
    },
    metrics: {
      likes: Number(data.metrics?.likes ?? 0),
      retweets: Number(data.metrics?.retweets ?? 0),
      replies: Number(data.metrics?.replies ?? 0),
      quotes: Number(data.metrics?.quotes ?? 0),
      views: Number(data.metrics?.views ?? 0),
      bookmarks: Number(data.metrics?.bookmarks ?? 0),
    },
    createdAt: String(data.createdAt ?? ""),
    media: Array.isArray(data.media) ? data.media.map((media: any) => ({
      type: String(media.type ?? ""),
      url: String(media.url ?? ""),
      width: typeof media.width === "number" ? media.width : undefined,
      height: typeof media.height === "number" ? media.height : undefined,
    })) : [],
    urls: Array.isArray(data.urls) ? data.urls.map(String) : [],
    isRetweet: Boolean(data.isRetweet),
    lang: String(data.lang ?? ""),
    retweetedBy: data.retweetedBy ? String(data.retweetedBy) : undefined,
    quotedTweet: data.quotedTweet ? {
      id: String(data.quotedTweet.id ?? ""),
      text: String(data.quotedTweet.text ?? ""),
      author: {
        id: "",
        name: String(data.quotedTweet.author?.name ?? ""),
        screenName: String(data.quotedTweet.author?.screenName ?? ""),
        profileImageUrl: "",
        verified: false,
      },
    } : undefined,
    score: typeof data.score === "number" ? data.score : undefined,
    articleTitle: data.articleTitle ? String(data.articleTitle) : undefined,
    articleText: data.articleText ? String(data.articleText) : undefined,
    isSubscriberOnly: Boolean(data.isSubscriberOnly),
    isPromoted: Boolean(data.isPromoted),
  }) as Tweet;
}

async function outputTweets(
  tweets: Tweet[],
  options: {
    mode: ReturnType<typeof resolveMode>;
    compact: boolean;
    filter: boolean;
    fullText: boolean;
    outputFile?: string;
    config: Awaited<ReturnType<typeof loadLocalConfig>>;
    title: string;
    pagination?: { nextCursor?: string };
  },
): Promise<void> {
  const filtered = options.filter ? filterTweets(tweets, options.config.filter) : tweets;
  if (options.outputFile) {
    await writeFile(resolve(options.outputFile), JSON.stringify(toTweetData(filtered), null, 2), "utf-8");
  }
  await saveTweetCache(filtered);
  if (options.compact) {
    process.stdout.write(JSON.stringify(filtered.map(tweetToCompactData), null, 2) + "\n");
    return;
  }
  const structured = emitSuccess(tweetsToData(filtered), options.mode, options.pagination);
  if (structured) {
    process.stdout.write(structured);
    return;
  }
  process.stdout.write(renderTweetTable(filtered, `${options.title} — ${filtered.length} tweets`, options.fullText) + "\n");
}

async function outputUsers(users: UserProfile[], mode: ReturnType<typeof resolveMode>): Promise<void> {
  const structured = emitSuccess(usersToData(users), mode);
  if (structured) {
    process.stdout.write(structured);
  } else {
    process.stdout.write(renderUsersTable(users) + "\n");
  }
}

async function outputUser(user: UserProfile, mode: ReturnType<typeof resolveMode>): Promise<void> {
  const structured = emitSuccess(userProfileToData(user), mode);
  if (structured) {
    process.stdout.write(structured);
  } else {
    process.stdout.write(renderUserProfile(user) + "\n");
  }
}

function resolveMode(options: { json?: boolean; yaml?: boolean }) {
  return defaultStructuredFormat({
    asJson: Boolean(options.json),
    asYaml: Boolean(options.yaml),
    isStdoutTty: process.stdout.isTTY ?? false,
  });
}

function normalizeTweetId(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const match = /\/(?:status|article)\/(\d+)$/.exec(url.pathname.replace(/\/$/, ""));
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    const candidate = trimmed.replace(/\/$/, "").split("/").pop()?.split("?")[0]?.split("#")[0];
    if (candidate && /^\d+$/.test(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Invalid tweet ID: ${value}`);
}

function filterSince(tweets: Tweet[], since?: string): Tweet[] {
  if (!since) {
    return tweets;
  }
  const threshold = new Date(`${since}T00:00:00Z`);
  if (Number.isNaN(threshold.valueOf())) {
    throw new Error("Invalid --since date format. Use YYYY-MM-DD.");
  }
  return tweets.filter((tweet) => {
    const created = new Date(tweet.createdAt);
    return Number.isNaN(created.valueOf()) ? true : created >= threshold;
  });
}

function isStructuredTweetEnvelope(value: unknown): value is { ok: true; schema_version: string; data: unknown[] } {
  return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === true && Array.isArray((value as { data?: unknown }).data);
}

function compactOptional<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
