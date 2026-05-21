// src/auth.ts
import { readFileSync } from "fs";

// src/errors.ts
var TwitterError = class extends Error {
  errorCode;
  constructor(message, errorCode = "api_error") {
    super(message);
    this.name = new.target.name;
    this.errorCode = errorCode;
  }
};
var AuthenticationError = class extends TwitterError {
  constructor(message) {
    super(message, "not_authenticated");
  }
};
var RateLimitError = class extends TwitterError {
  constructor(message) {
    super(message, "rate_limited");
  }
};
var NotFoundError = class extends TwitterError {
  constructor(message) {
    super(message, "not_found");
  }
};
var NetworkError = class extends TwitterError {
  constructor(message) {
    super(message, "network_error");
  }
};
var QueryIdError = class extends TwitterError {
  constructor(message) {
    super(message, "query_id_error");
  }
};
var InvalidInputError = class extends TwitterError {
  constructor(message) {
    super(message, "invalid_input");
  }
};
var TwitterApiError = class extends TwitterError {
  statusCode;
  constructor(statusCode, message) {
    const errorCode = statusCode === 401 || statusCode === 403 ? "not_authenticated" : statusCode === 429 ? "rate_limited" : statusCode === 404 ? "not_found" : "api_error";
    super(`Twitter API error (HTTP ${statusCode}): ${message}`, errorCode);
    this.statusCode = statusCode;
  }
};

// src/auth.ts
var TWITTER_DOMAINS = /* @__PURE__ */ new Set(["x.com", "twitter.com", ".x.com", ".twitter.com"]);
function loadEnvCookies(env = process.env) {
  const cookieString = env.TWITTER_COOKIE_STRING?.trim();
  if (cookieString) {
    return authFromCookieString(cookieString);
  }
  const authToken = env.TWITTER_AUTH_TOKEN?.trim();
  const ct0 = env.TWITTER_CT0?.trim();
  if (authToken && ct0) {
    return { authToken, ct0 };
  }
  return void 0;
}
function getCookies(options = {}) {
  const env = options.env ?? process.env;
  const fromEnv = loadEnvCookies(env);
  if (fromEnv) {
    return fromEnv;
  }
  const cookieFile = options.cookieFile ?? env.TWITTER_COOKIE_FILE;
  if (cookieFile) {
    return loadCookieFile(cookieFile);
  }
  throw new AuthenticationError(
    "Twitter cookies not found. Set TWITTER_COOKIE_STRING, or set TWITTER_AUTH_TOKEN and TWITTER_CT0."
  );
}
function authFromCookieString(cookieString) {
  const cookies = parseCookieString(cookieString);
  const authToken = cookies.get("auth_token");
  const ct0 = cookies.get("ct0");
  if (!authToken || !ct0) {
    throw new AuthenticationError("Cookie string must include auth_token and ct0.");
  }
  return {
    authToken,
    ct0,
    cookieString
  };
}
function loadCookieFile(path) {
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) {
    throw new AuthenticationError(`Cookie file is empty: ${path}`);
  }
  if (raw.startsWith("{")) {
    return authFromJsonCookieFile(raw, path);
  }
  if (raw.includes("	") && raw.includes("\n")) {
    return authFromNetscapeCookieFile(raw, path);
  }
  return authFromCookieString(raw);
}
function authFromJsonCookieFile(raw, path) {
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) {
    throw new AuthenticationError(`Cookie JSON must be an object: ${path}`);
  }
  const cookieString = typeof parsed.cookieString === "string" ? parsed.cookieString : typeof parsed.cookie_string === "string" ? parsed.cookie_string : void 0;
  if (cookieString) {
    return authFromCookieString(cookieString);
  }
  const authToken = stringValue(parsed.authToken) ?? stringValue(parsed.auth_token);
  const ct0 = stringValue(parsed.ct0);
  if (!authToken || !ct0) {
    throw new AuthenticationError(`Cookie JSON must include authToken/auth_token and ct0: ${path}`);
  }
  return { authToken, ct0 };
}
function authFromNetscapeCookieFile(raw, path) {
  const cookiePairs = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = trimmed.split("	");
    if (parts.length < 7) {
      continue;
    }
    const [domain, , , , , name, value] = parts;
    if (!domain || !name || value === void 0 || !isTwitterDomain(domain)) {
      continue;
    }
    cookiePairs.push(`${name}=${value}`);
  }
  if (!cookiePairs.length) {
    throw new AuthenticationError(`Cookie file does not contain x.com/twitter.com cookies: ${path}`);
  }
  return authFromCookieString(cookiePairs.join("; "));
}
function parseCookieString(cookieString) {
  const cookies = /* @__PURE__ */ new Map();
  for (const part of cookieString.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=");
    if (name && value) {
      cookies.set(name, value);
    }
  }
  return cookies;
}
function isTwitterDomain(domain) {
  return TWITTER_DOMAINS.has(domain) || domain.endsWith(".x.com") || domain.endsWith(".twitter.com");
}
function stringValue(value) {
  return typeof value === "string" && value ? value : void 0;
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/client.ts
import { setTimeout as sleep } from "timers/promises";

// src/config.ts
import { readFile } from "fs/promises";
import YAML from "yaml";
var DEFAULT_CONFIG = {
  fetch: {
    count: 50
  },
  filter: {
    mode: "topN",
    topN: 20,
    minScore: 50,
    lang: [],
    excludeRetweets: false,
    weights: {
      likes: 1,
      retweets: 3,
      replies: 2,
      bookmarks: 5,
      views_log: 0.5
    }
  },
  rateLimit: {
    requestDelay: 2.5,
    maxRetries: 3,
    retryBaseDelay: 5,
    maxCount: 200
  }
};
function asInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
function asFloat(value, defaultValue) {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
function deepMerge(target, source) {
  const result = structuredClone(target);
  for (const [key, value] of Object.entries(source)) {
    const current = result[key];
    if (isObject2(current) && isObject2(value)) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}
function normalizeConfig(raw = {}) {
  const merged = deepMerge(DEFAULT_CONFIG, raw);
  merged.fetch.count = Math.max(asInt(merged.fetch.count, DEFAULT_CONFIG.fetch.count), 1);
  merged.filter.mode = merged.filter.mode === "all" || merged.filter.mode === "score" || merged.filter.mode === "topN" ? merged.filter.mode : "topN";
  merged.filter.topN = Math.max(asInt(merged.filter.topN, DEFAULT_CONFIG.filter.topN), 1);
  merged.filter.minScore = asFloat(merged.filter.minScore, DEFAULT_CONFIG.filter.minScore);
  merged.filter.excludeRetweets = Boolean(merged.filter.excludeRetweets);
  merged.filter.lang = Array.isArray(merged.filter.lang) ? merged.filter.lang.map((lang) => String(lang)).filter(Boolean) : [];
  const weights = isObject2(merged.filter.weights) ? merged.filter.weights : {};
  merged.filter.weights = Object.fromEntries(
    Object.entries(DEFAULT_CONFIG.filter.weights).map(([key, value]) => [key, asFloat(weights[key], value)])
  );
  merged.rateLimit.requestDelay = Math.max(
    asFloat(merged.rateLimit.requestDelay, DEFAULT_CONFIG.rateLimit.requestDelay),
    0
  );
  merged.rateLimit.maxRetries = Math.max(asInt(merged.rateLimit.maxRetries, DEFAULT_CONFIG.rateLimit.maxRetries), 0);
  merged.rateLimit.retryBaseDelay = Math.max(
    asFloat(merged.rateLimit.retryBaseDelay, DEFAULT_CONFIG.rateLimit.retryBaseDelay),
    1
  );
  merged.rateLimit.maxCount = Math.max(asInt(merged.rateLimit.maxCount, DEFAULT_CONFIG.rateLimit.maxCount), 1);
  return merged;
}
async function loadConfig(configPath) {
  if (!configPath) {
    return structuredClone(DEFAULT_CONFIG);
  }
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = YAML.parse(raw);
    return normalizeConfig(isObject2(parsed) ? parsed : {});
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/graphql.ts
var FALLBACK_QUERY_IDS = {
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
  BookmarkFolderTimeline: "hNY7X2xE2N7HVF6Qb_mu6w"
};
var FEATURES = {
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
  responsive_web_enhance_cards_enabled: false
};
function buildGraphqlUrl(queryId, operationName, variables, features, fieldToggles) {
  const compactFeatures = Object.fromEntries(Object.entries(features).filter(([, value]) => value !== false));
  const search = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(compactFeatures)
  });
  if (fieldToggles) {
    search.set("fieldToggles", JSON.stringify(fieldToggles));
  }
  return `https://x.com/i/api/graphql/${queryId}/${operationName}?${search.toString()}`;
}
var QueryIdResolver = class {
  cached = /* @__PURE__ */ new Map();
  resolve(operationName) {
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
  invalidate(operationName) {
    this.cached.delete(operationName);
  }
};

// src/parser.ts
function deepGet(value, ...keys) {
  let current = value;
  for (const key of keys) {
    if (typeof key === "number") {
      if (Array.isArray(current) && key >= 0 && key < current.length) {
        current = current[key];
      } else {
        return void 0;
      }
    } else if (isObject3(current)) {
      current = current[key];
    } else {
      return void 0;
    }
  }
  return current;
}
function parseIntSafe(value, defaultValue) {
  const text = String(value ?? "").replaceAll(",", "").trim();
  if (!text) {
    return defaultValue;
  }
  const parsed = Number.parseInt(text.includes(".") ? String(Number.parseFloat(text)) : text, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
function extractCursor(content) {
  return content.cursorType === "Bottom" && typeof content.value === "string" ? content.value : void 0;
}
function extractMedia(legacy) {
  const media = deepGet(legacy, "extended_entities", "media");
  if (!Array.isArray(media)) {
    return [];
  }
  return media.flatMap((item) => {
    if (!isObject3(item) || typeof item.type !== "string") {
      return [];
    }
    if (item.type === "photo") {
      return [compactOptional({
        type: "photo",
        url: String(item.media_url_https ?? ""),
        width: numberOrUndefined(deepGet(item, "original_info", "width")),
        height: numberOrUndefined(deepGet(item, "original_info", "height"))
      })];
    }
    if (item.type === "video" || item.type === "animated_gif") {
      const variants = Array.isArray(deepGet(item, "video_info", "variants")) ? [...deepGet(item, "video_info", "variants")] : [];
      const mp4 = variants.filter((variant) => isObject3(variant) && variant.content_type === "video/mp4").sort(
        (left, right) => Number(right.bitrate ?? 0) - Number(left.bitrate ?? 0)
      );
      const best = mp4[0];
      return [compactOptional({
        type: item.type,
        url: String(best?.url ?? item.media_url_https ?? ""),
        width: numberOrUndefined(deepGet(item, "original_info", "width")),
        height: numberOrUndefined(deepGet(item, "original_info", "height"))
      })];
    }
    return [];
  });
}
function extractAuthor(userData, userLegacy) {
  const userCore = isObject3(userData.core) ? userData.core : {};
  return {
    id: String(userData.rest_id ?? ""),
    name: String(userCore.name ?? userLegacy.name ?? userData.name ?? "Unknown"),
    screenName: String(userCore.screen_name ?? userLegacy.screen_name ?? userData.screen_name ?? "unknown"),
    profileImageUrl: String((isObject3(userData.avatar) ? userData.avatar.image_url : void 0) ?? userLegacy.profile_image_url_https ?? ""),
    verified: Boolean(userData.is_blue_verified ?? userLegacy.verified ?? false)
  };
}
function unwrapVisibility(result) {
  if (result.__typename === "TweetWithVisibilityResults" && isObject3(result.tweet)) {
    return { tweetData: result.tweet, isSubscriberOnly: Boolean(result.tweetInterstitial) };
  }
  return { tweetData: result, isSubscriberOnly: false };
}
function normalizeArticleEntityMap(entityMap) {
  if (isObject3(entityMap)) {
    return Object.fromEntries(
      Object.entries(entityMap).filter(([, value]) => isObject3(value))
    );
  }
  if (Array.isArray(entityMap)) {
    const normalized = {};
    for (const item of entityMap) {
      if (isObject3(item) && item.key !== void 0 && isObject3(item.value)) {
        normalized[String(item.key)] = item.value;
      }
    }
    return normalized;
  }
  return {};
}
function findArticleImageUrl(value) {
  if (isObject3(value)) {
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
      "uri"
    ]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) {
        const lowered = candidate.toLowerCase();
        if (lowered.startsWith("https://pbs.twimg.com/") || /\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lowered)) {
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
  return void 0;
}
function findArticleCaption(value) {
  if (isObject3(value)) {
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
  return void 0;
}
function extractArticleMediaUrlMap(articleResults) {
  const mediaUrlMap = {};
  const candidates = [
    articleResults.cover_media,
    ...Array.isArray(articleResults.media_entities) ? articleResults.media_entities : []
  ];
  for (const media of candidates) {
    if (!isObject3(media)) {
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
function extractAtomicMarkdown(block, entityMap) {
  const parts = [];
  const entityRanges = Array.isArray(block.entityRanges) ? block.entityRanges : [];
  for (const range of entityRanges) {
    if (!isObject3(range)) {
      continue;
    }
    const entity = range.key !== void 0 ? entityMap[String(range.key)] : void 0;
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
function renderArticleTextBlock(block, entityMap) {
  const text = typeof block.text === "string" ? block.text : "";
  if (!text) {
    return "";
  }
  let rendered = text;
  const ranges = [];
  for (const entityRange of Array.isArray(block.entityRanges) ? block.entityRanges : []) {
    if (!isObject3(entityRange)) {
      continue;
    }
    const entity = entityRange.key !== void 0 ? entityMap[String(entityRange.key)] : void 0;
    const offset = typeof entityRange.offset === "number" ? entityRange.offset : void 0;
    const length = typeof entityRange.length === "number" ? entityRange.length : void 0;
    const url = deepGet(entity, "data", "url");
    if (!entity || String(entity.type ?? "").toUpperCase() !== "LINK" || offset === void 0 || length === void 0 || typeof url !== "string") {
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
function extractArticleImages(block, entityMap, mediaUrlMap) {
  const parts = [];
  for (const range of Array.isArray(block.entityRanges) ? block.entityRanges : []) {
    if (!isObject3(range)) {
      continue;
    }
    const entity = range.key !== void 0 ? entityMap[String(range.key)] : void 0;
    if (!entity) {
      continue;
    }
    let imageUrl = findArticleImageUrl(entity);
    if (!imageUrl) {
      const mediaItems = deepGet(entity, "data", "mediaItems");
      if (Array.isArray(mediaItems)) {
        for (const item of mediaItems) {
          if (isObject3(item) && typeof item.mediaId === "string" && mediaUrlMap[item.mediaId]) {
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
function parseArticle(tweetData) {
  const articleResults = deepGet(tweetData, "article", "article_results", "result");
  if (!isObject3(articleResults)) {
    return {};
  }
  const title = typeof articleResults.title === "string" ? articleResults.title : void 0;
  const contentState = isObject3(articleResults.content_state) ? articleResults.content_state : {};
  const blocks = Array.isArray(contentState.blocks) ? contentState.blocks : [];
  if (!blocks.length) {
    return title ? { articleTitle: title } : {};
  }
  const entityMap = normalizeArticleEntityMap(contentState.entityMap);
  const mediaUrlMap = extractArticleMediaUrlMap(articleResults);
  const parts = [];
  let orderedCounter = 0;
  for (const rawBlock of blocks) {
    if (!isObject3(rawBlock)) {
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
      parts.push(`\`\`\`
${text}
\`\`\``);
    } else {
      parts.push(text);
    }
  }
  return compactOptional({
    articleTitle: title,
    articleText: parts.length ? parts.join("\n\n") : void 0
  });
}
function parseUserResult(userData) {
  if (!isObject3(userData) || userData.__typename === "UserUnavailable" || !userData.rest_id) {
    return void 0;
  }
  const legacy = isObject3(userData.legacy) ? userData.legacy : {};
  const core = isObject3(userData.core) ? userData.core : {};
  const avatar = isObject3(userData.avatar) ? userData.avatar : {};
  const location = isObject3(userData.location) ? userData.location : {};
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
    createdAt: String(core.created_at ?? legacy.created_at ?? "")
  };
}
function parseTweetResult(result, depth = 0) {
  if (depth > 2 || !isObject3(result)) {
    return void 0;
  }
  const { tweetData, isSubscriberOnly } = unwrapVisibility(result);
  if (tweetData.__typename === "TweetTombstone") {
    return void 0;
  }
  const legacy = isObject3(tweetData.legacy) ? tweetData.legacy : void 0;
  const core = isObject3(tweetData.core) ? tweetData.core : void 0;
  if (!legacy || !core) {
    return void 0;
  }
  const user = isObject3(deepGet(core, "user_results", "result")) ? deepGet(core, "user_results", "result") : {};
  const userLegacy = isObject3(user.legacy) ? user.legacy : {};
  const userCore = isObject3(user.core) ? user.core : {};
  const isRetweet = Boolean(deepGet(legacy, "retweeted_status_result", "result"));
  let actualData = tweetData;
  let actualLegacy = legacy;
  let actualUser = user;
  let actualUserLegacy = userLegacy;
  let retweetSubscriberOnly = false;
  if (isRetweet) {
    const retweetResult = deepGet(legacy, "retweeted_status_result", "result");
    if (isObject3(retweetResult)) {
      const unwrapped = unwrapVisibility(retweetResult);
      const rtLegacy = isObject3(unwrapped.tweetData.legacy) ? unwrapped.tweetData.legacy : void 0;
      const rtCore = isObject3(unwrapped.tweetData.core) ? unwrapped.tweetData.core : void 0;
      if (rtLegacy && rtCore) {
        actualData = unwrapped.tweetData;
        actualLegacy = rtLegacy;
        actualUser = isObject3(deepGet(rtCore, "user_results", "result")) ? deepGet(rtCore, "user_results", "result") : {};
        actualUserLegacy = isObject3(actualUser.legacy) ? actualUser.legacy : {};
        retweetSubscriberOnly = unwrapped.isSubscriberOnly;
      }
    }
  }
  const urls = Array.isArray(deepGet(actualLegacy, "entities", "urls")) ? deepGet(actualLegacy, "entities", "urls").filter(isObject3).map((item) => String(item.expanded_url ?? "")).filter(Boolean) : [];
  const quoted = deepGet(actualData, "quoted_status_result", "result");
  const quotedTweet = isObject3(quoted) ? parseTweetResult(quoted, depth + 1) : void 0;
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
      bookmarks: parseIntSafe(actualLegacy.bookmark_count, 0)
    },
    createdAt: String(actualLegacy.created_at ?? ""),
    media: extractMedia(actualLegacy),
    urls,
    isRetweet,
    lang: String(actualLegacy.lang ?? ""),
    retweetedBy: isRetweet ? String(userCore.screen_name ?? userLegacy.screen_name ?? "unknown") : void 0,
    quotedTweet: quotedTweet ? { id: quotedTweet.id, text: quotedTweet.text, author: quotedTweet.author } : void 0,
    isSubscriberOnly: isRetweet ? isSubscriberOnly || retweetSubscriberOnly : isSubscriberOnly,
    isPromoted: false,
    ...parseArticle(actualData)
  });
  return tweet;
}
function parseTimelineResponse(data, getInstructions) {
  const tweets = [];
  let nextCursor;
  const instructions = getInstructions(data);
  if (!Array.isArray(instructions)) {
    return { tweets };
  }
  for (const instruction of instructions) {
    if (!isObject3(instruction)) {
      continue;
    }
    const entries = Array.isArray(instruction.entries) ? instruction.entries : Array.isArray(instruction.moduleItems) ? instruction.moduleItems : [];
    for (const entry of entries) {
      if (!isObject3(entry)) {
        continue;
      }
      const content = isObject3(entry.content) ? entry.content : {};
      nextCursor = extractCursor(content) ?? nextCursor;
      const itemContent = isObject3(content.itemContent) ? content.itemContent : {};
      const tweet = parseTweetResult(deepGet(itemContent, "tweet_results", "result"));
      if (tweet) {
        tweet.isPromoted = String(entry.entryId ?? "").startsWith("promoted-") || Boolean(itemContent.promotedMetadata);
        tweets.push(tweet);
      }
      for (const nestedItem of Array.isArray(content.items) ? content.items : []) {
        if (!isObject3(nestedItem)) {
          continue;
        }
        const nestedTweet = parseTweetResult(deepGet(nestedItem, "item", "itemContent", "tweet_results", "result"));
        if (nestedTweet) {
          const nestedItemContent = deepGet(nestedItem, "item", "itemContent");
          nestedTweet.isPromoted = String(deepGet(nestedItem, "entryId") ?? "").startsWith("promoted-") || Boolean(isObject3(nestedItemContent) ? nestedItemContent.promotedMetadata : void 0);
          tweets.push(nestedTweet);
        }
      }
    }
  }
  return nextCursor ? { tweets, nextCursor } : { tweets };
}
function parseBookmarkFolders(data) {
  const sliceData = deepGet(data, "data", "viewer", "user_results", "result", "bookmark_collections_slice");
  if (!isObject3(sliceData) || !Array.isArray(sliceData.items)) {
    return [];
  }
  return sliceData.items.filter(isObject3).flatMap((item) => typeof item.id === "string" ? [{ id: item.id, name: String(item.name ?? "") }] : []);
}
function parseUserListResponse(data, getInstructions) {
  const users = [];
  let nextCursor;
  const instructions = getInstructions(data);
  if (!Array.isArray(instructions)) {
    return { users };
  }
  for (const instruction of instructions) {
    if (!isObject3(instruction) || !Array.isArray(instruction.entries)) {
      continue;
    }
    for (const entry of instruction.entries) {
      if (!isObject3(entry) || !isObject3(entry.content)) {
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
function numberOrUndefined(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function isObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compactOptional(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}

// src/constants.ts
var BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
var chromeVersion = "133";
function syncChromeVersion(target) {
  const match = /(\d+)/.exec(target);
  if (match?.[1]) {
    chromeVersion = match[1];
  }
}
function getUserAgent() {
  const platform = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
}
function getSecChUa() {
  return `"Chromium";v="${chromeVersion}", "Not(A:Brand";v="99", "Google Chrome";v="${chromeVersion}"`;
}
function getSecChUaFullVersion() {
  return `"${chromeVersion}.0.0.0"`;
}
function getSecChUaFullVersionList() {
  return `"Google Chrome";v="${chromeVersion}.0.0.0", "Chromium";v="${chromeVersion}.0.0.0", "Not.A/Brand";v="99.0.0.0"`;
}
function getAcceptLanguage() {
  const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en_US.UTF-8";
  const tag = raw.split(".", 1)[0]?.replaceAll("_", "-") || "en-US";
  const language = tag.split("-", 1)[0] || "en";
  return `${tag},${language};q=0.9,en;q=0.8`;
}
function getTwitterClientLanguage() {
  const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en_US.UTF-8";
  return raw.split(".", 1)[0]?.split("_", 1)[0]?.split("-", 1)[0] || "en";
}

// src/client.ts
var ABSOLUTE_MAX_COUNT = 500;
var TwitterClient = class {
  auth;
  requestDelay;
  maxRetries;
  retryBaseDelay;
  maxCount;
  fetchImpl;
  queryIds = new QueryIdResolver();
  constructor(options = {}) {
    this.auth = options.auth ?? getCookies();
    this.requestDelay = options.rateLimit?.requestDelay ?? DEFAULT_CONFIG.rateLimit.requestDelay;
    this.maxRetries = options.rateLimit?.maxRetries ?? DEFAULT_CONFIG.rateLimit.maxRetries;
    this.retryBaseDelay = options.rateLimit?.retryBaseDelay ?? DEFAULT_CONFIG.rateLimit.retryBaseDelay;
    this.maxCount = Math.min(options.rateLimit?.maxCount ?? DEFAULT_CONFIG.rateLimit.maxCount, ABSOLUTE_MAX_COUNT);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }
  async resolveUserId(identifier) {
    return /^\d+$/.test(identifier) ? identifier : (await this.fetchUser(identifier)).id;
  }
  async fetchHomeTimeline(options = {}) {
    return this.fetchTimelinePage("HomeTimeline", {
      ...options.count !== void 0 ? { count: options.count } : {},
      ...options.includePromoted !== void 0 ? { includePromoted: options.includePromoted } : {},
      ...options.cursor ? { cursor: options.cursor } : {},
      getInstructions: (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions")
    });
  }
  async fetchFollowingFeed(options = {}) {
    return this.fetchTimelinePage("HomeLatestTimeline", {
      ...options.count !== void 0 ? { count: options.count } : {},
      ...options.includePromoted !== void 0 ? { includePromoted: options.includePromoted } : {},
      ...options.cursor ? { cursor: options.cursor } : {},
      getInstructions: (data) => deepGet(data, "data", "home", "home_timeline_urt", "instructions")
    });
  }
  async fetchBookmarks(count = 50) {
    const page = await this.fetchTimelinePage("Bookmarks", {
      count,
      getInstructions: (data) => deepGet(data, "data", "bookmark_timeline", "timeline", "instructions") ?? deepGet(data, "data", "bookmark_timeline_v2", "timeline", "instructions")
    });
    return page.items;
  }
  async fetchBookmarkFolders() {
    const folders = [];
    let cursor;
    for (let page = 0; page < 10; page += 1) {
      const variables = {};
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
  async fetchBookmarkFolderTimeline(folderId, count = 50) {
    const page = await this.fetchTimelinePage("BookmarkFolderTimeline", {
      count,
      overrideBaseVariables: true,
      extraVariables: {
        bookmark_collection_id: folderId,
        includePromotedContent: false
      },
      getInstructions: (data) => deepGet(data, "data", "bookmark_collection_timeline", "timeline", "instructions")
    });
    return page.items;
  }
  async fetchUser(screenName) {
    const data = await this.graphqlGet(
      "UserByScreenName",
      {
        screen_name: screenName,
        withSafetyModeUserFields: true
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
        responsive_web_graphql_timeline_navigation_enabled: true
      }
    );
    const result = parseUserResult(deepGet(data, "data", "user", "result"));
    if (!result) {
      throw new NotFoundError(`User @${screenName} not found`);
    }
    return result;
  }
  async fetchUserTweets(userId, count = 20) {
    const page = await this.fetchTimelinePage("UserTweets", {
      count,
      extraVariables: {
        userId,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true
      },
      getInstructions: (data) => deepGet(data, "data", "user", "result", "timeline", "timeline", "instructions") ?? deepGet(data, "data", "user", "result", "timeline_v2", "timeline", "instructions")
    });
    return page.items;
  }
  async fetchUserLikes(userId, count = 20) {
    const page = await this.fetchTimelinePage("Likes", {
      count,
      overrideBaseVariables: true,
      extraVariables: {
        userId,
        includePromotedContent: false,
        withClientEventToken: false,
        withBirdwatchNotes: false,
        withVoice: true
      },
      getInstructions: (data) => deepGet(data, "data", "user", "result", "timeline", "timeline", "instructions") ?? deepGet(data, "data", "user", "result", "timeline_v2", "timeline", "instructions")
    });
    return page.items;
  }
  async fetchSearch(query, count = 20, product = "Top") {
    const page = await this.fetchTimelinePage("SearchTimeline", {
      count,
      usePost: true,
      overrideBaseVariables: true,
      extraVariables: {
        rawQuery: query,
        querySource: "typed_query",
        product
      },
      getInstructions: (data) => deepGet(data, "data", "search_by_raw_query", "search_timeline", "timeline", "instructions")
    });
    return page.items;
  }
  async fetchTweetDetail(tweetId, count = 20) {
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
        withVoice: true
      },
      fieldToggles: {
        withArticleRichContentState: true,
        withArticlePlainText: false,
        withGrokAnalyze: false,
        withDisallowedReplyControls: false
      },
      getInstructions: (data) => deepGet(data, "data", "tweetResult", "result", "timeline", "instructions") ?? deepGet(data, "data", "threaded_conversation_with_injections_v2", "instructions")
    });
    return page.items;
  }
  async fetchArticle(tweetId) {
    const data = await this.graphqlGet(
      "TweetResultByRestId",
      {
        tweetId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false
      },
      {
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        articles_preview_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false
      },
      {
        withArticleRichContentState: true,
        withArticlePlainText: true
      }
    );
    const tweet = parseTweetResult(deepGet(data, "data", "tweetResult", "result"));
    if (!tweet || !tweet.articleTitle && !tweet.articleText) {
      throw new NotFoundError(`Tweet ${tweetId} has no article content`);
    }
    return tweet;
  }
  async fetchListTimeline(listId, options = {}) {
    return this.fetchTimelinePage("ListLatestTweetsTimeline", {
      ...options.count !== void 0 ? { count: options.count } : {},
      ...options.cursor ? { cursor: options.cursor } : {},
      overrideBaseVariables: true,
      extraVariables: { listId },
      getInstructions: (data) => deepGet(data, "data", "list", "tweets_timeline", "timeline", "instructions")
    });
  }
  async fetchFollowers(userId, count = 20) {
    return this.fetchUserList("Followers", userId, count);
  }
  async fetchFollowing(userId, count = 20) {
    return this.fetchUserList("Following", userId, count);
  }
  async fetchMe() {
    const data = await this.apiGet("https://x.com/i/api/1.1/account/multi/list.json");
    const users = Array.isArray(data.users) ? data.users : void 0;
    let screenName;
    if (users?.[0] && typeof users[0].screen_name === "string") {
      screenName = String(users[0].screen_name);
    } else if (Array.isArray(data) && data[0] && typeof deepGet(data[0], "user", "screen_name") === "string") {
      screenName = String(deepGet(data[0], "user", "screen_name"));
    }
    if (!screenName) {
      throw new TwitterApiError(0, "Failed to fetch current user info");
    }
    return this.fetchUser(screenName);
  }
  async fetchUserList(operationName, userId, count) {
    const targetCount = Math.min(Math.max(count, 0), this.maxCount);
    if (targetCount <= 0) {
      return [];
    }
    const users = [];
    const seen = /* @__PURE__ */ new Set();
    let cursor;
    const maxAttempts = Math.ceil(targetCount / 20) + 2;
    for (let attempt = 0; attempt < maxAttempts && users.length < targetCount; attempt += 1) {
      const variables = {
        userId,
        count: Math.min(targetCount - users.length + 5, 40),
        includePromotedContent: false
      };
      if (cursor) {
        variables.cursor = cursor;
      }
      const data = await this.graphqlPost(operationName, variables, FEATURES);
      const parsed = parseUserListResponse(
        data,
        (payload) => deepGet(payload, "data", "user", "result", "timeline", "timeline", "instructions")
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
        await sleep(this.requestDelay * 1e3);
      }
    }
    return users.slice(0, targetCount);
  }
  async fetchTimelinePage(operationName, options) {
    const count = Math.min(Math.max(options.count ?? 20, 0), this.maxCount);
    if (count <= 0) {
      return { items: [] };
    }
    const tweets = [];
    const seen = /* @__PURE__ */ new Set();
    let cursor = options.cursor;
    let continuationCursor;
    const maxAttempts = Math.ceil(count / 20) + 2;
    for (let attempt = 0; attempt < maxAttempts && tweets.length < count; attempt += 1) {
      const variables = options.overrideBaseVariables ? { count: Math.min(count - tweets.length + 5, 40) } : {
        count: Math.min(count - tweets.length + 5, 40),
        includePromotedContent: options.includePromoted ?? false,
        latestControlAvailable: true,
        requestContext: "launch"
      };
      if (options.extraVariables) {
        Object.assign(variables, options.extraVariables);
      }
      if (cursor) {
        variables.cursor = cursor;
      }
      const data = options.usePost ? await this.graphqlPost(operationName, variables, FEATURES) : await this.graphqlGet(operationName, variables, FEATURES, options.fieldToggles);
      const parsed = parseTimelineResponse(data, options.getInstructions);
      for (const tweet of parsed.tweets) {
        if (tweet.id && !seen.has(tweet.id)) {
          seen.add(tweet.id);
          tweets.push(tweet);
        }
      }
      if (!parsed.nextCursor || parsed.nextCursor === cursor) {
        continuationCursor = void 0;
        break;
      }
      continuationCursor = parsed.nextCursor;
      cursor = parsed.nextCursor;
      if (tweets.length < count && this.requestDelay > 0) {
        await sleep(this.requestDelay * 1e3);
      }
    }
    return continuationCursor ? { items: tweets.slice(0, count), nextCursor: continuationCursor } : { items: tweets.slice(0, count) };
  }
  async graphqlGet(operationName, variables, features, fieldToggles) {
    const queryId = this.queryIds.resolve(operationName);
    const url = buildGraphqlUrl(queryId, operationName, variables, features, fieldToggles);
    return this.apiGet(url);
  }
  async graphqlPost(operationName, variables, features) {
    const queryId = this.queryIds.resolve(operationName);
    return this.apiRequest(`https://x.com/i/api/graphql/${queryId}/${operationName}`, "POST", {
      variables,
      queryId,
      ...features ? { features } : {}
    });
  }
  async apiGet(url) {
    return this.apiRequest(url, "GET");
  }
  async apiRequest(url, method, body) {
    const headers = this.buildHeaders(url, method);
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        ...method === "POST" ? { body: JSON.stringify(body) } : {}
      });
      if (response.status === 429 && attempt < this.maxRetries) {
        await sleep(this.retryBaseDelay * 2 ** attempt * 1e3);
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
  buildHeaders(url, method) {
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
      "x-client-transaction-id": Buffer.from(`${method}:${url}:${Date.now()}`).toString("base64url").slice(0, 94)
    });
    return headers;
  }
};
function createTwitterClient(options = {}) {
  return new TwitterClient(options);
}

// src/filter.ts
var DEFAULT_WEIGHTS = {
  likes: 1,
  retweets: 3,
  replies: 2,
  bookmarks: 5,
  views_log: 0.5
};
function scoreTweet(tweet, weights = DEFAULT_WEIGHTS) {
  return (weights.likes ?? 1) * tweet.metrics.likes + (weights.retweets ?? 3) * tweet.metrics.retweets + (weights.replies ?? 2) * tweet.metrics.replies + (weights.bookmarks ?? 5) * tweet.metrics.bookmarks + (weights.views_log ?? 0.5) * Math.log10(Math.max(tweet.metrics.views, 1));
}
function filterTweets(tweets, config = {}) {
  let filtered = [...tweets];
  if (config.lang?.length) {
    const allowed = new Set(config.lang.filter(Boolean));
    filtered = filtered.filter((tweet) => allowed.has(tweet.lang));
  }
  if (config.excludeRetweets) {
    filtered = filtered.filter((tweet) => !tweet.isRetweet);
  }
  const weights = { ...DEFAULT_WEIGHTS, ...config.weights ?? {} };
  const scored = filtered.map((tweet) => ({
    ...tweet,
    score: Number(scoreTweet(tweet, weights).toFixed(1))
  })).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  if (config.mode === "score") {
    return scored.filter((tweet) => (tweet.score ?? 0) >= (config.minScore ?? 50));
  }
  if (config.mode === "all") {
    return scored;
  }
  return scored.slice(0, Math.max(config.topN ?? 20, 1));
}

// src/output.ts
import YAML2 from "yaml";
var SCHEMA_VERSION = "1";
function successPayload(data, pagination) {
  return pagination?.nextCursor ? { ok: true, schema_version: SCHEMA_VERSION, data, pagination } : { ok: true, schema_version: SCHEMA_VERSION, data };
}
function errorPayload(code, message, details) {
  return details === void 0 ? { ok: false, schema_version: SCHEMA_VERSION, error: { code, message } } : { ok: false, schema_version: SCHEMA_VERSION, error: { code, message, details } };
}
function encodeStructured(data, format) {
  if (format === "json") {
    return `${JSON.stringify(data, null, 2)}
`;
  }
  return YAML2.stringify(data);
}

// src/search.ts
var LANG_PATTERN = /^[A-Za-z][A-Za-z-]{1,14}$/;
function buildSearchQuery({
  query = "",
  fromUser,
  toUser,
  lang,
  since,
  until,
  has,
  exclude,
  minLikes,
  minRetweets
} = {}) {
  const parts = [];
  const trimmedQuery = query.trim();
  const normalizedFrom = normalizeHandle(fromUser);
  const normalizedTo = normalizeHandle(toUser);
  const normalizedLang = normalizeLang(lang);
  const normalizedSince = normalizeDate("--since", since);
  const normalizedUntil = normalizeDate("--until", until);
  if (minLikes !== void 0 && minLikes < 0) {
    throw new InvalidInputError("--min-likes must be greater than or equal to 0");
  }
  if (minRetweets !== void 0 && minRetweets < 0) {
    throw new InvalidInputError("--min-retweets must be greater than or equal to 0");
  }
  if (normalizedSince && normalizedUntil && normalizedSince > normalizedUntil) {
    throw new InvalidInputError("--since must be on or before --until");
  }
  if (trimmedQuery) {
    parts.push(trimmedQuery);
  }
  if (normalizedFrom) {
    parts.push(`from:${normalizedFrom}`);
  }
  if (normalizedTo) {
    parts.push(`to:${normalizedTo}`);
  }
  if (normalizedLang) {
    parts.push(`lang:${normalizedLang}`);
  }
  if (normalizedSince) {
    parts.push(`since:${normalizedSince}`);
  }
  if (normalizedUntil) {
    parts.push(`until:${normalizedUntil}`);
  }
  for (const item of has ?? []) {
    parts.push(`filter:${item.toLowerCase()}`);
  }
  for (const item of exclude ?? []) {
    parts.push(`-filter:${item.toLowerCase()}`);
  }
  if (minLikes !== void 0) {
    parts.push(`min_faves:${minLikes}`);
  }
  if (minRetweets !== void 0) {
    parts.push(`min_retweets:${minRetweets}`);
  }
  return parts.join(" ");
}
function normalizeHandle(value) {
  if (!value) {
    return void 0;
  }
  const normalized = value.trim().replace(/^@/, "");
  return normalized || void 0;
}
function normalizeLang(value) {
  if (!value) {
    return void 0;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return void 0;
  }
  if (!LANG_PATTERN.test(normalized)) {
    throw new InvalidInputError("--lang must be an ISO language code like en or zh-cn");
  }
  return normalized;
}
function normalizeDate(flagName, value) {
  if (!value) {
    return void 0;
  }
  const normalized = value.trim();
  if (!normalized) {
    return void 0;
  }
  if (Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new InvalidInputError(`${flagName} must be in YYYY-MM-DD format`);
  }
  return normalized;
}

// src/time.ts
var TWITTER_TIME_FORMAT = /^(?<dow>\w{3}) (?<month>\w{3}) (?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}) (?<offset>[+-]\d{4}) (?<year>\d{4})$/;
function parseTwitterTime(createdAt) {
  if (!createdAt) {
    return void 0;
  }
  const match = TWITTER_TIME_FORMAT.exec(createdAt);
  if (!match?.groups) {
    return void 0;
  }
  const groups = match.groups;
  const month = groups.month;
  const day = groups.day;
  const time = groups.time;
  const offset = groups.offset;
  const year = groups.year;
  if (!month || !day || !time || !offset || !year) {
    return void 0;
  }
  const iso = `${year}-${monthToNumber(month)}-${day}T${time}${offset.slice(0, 3)}:${offset.slice(3)}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.valueOf()) ? void 0 : parsed;
}
function formatLocalTime(createdAt) {
  const parsed = parseTwitterTime(createdAt);
  if (!parsed) {
    return createdAt;
  }
  const formatter = new Intl.DateTimeFormat(void 0, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(parsed).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
function formatRelativeTime(createdAt) {
  const parsed = parseTwitterTime(createdAt);
  if (!parsed) {
    return createdAt;
  }
  const seconds = Math.floor((Date.now() - parsed.valueOf()) / 1e3);
  if (seconds < 0) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }
  return `${Math.floor(days / 365)}y ago`;
}
function formatIso8601(createdAt) {
  const parsed = parseTwitterTime(createdAt);
  return parsed ? parsed.toISOString().replace(".000Z", "+00:00") : createdAt;
}
function monthToNumber(month) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = months.indexOf(month);
  return String(index + 1).padStart(2, "0");
}

// src/serialization.ts
function tweetToData(tweet) {
  const data = {
    id: tweet.id,
    text: tweet.text,
    author: {
      id: tweet.author.id,
      name: tweet.author.name,
      screenName: tweet.author.screenName,
      profileImageUrl: tweet.author.profileImageUrl,
      verified: tweet.author.verified
    },
    metrics: {
      likes: tweet.metrics.likes,
      retweets: tweet.metrics.retweets,
      replies: tweet.metrics.replies,
      quotes: tweet.metrics.quotes,
      views: tweet.metrics.views,
      bookmarks: tweet.metrics.bookmarks
    },
    createdAt: tweet.createdAt,
    createdAtLocal: formatLocalTime(tweet.createdAt),
    createdAtISO: formatIso8601(tweet.createdAt),
    media: tweet.media.map((media) => ({
      type: media.type,
      url: media.url,
      width: media.width,
      height: media.height
    })),
    urls: [...tweet.urls],
    isRetweet: tweet.isRetweet,
    retweetedBy: tweet.retweetedBy ?? null,
    lang: tweet.lang,
    score: tweet.score ?? null,
    isSubscriberOnly: tweet.isSubscriberOnly,
    isPromoted: tweet.isPromoted
  };
  if (tweet.articleTitle !== void 0) {
    data.articleTitle = tweet.articleTitle;
  }
  if (tweet.articleText !== void 0) {
    data.articleText = tweet.articleText;
  }
  if (tweet.quotedTweet) {
    data.quotedTweet = {
      id: tweet.quotedTweet.id,
      text: tweet.quotedTweet.text,
      author: {
        screenName: tweet.quotedTweet.author.screenName,
        name: tweet.quotedTweet.author.name
      }
    };
  }
  return data;
}
function tweetsToData(tweets) {
  return [...tweets].map(tweetToData);
}
function tweetToCompactData(tweet) {
  const text = tweet.text.length > 140 ? `${tweet.text.slice(0, 137)}...` : tweet.text;
  const parts = tweet.createdAt.split(" ");
  const time = parts.length >= 4 ? `${parts[1]} ${parts[2]} ${parts[3]?.slice(0, 5)}` : tweet.createdAt;
  return {
    id: tweet.id,
    author: `@${tweet.author.screenName}`,
    text: text.replaceAll("\n", " ").trim(),
    likes: tweet.metrics.likes,
    rts: tweet.metrics.retweets,
    time
  };
}
function userProfileToData(user) {
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
    createdAtISO: formatIso8601(user.createdAt)
  };
}
function usersToData(users) {
  return [...users].map(userProfileToData);
}
function bookmarkFoldersToData(folders) {
  return [...folders].map((folder) => ({ id: folder.id, name: folder.name }));
}

// src/services.ts
function createConfiguredClient(config, auth) {
  const normalized = normalizeConfig(config);
  return createTwitterClient({
    ...auth ? { auth } : {},
    rateLimit: normalized.rateLimit
  });
}
async function feed(client, options = {}) {
  return options.type === "following" ? client.fetchFollowingFeed(options) : client.fetchHomeTimeline(options);
}
async function searchTweets(client, options = {}) {
  const query = buildSearchQuery(options);
  return client.fetchSearch(query, options.count ?? 20, options.product ?? "Top");
}
async function getTweetDetail(client, tweetId, count = 20) {
  return client.fetchTweetDetail(tweetId, count);
}
async function getArticle(client, tweetId) {
  return client.fetchArticle(tweetId);
}
async function getBookmarks(client, count = 50) {
  return client.fetchBookmarks(count);
}
async function getBookmarkFolders(client) {
  return client.fetchBookmarkFolders();
}
async function getBookmarkFolderTimeline(client, folderId, count = 50) {
  return client.fetchBookmarkFolderTimeline(folderId, count);
}
async function getUserProfile(client, screenName) {
  return client.fetchUser(screenName);
}
async function getUserPosts(client, screenName, count = 20) {
  const userId = await client.resolveUserId(screenName);
  return client.fetchUserTweets(userId, count);
}
async function getLikes(client, screenName, count = 20) {
  const userId = await client.resolveUserId(screenName);
  return client.fetchUserLikes(userId, count);
}
async function getFollowers(client, screenName, count = 20) {
  const userId = await client.resolveUserId(screenName);
  return client.fetchFollowers(userId, count);
}
async function getFollowing(client, screenName, count = 20) {
  const userId = await client.resolveUserId(screenName);
  return client.fetchFollowing(userId, count);
}
async function getListTimeline(client, listId, options = {}) {
  return client.fetchListTimeline(listId, options);
}
async function getMe(client) {
  return client.fetchMe();
}
export {
  AuthenticationError,
  BEARER_TOKEN,
  DEFAULT_CONFIG,
  FALLBACK_QUERY_IDS,
  FEATURES,
  InvalidInputError,
  NetworkError,
  NotFoundError,
  QueryIdError,
  QueryIdResolver,
  RateLimitError,
  SCHEMA_VERSION,
  TwitterApiError,
  TwitterClient,
  TwitterError,
  asFloat,
  asInt,
  authFromCookieString,
  bookmarkFoldersToData,
  buildGraphqlUrl,
  buildSearchQuery,
  createConfiguredClient,
  createTwitterClient,
  deepGet,
  deepMerge,
  encodeStructured,
  errorPayload,
  feed,
  filterTweets,
  formatIso8601,
  formatLocalTime,
  formatRelativeTime,
  getAcceptLanguage,
  getArticle,
  getBookmarkFolderTimeline,
  getBookmarkFolders,
  getBookmarks,
  getCookies,
  getFollowers,
  getFollowing,
  getLikes,
  getListTimeline,
  getMe,
  getSecChUa,
  getSecChUaFullVersion,
  getSecChUaFullVersionList,
  getTweetDetail,
  getTwitterClientLanguage,
  getUserAgent,
  getUserPosts,
  getUserProfile,
  loadConfig,
  loadCookieFile,
  loadEnvCookies,
  normalizeConfig,
  parseBookmarkFolders,
  parseIntSafe,
  parseTimelineResponse,
  parseTweetResult,
  parseTwitterTime,
  parseUserListResponse,
  parseUserResult,
  scoreTweet,
  searchTweets,
  successPayload,
  syncChromeVersion,
  tweetToCompactData,
  tweetToData,
  tweetsToData,
  userProfileToData,
  usersToData
};
//# sourceMappingURL=index.js.map