import { InvalidInputError } from "./errors";

const LANG_PATTERN = /^[A-Za-z][A-Za-z-]{1,14}$/;

export function buildSearchQuery({
  query = "",
  fromUser,
  toUser,
  lang,
  since,
  until,
  has,
  exclude,
  minLikes,
  minRetweets,
}: {
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
} = {}): string {
  const parts: string[] = [];
  const trimmedQuery = query.trim();
  const normalizedFrom = normalizeHandle(fromUser);
  const normalizedTo = normalizeHandle(toUser);
  const normalizedLang = normalizeLang(lang);
  const normalizedSince = normalizeDate("--since", since);
  const normalizedUntil = normalizeDate("--until", until);

  if (minLikes !== undefined && minLikes < 0) {
    throw new InvalidInputError("--min-likes must be greater than or equal to 0");
  }
  if (minRetweets !== undefined && minRetweets < 0) {
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
  if (minLikes !== undefined) {
    parts.push(`min_faves:${minLikes}`);
  }
  if (minRetweets !== undefined) {
    parts.push(`min_retweets:${minRetweets}`);
  }
  return parts.join(" ");
}

function normalizeHandle(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().replace(/^@/, "");
  return normalized || undefined;
}

function normalizeLang(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!LANG_PATTERN.test(normalized)) {
    throw new InvalidInputError("--lang must be an ISO language code like en or zh-cn");
  }
  return normalized;
}

function normalizeDate(flagName: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new InvalidInputError(`${flagName} must be in YYYY-MM-DD format`);
  }
  return normalized;
}
