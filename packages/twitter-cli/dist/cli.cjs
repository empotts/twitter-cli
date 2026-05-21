#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/bin.ts
var import_promises4 = require("fs/promises");
var import_node_path2 = require("path");
var import_commander = require("commander");

// ../twitter-core/src/auth.ts
var import_node_fs = require("fs");

// ../twitter-core/src/errors.ts
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

// ../twitter-core/src/auth.ts
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
  const raw = (0, import_node_fs.readFileSync)(path, "utf-8").trim();
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

// ../twitter-core/src/client.ts
var import_promises2 = require("timers/promises");

// ../twitter-core/src/config.ts
var import_promises = require("fs/promises");
var import_yaml = __toESM(require("yaml"), 1);
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
    const raw = await (0, import_promises.readFile)(configPath, "utf-8");
    const parsed = import_yaml.default.parse(raw);
    return normalizeConfig(isObject2(parsed) ? parsed : {});
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ../twitter-core/src/graphql.ts
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

// ../twitter-core/src/parser.ts
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

// ../twitter-core/src/constants.ts
var BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
var chromeVersion = "133";
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

// ../twitter-core/src/client.ts
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
        await (0, import_promises2.setTimeout)(this.requestDelay * 1e3);
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
        await (0, import_promises2.setTimeout)(this.requestDelay * 1e3);
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
        await (0, import_promises2.setTimeout)(this.retryBaseDelay * 2 ** attempt * 1e3);
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

// ../twitter-core/src/filter.ts
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

// ../twitter-core/src/output.ts
var import_yaml2 = __toESM(require("yaml"), 1);
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
  return import_yaml2.default.stringify(data);
}

// ../twitter-core/src/search.ts
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

// ../twitter-core/src/time.ts
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

// ../twitter-core/src/serialization.ts
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

// ../twitter-core/src/services.ts
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

// src/formatters.ts
var import_cli_table3 = __toESM(require("cli-table3"), 1);
var import_chalk = __toESM(require("chalk"), 1);
function formatNumber(value) {
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return String(value);
}
function renderTweetTable(tweets, title = `Twitter \u2014 ${tweets.length} tweets`, fullText = false) {
  const table = new import_cli_table3.default({
    head: [title, "Author", "Tweet", "Stats", "Score"],
    style: { head: ["cyan"] },
    wordWrap: true,
    colWidths: [6, 20, 72, 24, 8]
  });
  tweets.forEach((tweet, index) => {
    let text = tweet.text.replaceAll("\n", " ").trim();
    if (!fullText && text.length > 120) {
      text = `${text.slice(0, 117)}...`;
    }
    if (tweet.media.length) {
      text += ` ${tweet.media.map((media) => media.type === "photo" ? "\u{1F4F7}" : media.type === "video" ? "\u{1F4F9}" : "\u{1F39E}").join(" ")}`;
    }
    if (tweet.quotedTweet) {
      text += `
\u250C @${tweet.quotedTweet.author.screenName}: ${tweet.quotedTweet.text.replaceAll("\n", " ")}`;
    }
    text += `
\u{1F517} x.com/${tweet.author.screenName}/status/${tweet.id}`;
    const stats = `\u2764\uFE0F ${formatNumber(tweet.metrics.likes)} \u{1F504} ${formatNumber(tweet.metrics.retweets)}
\u{1F4AC} ${formatNumber(tweet.metrics.replies)} \u{1F441} ${formatNumber(tweet.metrics.views)}
\u{1F550} ${formatRelativeTime(tweet.createdAt)}`;
    table.push([
      String(index + 1),
      `@${tweet.author.screenName}${tweet.author.verified ? " \u2713" : ""}`,
      text,
      stats,
      tweet.score?.toFixed(1) ?? "-"
    ]);
  });
  return table.toString();
}
function renderTweetDetail(tweets, fullText = false) {
  if (!tweets.length) {
    return "No tweet found.";
  }
  const tweet = tweets[0];
  const replies = tweets.slice(1);
  const blocks = [
    `${import_chalk.default.cyan(`@${tweet.author.screenName}`)}${tweet.author.verified ? " \u2713" : ""} (${tweet.author.name})`,
    tweet.text,
    "",
    `\u2764\uFE0F ${formatNumber(tweet.metrics.likes)}  \u{1F504} ${formatNumber(tweet.metrics.retweets)}  \u{1F4AC} ${formatNumber(tweet.metrics.replies)}  \u{1F516} ${formatNumber(tweet.metrics.bookmarks)}  \u{1F441} ${formatNumber(tweet.metrics.views)}`,
    `\u{1F550} ${formatLocalTime(tweet.createdAt)} (${formatRelativeTime(tweet.createdAt)})`,
    `\u{1F517} https://x.com/${tweet.author.screenName}/status/${tweet.id}`
  ];
  if (replies.length) {
    blocks.push("", renderTweetTable(replies, `Replies \u2014 ${replies.length} tweets`, fullText));
  }
  return blocks.join("\n");
}
function renderArticleMarkdown(tweet) {
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
    `- Views: ${formatNumber(tweet.metrics.views)}`
  ];
  if (tweet.articleText) {
    lines.push("", tweet.articleText.trim());
  }
  return `${lines.join("\n").trim()}
`;
}
function renderUserProfile(user) {
  const lines = [
    `${import_chalk.default.cyan(`@${user.screenName}`)}${user.verified ? " \u2713" : ""} (${user.name})`
  ];
  if (user.bio) {
    lines.push(user.bio);
  }
  lines.push(
    `Followers: ${formatNumber(user.followersCount)}  Following: ${formatNumber(user.followingCount)}`,
    `Tweets: ${formatNumber(user.tweetsCount)}  Likes: ${formatNumber(user.likesCount)}`
  );
  if (user.location) {
    lines.push(`Location: ${user.location}`);
  }
  if (user.url) {
    lines.push(`URL: ${user.url}`);
  }
  return lines.join("\n");
}
function renderUsersTable(users, title = `Users \u2014 ${users.length}`) {
  const table = new import_cli_table3.default({
    head: [title, "Name", "Bio", "Stats"],
    style: { head: ["cyan"] },
    wordWrap: true,
    colWidths: [20, 24, 60, 24]
  });
  users.forEach((user) => {
    table.push([
      `@${user.screenName}${user.verified ? " \u2713" : ""}`,
      user.name,
      user.bio || "-",
      `Followers ${formatNumber(user.followersCount)}
Following ${formatNumber(user.followingCount)}`
    ]);
  });
  return table.toString();
}

// src/output.ts
function defaultStructuredFormat({
  asJson,
  asYaml,
  isStdoutTty,
  outputEnv = process.env.OUTPUT ?? "auto"
}) {
  if (asJson && asYaml) {
    throw new Error("Use only one of --json or --yaml.");
  }
  if (asYaml) {
    return "yaml";
  }
  if (asJson) {
    return "json";
  }
  const normalized = outputEnv.trim().toLowerCase();
  if (normalized === "yaml") {
    return "yaml";
  }
  if (normalized === "json") {
    return "json";
  }
  if (normalized === "rich") {
    return void 0;
  }
  return isStdoutTty ? void 0 : "yaml";
}
function emitSuccess(data, mode, pagination) {
  if (!mode) {
    return void 0;
  }
  return encodeStructured(successPayload(data, pagination), mode);
}
function emitError(code, message, mode, details) {
  if (!mode) {
    return void 0;
  }
  return encodeStructured(errorPayload(code, message, details), mode);
}

// src/cache.ts
var import_promises3 = require("fs/promises");
var import_node_os = require("os");
var import_node_path = require("path");
var CACHE_DIR = (0, import_node_path.join)((0, import_node_os.homedir)(), ".twitter-cli");
var CACHE_FILE = (0, import_node_path.join)(CACHE_DIR, "last_results.json");
var TTL_MS = 60 * 60 * 1e3;
async function saveTweetCache(tweets) {
  const entries = tweets.filter((tweet) => tweet.id).map((tweet, index) => ({
    index: index + 1,
    id: tweet.id,
    author: tweet.author.screenName,
    text: tweet.text.slice(0, 80)
  }));
  await (0, import_promises3.mkdir)(CACHE_DIR, { recursive: true });
  await (0, import_promises3.writeFile)(
    CACHE_FILE,
    JSON.stringify({ created_at: Date.now(), tweets: entries }, null, 2),
    "utf-8"
  );
}
async function resolveCachedTweet(index) {
  try {
    const raw = await (0, import_promises3.readFile)(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.created_at || !Array.isArray(parsed.tweets) || Date.now() - parsed.created_at > TTL_MS) {
      return { cacheSize: 0 };
    }
    const match = parsed.tweets.find((entry) => entry.index === index);
    return match?.id ? { tweetId: match.id, cacheSize: parsed.tweets.length } : { cacheSize: parsed.tweets.length };
  } catch {
    return { cacheSize: 0 };
  }
}

// src/bin.ts
async function run(argv = process.argv) {
  const program = new import_commander.Command().name("twitter-ts").option("-c, --compact", "Compact output (minimal fields, LLM-friendly).").option("-v, --verbose", "Enable verbose logging.").showHelpAfterError();
  addReadCommands(program);
  addAuthCommands(program);
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    const mode = defaultStructuredFormat({
      asJson: false,
      asYaml: false,
      isStdoutTty: process.stdout.isTTY ?? false
    });
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error && "errorCode" in error ? String(error.errorCode ?? "api_error") : "api_error";
    const structured = emitError(code, message, mode);
    if (structured) {
      process.stdout.write(structured);
    } else {
      process.stderr.write(`${message}
`);
    }
    return 1;
  }
}
function addAuthCommands(program) {
  const auth = program.command("auth").description("Inspect and prepare TypeScript auth cookie configuration.");
  auth.command("status").description("Show whether cookies are configured without making a network request.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (options) => {
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
  auth.command("import <file>").description("Validate a cookie export and emit configuration for this CLI.").option("--write-env <file>", "Write TWITTER_COOKIE_STRING to an env file.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (file, options) => {
    const authConfig = loadCookieFile((0, import_node_path2.resolve)(file));
    const envLine = `TWITTER_COOKIE_STRING=${shellQuote(authConfig.cookieString ?? `auth_token=${authConfig.authToken}; ct0=${authConfig.ct0}`)}`;
    if (options.writeEnv) {
      await (0, import_promises4.writeFile)((0, import_node_path2.resolve)(options.writeEnv), `${envLine}
`, "utf-8");
    }
    const data = {
      ...authStatusData(authConfig),
      env: envLine,
      writeEnv: options.writeEnv ? (0, import_node_path2.resolve)(options.writeEnv) : void 0
    };
    const mode = resolveMode(options);
    const structured = emitSuccess(data, mode);
    if (structured) {
      process.stdout.write(structured);
    } else {
      const lines = [
        formatAuthStatus(data),
        "",
        options.writeEnv ? `Wrote ${(0, import_node_path2.resolve)(options.writeEnv)}` : `Run this in your shell:
${envLine}`
      ];
      process.stdout.write(lines.join("\n") + "\n");
    }
  });
  auth.command("guide").description("Print the shortest supported cookie setup path.").action(() => {
    process.stdout.write(
      [
        "Fastest TypeScript auth setup:",
        "",
        "1. Log in to x.com in your browser.",
        "2. Export x.com cookies as a Netscape cookies.txt file using a browser cookie export extension.",
        "3. Run: twitter-ts auth import ./cookies.txt --write-env .env.twitter",
        "4. Load it before using the CLI: set -a; source .env.twitter; set +a",
        "",
        "You can also set TWITTER_COOKIE_STRING directly if you already have a full Cookie header."
      ].join("\n") + "\n"
    );
  });
}
function addReadCommands(program) {
  program.command("feed").option("-t, --type <type>", "Feed type: for-you or following.", "for-you").option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--cursor <cursor>", "Pagination cursor for continuing a previous feed request.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-i, --input <file>", "Load tweets from JSON file.").option("-o, --output <file>", "Save filtered tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").option("--include-promoted", "Include promoted tweets when the timeline endpoint exposes them.").action(async (options, command) => {
    const config = await loadLocalConfig();
    const tweets = options.input ? await loadTweetsFromFile(options.input) : void 0;
    const mode = resolveMode(options);
    const compact = command.parent?.opts().compact ?? false;
    const client = tweets ? void 0 : createConfiguredClient(config);
    const page = tweets ? { items: tweets } : await feed(client, {
      type: options.type === "following" ? "following" : "for-you",
      count: options.max ?? config.fetch.count,
      cursor: options.cursor,
      includePromoted: Boolean(options.includePromoted)
    });
    await outputTweets(page.items, {
      mode,
      compact,
      filter: Boolean(options.filter),
      fullText: Boolean(options.fullText),
      ...options.output ? { outputFile: options.output } : {},
      config,
      title: options.type === "following" ? "Following" : "Twitter",
      ...page.nextCursor ? { pagination: { nextCursor: page.nextCursor } } : {}
    });
  });
  program.command("favorites").option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (options, command) => {
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
      title: "Bookmarks"
    });
  });
  const bookmarks = program.command("bookmarks").option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (options, command) => {
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
      title: "Bookmarks"
    });
  });
  bookmarks.command("folders [folderId]").option("-n, --max <count>", "Max tweets to fetch from folder.", parseInt).option("--since <date>", "Only show tweets after this date (YYYY-MM-DD).").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (folderId, options, command) => {
    const config = await loadLocalConfig();
    const mode = resolveMode(options);
    const compact = command.parent?.parent?.opts().compact ?? false;
    const client = createConfiguredClient(config);
    if (!folderId) {
      const folders = await getBookmarkFolders(client);
      const structured = emitSuccess(
        folders.map((folder) => ({ id: folder.id, name: folder.name })),
        mode
      );
      if (structured) {
        process.stdout.write(structured);
      } else {
        process.stdout.write(
          folders.map((folder) => `${folder.id}	${folder.name}`).join("\n") + "\n"
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
      title: `Bookmark Folder ${folderId}`
    });
  });
  program.command("user <screenName>").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (screenName, options) => {
    const client = createConfiguredClient(await loadLocalConfig());
    const user = await getUserProfile(client, screenName);
    await outputUser(user, resolveMode(options));
  });
  program.command("user-posts <screenName>").option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--full-text", "Show full tweet text in table output.").action(async (screenName, options, command) => {
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
      title: `@${screenName}`
    });
  });
  program.command("search [query]").option("-t, --type <product>", "Search tab: Top, Latest, Photos, Videos.", "Top").option("--from <screenName>", "Only tweets from this user.").option("--to <screenName>", "Only tweets directed at this user.").option("--lang <lang>", "Filter by language.").option("--since <date>", "Tweets since date (YYYY-MM-DD).").option("--until <date>", "Tweets until date (YYYY-MM-DD).").option("--has <type...>", "Required content types.").option("--exclude <type...>", "Excluded content types.").option("--min-likes <count>", "Minimum number of likes.", parseInt).option("--min-retweets <count>", "Minimum number of retweets.", parseInt).option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (query, options, command) => {
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
      count: options.max ?? config.fetch.count
    });
    await outputTweets(tweets, {
      mode: resolveMode(options),
      compact: command.parent?.opts().compact ?? false,
      filter: Boolean(options.filter),
      fullText: Boolean(options.fullText),
      outputFile: options.output,
      config,
      title: `Search: ${query ?? ""}`.trim()
    });
  });
  program.command("likes <screenName>").option("-n, --max <count>", "Max number of tweets to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("-o, --output <file>", "Save tweets to JSON file.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (screenName, options, command) => {
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
      title: `Likes: @${screenName}`
    });
  });
  program.command("tweet <tweetId>").option("-n, --max <count>", "Max replies to fetch.", parseInt).option("--full-text", "Show full reply text in table output.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (tweetId, options, command) => {
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
  program.command("show <index>").option("-n, --max <count>", "Max replies to fetch.", parseInt).option("--full-text", "Show full reply text in table output.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (index, options, command) => {
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
  program.command("article <tweetId>").option("--markdown", "Output article as Markdown.").option("-o, --output <file>", "Save article Markdown to file.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (tweetId, options) => {
    const client = createConfiguredClient(await loadLocalConfig());
    const article = await getArticle(client, normalizeTweetId(tweetId));
    if (options.markdown) {
      const markdown = renderArticleMarkdown(article);
      if (options.output) {
        await (0, import_promises4.writeFile)((0, import_node_path2.resolve)(options.output), markdown, "utf-8");
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
  program.command("list <listId>").option("-n, --max <count>", "Max tweets to fetch.", parseInt).option("--cursor <cursor>", "Pagination cursor for continuing a previous list request.").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").option("--filter", "Enable score-based filtering.").option("--full-text", "Show full tweet text in table output.").action(async (listId, options, command) => {
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
      ...page.nextCursor ? { pagination: { nextCursor: page.nextCursor } } : {}
    });
  });
  program.command("followers <screenName>").option("-n, --max <count>", "Max users to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (screenName, options) => {
    const config = await loadLocalConfig();
    const client = createConfiguredClient(config);
    const users = await getFollowers(client, screenName, options.max ?? config.fetch.count);
    await outputUsers(users, resolveMode(options));
  });
  program.command("following <screenName>").option("-n, --max <count>", "Max users to fetch.", parseInt).option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (screenName, options) => {
    const config = await loadLocalConfig();
    const client = createConfiguredClient(config);
    const users = await getFollowing(client, screenName, options.max ?? config.fetch.count);
    await outputUsers(users, resolveMode(options));
  });
  program.command("whoami").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (options) => {
    const client = createConfiguredClient(await loadLocalConfig());
    await outputUser(await getMe(client), resolveMode(options));
  });
  program.command("status").option("--json", "Output as JSON.").option("--yaml", "Output as YAML.").action(async (options) => {
    const client = createConfiguredClient(await loadLocalConfig());
    const user = await getMe(client);
    const data = {
      authenticated: true,
      user: userProfileToData(user)
    };
    const mode = resolveMode(options);
    const structured = emitSuccess(data, mode);
    process.stdout.write(structured ?? `${user.screenName}
`);
  });
}
function authStatusData(authConfig) {
  return {
    authenticated: true,
    authToken: redactSecret(authConfig.authToken),
    ct0: redactSecret(authConfig.ct0),
    hasCookieString: Boolean(authConfig.cookieString),
    cookieNames: authConfig.cookieString ? cookieNames(authConfig.cookieString) : ["auth_token", "ct0"]
  };
}
function formatAuthStatus(data) {
  return [
    "Twitter auth is configured.",
    `auth_token: ${data.authToken}`,
    `ct0: ${data.ct0}`,
    `full cookie string: ${data.hasCookieString ? "yes" : "no"}`,
    `cookie names: ${data.cookieNames.join(", ")}`
  ].join("\n");
}
function cookieNames(cookieString) {
  return cookieString.split(";").map((part) => part.trim().split("=", 1)[0] ?? "").filter((name) => Boolean(name)).sort();
}
function redactSecret(value) {
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
async function loadLocalConfig() {
  const candidate = (0, import_node_path2.resolve)(process.cwd(), "config.yaml");
  return loadConfig(candidate);
}
async function loadTweetsFromFile(filePath) {
  const raw = await (0, import_promises4.readFile)((0, import_node_path2.resolve)(filePath), "utf-8");
  const parsed = JSON.parse(raw);
  const payload = isStructuredTweetEnvelope(parsed) ? parsed.data : parsed;
  if (!Array.isArray(payload)) {
    throw new Error(`Tweet JSON payload must be a list: ${(0, import_node_path2.basename)(filePath)}`);
  }
  return payload.map(tweetFromInput);
}
function tweetFromInput(value) {
  const data = value;
  return compactOptional2({
    id: String(data.id ?? ""),
    text: String(data.text ?? ""),
    author: {
      id: String(data.author?.id ?? ""),
      name: String(data.author?.name ?? ""),
      screenName: String(data.author?.screenName ?? ""),
      profileImageUrl: String(data.author?.profileImageUrl ?? ""),
      verified: Boolean(data.author?.verified)
    },
    metrics: {
      likes: Number(data.metrics?.likes ?? 0),
      retweets: Number(data.metrics?.retweets ?? 0),
      replies: Number(data.metrics?.replies ?? 0),
      quotes: Number(data.metrics?.quotes ?? 0),
      views: Number(data.metrics?.views ?? 0),
      bookmarks: Number(data.metrics?.bookmarks ?? 0)
    },
    createdAt: String(data.createdAt ?? ""),
    media: Array.isArray(data.media) ? data.media.map((media) => ({
      type: String(media.type ?? ""),
      url: String(media.url ?? ""),
      width: typeof media.width === "number" ? media.width : void 0,
      height: typeof media.height === "number" ? media.height : void 0
    })) : [],
    urls: Array.isArray(data.urls) ? data.urls.map(String) : [],
    isRetweet: Boolean(data.isRetweet),
    lang: String(data.lang ?? ""),
    retweetedBy: data.retweetedBy ? String(data.retweetedBy) : void 0,
    quotedTweet: data.quotedTweet ? {
      id: String(data.quotedTweet.id ?? ""),
      text: String(data.quotedTweet.text ?? ""),
      author: {
        id: "",
        name: String(data.quotedTweet.author?.name ?? ""),
        screenName: String(data.quotedTweet.author?.screenName ?? ""),
        profileImageUrl: "",
        verified: false
      }
    } : void 0,
    score: typeof data.score === "number" ? data.score : void 0,
    articleTitle: data.articleTitle ? String(data.articleTitle) : void 0,
    articleText: data.articleText ? String(data.articleText) : void 0,
    isSubscriberOnly: Boolean(data.isSubscriberOnly),
    isPromoted: Boolean(data.isPromoted)
  });
}
async function outputTweets(tweets, options) {
  const filtered = options.filter ? filterTweets(tweets, options.config.filter) : tweets;
  if (options.outputFile) {
    await (0, import_promises4.writeFile)((0, import_node_path2.resolve)(options.outputFile), JSON.stringify(tweetsToData(filtered), null, 2), "utf-8");
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
  process.stdout.write(renderTweetTable(filtered, `${options.title} \u2014 ${filtered.length} tweets`, options.fullText) + "\n");
}
async function outputUsers(users, mode) {
  const structured = emitSuccess(usersToData(users), mode);
  if (structured) {
    process.stdout.write(structured);
  } else {
    process.stdout.write(renderUsersTable(users) + "\n");
  }
}
async function outputUser(user, mode) {
  const structured = emitSuccess(userProfileToData(user), mode);
  if (structured) {
    process.stdout.write(structured);
  } else {
    process.stdout.write(renderUserProfile(user) + "\n");
  }
}
function resolveMode(options) {
  return defaultStructuredFormat({
    asJson: Boolean(options.json),
    asYaml: Boolean(options.yaml),
    isStdoutTty: process.stdout.isTTY ?? false
  });
}
function normalizeTweetId(value) {
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
function filterSince(tweets, since) {
  if (!since) {
    return tweets;
  }
  const threshold = /* @__PURE__ */ new Date(`${since}T00:00:00Z`);
  if (Number.isNaN(threshold.valueOf())) {
    throw new Error("Invalid --since date format. Use YYYY-MM-DD.");
  }
  return tweets.filter((tweet) => {
    const created = new Date(tweet.createdAt);
    return Number.isNaN(created.valueOf()) ? true : created >= threshold;
  });
}
function isStructuredTweetEnvelope(value) {
  return typeof value === "object" && value !== null && value.ok === true && Array.isArray(value.data);
}
function compactOptional2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}

// src/cli.ts
run().then((code) => {
  process.exitCode = code;
});
//# sourceMappingURL=cli.cjs.map