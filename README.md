# twitter-cli-ts

TypeScript-first Twitter/X toolkit with:

- `twitter-ts` CLI for timeline/search/profile/bookmark/list workflows
- importable package API for app code (`twitter-cli-ts` root export)

## Install

From GitHub:

```bash
npm install github:empotts/twitter-cli-ts
```

or

```bash
pnpm add github:empotts/twitter-cli-ts
```

## Use as a package

```ts
import {
  createConfiguredClient,
  feed,
  searchTweets,
  getUserProfile,
} from "twitter-cli-ts";

const client = createConfiguredClient();
const timeline = await feed(client, { type: "for-you", count: 20 });
const results = await searchTweets(client, { query: "typescript", product: "Latest" });
const user = await getUserProfile(client, "jack");
```

## Use as a CLI

```bash
twitter-ts feed --json
twitter-ts search "typescript" --type Latest --json
twitter-ts user jack --yaml
twitter-ts article <tweet-id> --markdown
```

## Authentication

Auth priority:

1. `TWITTER_COOKIE_STRING`
2. `TWITTER_AUTH_TOKEN` + `TWITTER_CT0`
3. `TWITTER_COOKIE_FILE` (JSON, raw Cookie header, or Netscape cookies export)

Fast path:

```bash
twitter-ts auth guide
twitter-ts auth import ./cookies.txt --write-env .env.twitter
set -a; source .env.twitter; set +a
twitter-ts auth status
```

## Development

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

## Output schema

Structured command output follows [SCHEMA.md](/Users/ethanpotts/Documents/GitHub/twitter-cli/SCHEMA.md).

## License

Apache-2.0
