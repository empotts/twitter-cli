export const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

let chromeVersion = "133";

export function syncChromeVersion(target: string): void {
  const match = /(\d+)/.exec(target);
  if (match?.[1]) {
    chromeVersion = match[1];
  }
}

export function getUserAgent(): string {
  const platform = process.platform === "darwin"
    ? "Macintosh; Intel Mac OS X 10_15_7"
    : process.platform === "win32"
      ? "Windows NT 10.0; Win64; x64"
      : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
}

export function getSecChUa(): string {
  return `"Chromium";v="${chromeVersion}", "Not(A:Brand";v="99", "Google Chrome";v="${chromeVersion}"`;
}

export function getSecChUaFullVersion(): string {
  return `"${chromeVersion}.0.0.0"`;
}

export function getSecChUaFullVersionList(): string {
  return `"Google Chrome";v="${chromeVersion}.0.0.0", "Chromium";v="${chromeVersion}.0.0.0", "Not.A/Brand";v="99.0.0.0"`;
}

export function getAcceptLanguage(): string {
  const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en_US.UTF-8";
  const tag = raw.split(".", 1)[0]?.replaceAll("_", "-") || "en-US";
  const language = tag.split("-", 1)[0] || "en";
  return `${tag},${language};q=0.9,en;q=0.8`;
}

export function getTwitterClientLanguage(): string {
  const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en_US.UTF-8";
  return raw.split(".", 1)[0]?.split("_", 1)[0]?.split("-", 1)[0] || "en";
}
