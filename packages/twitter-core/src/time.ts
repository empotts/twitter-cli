const TWITTER_TIME_FORMAT = /^(?<dow>\w{3}) (?<month>\w{3}) (?<day>\d{2}) (?<time>\d{2}:\d{2}:\d{2}) (?<offset>[+-]\d{4}) (?<year>\d{4})$/;

export function parseTwitterTime(createdAt: string): Date | undefined {
  if (!createdAt) {
    return undefined;
  }
  const match = TWITTER_TIME_FORMAT.exec(createdAt);
  if (!match?.groups) {
    return undefined;
  }
  const groups = match.groups as Record<string, string | undefined>;
  const month = groups.month;
  const day = groups.day;
  const time = groups.time;
  const offset = groups.offset;
  const year = groups.year;
  if (!month || !day || !time || !offset || !year) {
    return undefined;
  }
  const iso = `${year}-${monthToNumber(month)}-${day}T${time}${offset.slice(0, 3)}:${offset.slice(3)}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}

export function formatLocalTime(createdAt: string): string {
  const parsed = parseTwitterTime(createdAt);
  if (!parsed) {
    return createdAt;
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(parsed).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatRelativeTime(createdAt: string): string {
  const parsed = parseTwitterTime(createdAt);
  if (!parsed) {
    return createdAt;
  }
  const seconds = Math.floor((Date.now() - parsed.valueOf()) / 1000);
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

export function formatIso8601(createdAt: string): string {
  const parsed = parseTwitterTime(createdAt);
  return parsed ? parsed.toISOString().replace(".000Z", "+00:00") : createdAt;
}

function monthToNumber(month: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = months.indexOf(month);
  return String(index + 1).padStart(2, "0");
}
