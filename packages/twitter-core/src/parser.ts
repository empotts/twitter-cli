import type { Author, BookmarkFolder, Metrics, Tweet, TweetMedia, UserProfile } from "./models";

export function deepGet(value: unknown, ...keys: Array<string | number>): unknown {
  let current = value;
  for (const key of keys) {
    if (typeof key === "number") {
      if (Array.isArray(current) && key >= 0 && key < current.length) {
        current = current[key];
      } else {
        return undefined;
      }
    } else if (isObject(current)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export function parseIntSafe(value: unknown, defaultValue: number): number {
  const text = String(value ?? "").replaceAll(",", "").trim();
  if (!text) {
    return defaultValue;
  }
  const parsed = Number.parseInt(text.includes(".") ? String(Number.parseFloat(text)) : text, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function extractCursor(content: Record<string, unknown>): string | undefined {
  return content.cursorType === "Bottom" && typeof content.value === "string" ? content.value : undefined;
}

function extractMedia(legacy: Record<string, unknown>): TweetMedia[] {
  const media = deepGet(legacy, "extended_entities", "media");
  if (!Array.isArray(media)) {
    return [];
  }
  return media.flatMap((item) => {
    if (!isObject(item) || typeof item.type !== "string") {
      return [];
    }
    if (item.type === "photo") {
      return [compactOptional({
        type: "photo",
        url: String(item.media_url_https ?? ""),
        width: numberOrUndefined(deepGet(item, "original_info", "width")),
        height: numberOrUndefined(deepGet(item, "original_info", "height")),
      }) as TweetMedia];
    }
    if (item.type === "video" || item.type === "animated_gif") {
      const variants = Array.isArray(deepGet(item, "video_info", "variants"))
        ? [...(deepGet(item, "video_info", "variants") as unknown[])]
        : [];
      const mp4 = variants
        .filter((variant) => isObject(variant) && variant.content_type === "video/mp4")
        .sort(
          (left, right) =>
            Number((right as Record<string, unknown>).bitrate ?? 0) - Number((left as Record<string, unknown>).bitrate ?? 0),
        );
      const best = mp4[0] as Record<string, unknown> | undefined;
      return [compactOptional({
        type: item.type,
        url: String(best?.url ?? item.media_url_https ?? ""),
        width: numberOrUndefined(deepGet(item, "original_info", "width")),
        height: numberOrUndefined(deepGet(item, "original_info", "height")),
      }) as TweetMedia];
    }
    return [];
  });
}

function extractAuthor(userData: Record<string, unknown>, userLegacy: Record<string, unknown>): Author {
  const userCore = isObject(userData.core) ? userData.core : {};
  return {
    id: String(userData.rest_id ?? ""),
    name: String(userCore.name ?? userLegacy.name ?? userData.name ?? "Unknown"),
    screenName: String(userCore.screen_name ?? userLegacy.screen_name ?? userData.screen_name ?? "unknown"),
    profileImageUrl: String((isObject(userData.avatar) ? userData.avatar.image_url : undefined) ?? userLegacy.profile_image_url_https ?? ""),
    verified: Boolean(userData.is_blue_verified ?? userLegacy.verified ?? false),
  };
}

function unwrapVisibility(result: Record<string, unknown>): { tweetData: Record<string, unknown>; isSubscriberOnly: boolean } {
  if (result.__typename === "TweetWithVisibilityResults" && isObject(result.tweet)) {
    return { tweetData: result.tweet, isSubscriberOnly: Boolean(result.tweetInterstitial) };
  }
  return { tweetData: result, isSubscriberOnly: false };
}

function normalizeArticleEntityMap(entityMap: unknown): Record<string, Record<string, unknown>> {
  if (isObject(entityMap)) {
    return Object.fromEntries(
      Object.entries(entityMap).filter(([, value]) => isObject(value)) as Array<[string, Record<string, unknown>]>,
    );
  }
  if (Array.isArray(entityMap)) {
    const normalized: Record<string, Record<string, unknown>> = {};
    for (const item of entityMap) {
      if (isObject(item) && item.key !== undefined && isObject(item.value)) {
        normalized[String(item.key)] = item.value;
      }
    }
    return normalized;
  }
  return {};
}

function findArticleImageUrl(value: unknown): string | undefined {
  if (isObject(value)) {
    for (const key of [
      "original_img_url",
      "originalImgUrl",
      "original_url",
      "originalUrl",
      "media_url_https",
      "mediaUrlHttps",
      "media_url",
      "mediaUrl",
      "url",
      "src",
      "uri",
    ]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) {
        const lowered = candidate.toLowerCase();
        if (
          lowered.startsWith("https://pbs.twimg.com/") ||
          /\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lowered)
        ) {
          return candidate.trim();
        }
      }
    }
    for (const nested of Object.values(value)) {
      const found = findArticleImageUrl(nested);
      if (found) {
        return found;
      }
    }
  }
  if (Array.isArray(value)) {
    for (const nested of value) {
      const found = findArticleImageUrl(nested);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function findArticleCaption(value: unknown): string | undefined {
  if (isObject(value)) {
    for (const key of ["caption", "alt", "alt_text", "altText", "title", "name"]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    for (const nested of Object.values(value)) {
      const found = findArticleCaption(nested);
      if (found) {
        return found;
      }
    }
  }
  if (Array.isArray(value)) {
    for (const nested of value) {
      const found = findArticleCaption(nested);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function extractArticleMediaUrlMap(articleResults: Record<string, unknown>): Record<string, string> {
  const mediaUrlMap: Record<string, string> = {};
  const candidates = [
    articleResults.cover_media,
    ...(Array.isArray(articleResults.media_entities) ? articleResults.media_entities : []),
  ];
  for (const media of candidates) {
    if (!isObject(media)) {
      continue;
    }
    const imageUrl = findArticleImageUrl(media.media_info) ?? findArticleImageUrl(media);
    if (!imageUrl) {
      continue;
    }
    for (const key of ["media_id", "media_key", "id"]) {
      const value = media[key];
      if (typeof value === "string" && value) {
        mediaUrlMap[value] = imageUrl;
      }
    }
  }
  return mediaUrlMap;
}

function extractAtomicMarkdown(block: Record<string, unknown>, entityMap: Record<string, Record<string, unknown>>): string[] {
  const parts: string[] = [];
  const entityRanges = Array.isArray(block.entityRanges) ? block.entityRanges : [];
  for (const range of entityRanges) {
    if (!isObject(range)) {
      continue;
    }
    const entity = range.key !== undefined ? entityMap[String(range.key)] : undefined;
    if (!entity || String(entity.type ?? "").toUpperCase() !== "MARKDOWN") {
      continue;
    }
    const markdown = deepGet(entity, "data", "markdown");
    if (typeof markdown === "string" && markdown.trim()) {
      parts.push(markdown.trim());
    }
  }
  return parts;
}

function renderArticleTextBlock(block: Record<string, unknown>, entityMap: Record<string, Record<string, unknown>>): string {
  const text = typeof block.text === "string" ? block.text : "";
  if (!text) {
    return "";
  }
  let rendered = text;
  const ranges: Array<{ offset: number; length: number; url: string }> = [];
  for (const entityRange of Array.isArray(block.entityRanges) ? block.entityRanges : []) {
    if (!isObject(entityRange)) {
      continue;
    }
    const entity = entityRange.key !== undefined ? entityMap[String(entityRange.key)] : undefined;
    const offset = typeof entityRange.offset === "number" ? entityRange.offset : undefined;
    const length = typeof entityRange.length === "number" ? entityRange.length : undefined;
    const url = deepGet(entity, "data", "url");
    if (!entity || String(entity.type ?? "").toUpperCase() !== "LINK" || offset === undefined || length === undefined || typeof url !== "string") {
      continue;
    }
    ranges.push({ offset, length, url: url.trim() });
  }
  for (const range of ranges.sort((left, right) => right.offset - left.offset)) {
    const label = rendered.slice(range.offset, range.offset + range.length);
    if (!label) {
      continue;
    }
    rendered = `${rendered.slice(0, range.offset)}[${label.replaceAll("]", "\\]")}](${range.url.replaceAll(")", "%29")})${rendered.slice(range.offset + range.length)}`;
  }
  return rendered;
}

function extractArticleImages(
  block: Record<string, unknown>,
  entityMap: Record<string, Record<string, unknown>>,
  mediaUrlMap: Record<string, string>,
): string[] {
  const parts: string[] = [];
  for (const range of Array.isArray(block.entityRanges) ? block.entityRanges : []) {
    if (!isObject(range)) {
      continue;
    }
    const entity = range.key !== undefined ? entityMap[String(range.key)] : undefined;
    if (!entity) {
      continue;
    }
    let imageUrl = findArticleImageUrl(entity);
    if (!imageUrl) {
      const mediaItems = deepGet(entity, "data", "mediaItems");
      if (Array.isArray(mediaItems)) {
        for (const item of mediaItems) {
          if (isObject(item) && typeof item.mediaId === "string" && mediaUrlMap[item.mediaId]) {
            imageUrl = mediaUrlMap[item.mediaId];
            break;
          }
        }
      }
    }
    if (imageUrl) {
      parts.push(`![${findArticleCaption(entity) ?? ""}](${imageUrl})`);
    }
  }
  return parts;
}

function parseArticle(tweetData: Record<string, unknown>): { articleTitle?: string; articleText?: string } {
  const articleResults = deepGet(tweetData, "article", "article_results", "result");
  if (!isObject(articleResults)) {
    return {};
  }
  const title = typeof articleResults.title === "string" ? articleResults.title : undefined;
  const contentState = isObject(articleResults.content_state) ? articleResults.content_state : {};
  const blocks = Array.isArray(contentState.blocks) ? contentState.blocks : [];
  if (!blocks.length) {
    return title ? { articleTitle: title } : {};
  }

  const entityMap = normalizeArticleEntityMap(contentState.entityMap);
  const mediaUrlMap = extractArticleMediaUrlMap(articleResults);
  const parts: string[] = [];
  let orderedCounter = 0;

  for (const rawBlock of blocks) {
    if (!isObject(rawBlock)) {
      continue;
    }
    const type = typeof rawBlock.type === "string" ? rawBlock.type : "unstyled";
    if (type === "atomic") {
      parts.push(...extractAtomicMarkdown(rawBlock, entityMap));
      parts.push(...extractArticleImages(rawBlock, entityMap, mediaUrlMap));
      orderedCounter = 0;
      continue;
    }
    const text = renderArticleTextBlock(rawBlock, entityMap);
    if (!text) {
      continue;
    }
    if (type !== "ordered-list-item") {
      orderedCounter = 0;
    }
    if (type === "header-one") {
      parts.push(`# ${text}`);
    } else if (type === "header-two") {
      parts.push(`## ${text}`);
    } else if (type === "header-three") {
      parts.push(`### ${text}`);
    } else if (type === "blockquote") {
      parts.push(`> ${text}`);
    } else if (type === "unordered-list-item") {
      parts.push(`- ${text}`);
    } else if (type === "ordered-list-item") {
      orderedCounter += 1;
      parts.push(`${orderedCounter}. ${text}`);
    } else if (type === "code-block") {
      parts.push(`\`\`\`\n${text}\n\`\`\``);
    } else {
      parts.push(text);
    }
  }

  return compactOptional({
    articleTitle: title,
    articleText: parts.length ? parts.join("\n\n") : undefined,
  }) as { articleTitle?: string; articleText?: string };
}

export function parseUserResult(userData: unknown): UserProfile | undefined {
  if (!isObject(userData) || userData.__typename === "UserUnavailable" || !userData.rest_id) {
    return undefined;
  }
  const legacy = isObject(userData.legacy) ? userData.legacy : {};
  const core = isObject(userData.core) ? userData.core : {};
  const avatar = isObject(userData.avatar) ? userData.avatar : {};
  const location = isObject(userData.location) ? userData.location : {};

  return {
    id: String(userData.rest_id ?? ""),
    name: String(core.name ?? legacy.name ?? ""),
    screenName: String(core.screen_name ?? legacy.screen_name ?? ""),
    bio: String(legacy.description ?? ""),
    location: String(location.location ?? legacy.location ?? ""),
    url: String(deepGet(legacy, "entities", "url", "urls", 0, "expanded_url") ?? ""),
    followersCount: parseIntSafe(legacy.followers_count, 0),
    followingCount: parseIntSafe(legacy.friends_count, 0),
    tweetsCount: parseIntSafe(legacy.statuses_count, 0),
    likesCount: parseIntSafe(legacy.favourites_count, 0),
    verified: Boolean(userData.is_blue_verified ?? legacy.verified ?? false),
    profileImageUrl: String(avatar.image_url ?? legacy.profile_image_url_https ?? ""),
    createdAt: String(core.created_at ?? legacy.created_at ?? ""),
  };
}

export function parseTweetResult(result: unknown, depth = 0): Tweet | undefined {
  if (depth > 2 || !isObject(result)) {
    return undefined;
  }
  const { tweetData, isSubscriberOnly } = unwrapVisibility(result);
  if (tweetData.__typename === "TweetTombstone") {
    return undefined;
  }

  const legacy = isObject(tweetData.legacy) ? tweetData.legacy : undefined;
  const core = isObject(tweetData.core) ? tweetData.core : undefined;
  if (!legacy || !core) {
    return undefined;
  }

  const user = isObject(deepGet(core, "user_results", "result")) ? (deepGet(core, "user_results", "result") as Record<string, unknown>) : {};
  const userLegacy = isObject(user.legacy) ? user.legacy : {};
  const userCore = isObject(user.core) ? user.core : {};

  const isRetweet = Boolean(deepGet(legacy, "retweeted_status_result", "result"));
  let actualData = tweetData;
  let actualLegacy = legacy;
  let actualUser = user;
  let actualUserLegacy = userLegacy;
  let retweetSubscriberOnly = false;

  if (isRetweet) {
    const retweetResult = deepGet(legacy, "retweeted_status_result", "result");
    if (isObject(retweetResult)) {
      const unwrapped = unwrapVisibility(retweetResult);
      const rtLegacy = isObject(unwrapped.tweetData.legacy) ? unwrapped.tweetData.legacy : undefined;
      const rtCore = isObject(unwrapped.tweetData.core) ? unwrapped.tweetData.core : undefined;
      if (rtLegacy && rtCore) {
        actualData = unwrapped.tweetData;
        actualLegacy = rtLegacy;
        actualUser = isObject(deepGet(rtCore, "user_results", "result")) ? (deepGet(rtCore, "user_results", "result") as Record<string, unknown>) : {};
        actualUserLegacy = isObject(actualUser.legacy) ? actualUser.legacy : {};
        retweetSubscriberOnly = unwrapped.isSubscriberOnly;
      }
    }
  }

  const urls = Array.isArray(deepGet(actualLegacy, "entities", "urls"))
    ? (deepGet(actualLegacy, "entities", "urls") as unknown[])
        .filter(isObject)
        .map((item) => String(item.expanded_url ?? ""))
        .filter(Boolean)
    : [];
  const quoted = deepGet(actualData, "quoted_status_result", "result");
  const quotedTweet = isObject(quoted) ? parseTweetResult(quoted, depth + 1) : undefined;
  const author = extractAuthor(actualUser, actualUserLegacy);
  const noteText = deepGet(actualData, "note_tweet", "note_tweet_results", "result", "text");

  const tweet = compactOptional({
    id: String(actualData.rest_id ?? ""),
    text: typeof noteText === "string" ? noteText : String(actualLegacy.full_text ?? ""),
    author,
    metrics: {
      likes: parseIntSafe(actualLegacy.favorite_count, 0),
      retweets: parseIntSafe(actualLegacy.retweet_count, 0),
      replies: parseIntSafe(actualLegacy.reply_count, 0),
      quotes: parseIntSafe(actualLegacy.quote_count, 0),
      views: parseIntSafe(deepGet(actualData, "views", "count"), 0),
      bookmarks: parseIntSafe(actualLegacy.bookmark_count, 0),
    } satisfies Metrics,
    createdAt: String(actualLegacy.created_at ?? ""),
    media: extractMedia(actualLegacy),
    urls,
    isRetweet,
    lang: String(actualLegacy.lang ?? ""),
    retweetedBy: isRetweet ? String(userCore.screen_name ?? userLegacy.screen_name ?? "unknown") : undefined,
    quotedTweet: quotedTweet
      ? { id: quotedTweet.id, text: quotedTweet.text, author: quotedTweet.author }
      : undefined,
    isSubscriberOnly: isRetweet ? isSubscriberOnly || retweetSubscriberOnly : isSubscriberOnly,
    isPromoted: false,
    ...parseArticle(actualData),
  }) as Tweet;
  return tweet;
}

export function parseTimelineResponse(
  data: unknown,
  getInstructions: (input: unknown) => unknown,
): { tweets: Tweet[]; nextCursor?: string } {
  const tweets: Tweet[] = [];
  let nextCursor: string | undefined;
  const instructions = getInstructions(data);
  if (!Array.isArray(instructions)) {
    return { tweets };
  }
  for (const instruction of instructions) {
    if (!isObject(instruction)) {
      continue;
    }
    const entries = Array.isArray(instruction.entries)
      ? instruction.entries
      : Array.isArray(instruction.moduleItems)
        ? instruction.moduleItems
        : [];
    for (const entry of entries) {
      if (!isObject(entry)) {
        continue;
      }
      const content = isObject(entry.content) ? entry.content : {};
      nextCursor = extractCursor(content) ?? nextCursor;
      const itemContent = isObject(content.itemContent) ? content.itemContent : {};
      const tweet = parseTweetResult(deepGet(itemContent, "tweet_results", "result"));
      if (tweet) {
        tweet.isPromoted = String(entry.entryId ?? "").startsWith("promoted-") || Boolean(itemContent.promotedMetadata);
        tweets.push(tweet);
      }
      for (const nestedItem of Array.isArray(content.items) ? content.items : []) {
        if (!isObject(nestedItem)) {
          continue;
        }
        const nestedTweet = parseTweetResult(deepGet(nestedItem, "item", "itemContent", "tweet_results", "result"));
        if (nestedTweet) {
          const nestedItemContent = deepGet(nestedItem, "item", "itemContent");
          nestedTweet.isPromoted =
            String(deepGet(nestedItem, "entryId") ?? "").startsWith("promoted-") ||
            Boolean(isObject(nestedItemContent) ? nestedItemContent.promotedMetadata : undefined);
          tweets.push(nestedTweet);
        }
      }
    }
  }
  return nextCursor ? { tweets, nextCursor } : { tweets };
}

export function parseBookmarkFolders(data: unknown): BookmarkFolder[] {
  const sliceData = deepGet(data, "data", "viewer", "user_results", "result", "bookmark_collections_slice");
  if (!isObject(sliceData) || !Array.isArray(sliceData.items)) {
    return [];
  }
  return sliceData.items
    .filter(isObject)
    .flatMap((item) => (typeof item.id === "string" ? [{ id: item.id, name: String(item.name ?? "") }] : []));
}

export function parseUserListResponse(
  data: unknown,
  getInstructions: (input: unknown) => unknown,
): { users: UserProfile[]; nextCursor?: string } {
  const users: UserProfile[] = [];
  let nextCursor: string | undefined;
  const instructions = getInstructions(data);
  if (!Array.isArray(instructions)) {
    return { users };
  }
  for (const instruction of instructions) {
    if (!isObject(instruction) || !Array.isArray(instruction.entries)) {
      continue;
    }
    for (const entry of instruction.entries) {
      if (!isObject(entry) || !isObject(entry.content)) {
        continue;
      }
      if (entry.content.entryType === "TimelineTimelineItem") {
        const user = parseUserResult(deepGet(entry.content, "itemContent", "user_results", "result"));
        if (user) {
          users.push(user);
        }
      } else if (entry.content.entryType === "TimelineTimelineCursor" && entry.content.cursorType === "Bottom") {
        nextCursor = typeof entry.content.value === "string" ? entry.content.value : nextCursor;
      }
    }
  }
  return nextCursor ? { users, nextCursor } : { users };
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactOptional<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
