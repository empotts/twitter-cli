---
name: twitter-cli-ts
description: Use twitter-cli-ts for Twitter/X operations through the `twitter-ts` CLI or the TypeScript package API.
author: empotts
version: "1.0.0"
tags:
  - twitter
  - x
  - typescript
  - node
  - cli
---

# twitter-cli-ts

TypeScript-first Twitter/X toolkit with:
- CLI binary: `twitter-ts`
- Package API: `twitter-cli-ts` and `@twitter-cli-ts/core`

Repository: `https://github.com/empotts/twitter-cli-ts`

## Install

```bash
pnpm add github:empotts/twitter-cli-ts
# or
npm install github:empotts/twitter-cli-ts
```

## Authentication (required before API calls)

Auth priority:
1. `TWITTER_COOKIE_STRING`
2. `TWITTER_AUTH_TOKEN` + `TWITTER_CT0`
3. `TWITTER_COOKIE_FILE` (JSON, raw Cookie header, or Netscape cookie export)

Fast path:

```bash
twitter-ts auth guide
twitter-ts auth import ./cookies.txt --write-env .env.twitter
set -a; source .env.twitter; set +a
twitter-ts auth status
```

## CLI reference

Read:

```bash
twitter-ts feed --json
twitter-ts feed --type following --count 30 --yaml
twitter-ts search "typescript" --type Latest --json
twitter-ts user jack --yaml
twitter-ts tweet <tweet-id> --json
twitter-ts bookmarks --count 20 --json
twitter-ts followers jack --count 50 --json
twitter-ts following jack --count 50 --json
twitter-ts article <tweet-id> --markdown
```

Write:

```bash
twitter-ts post "hello from twitter-cli-ts"
twitter-ts reply <tweet-id> "nice thread"
twitter-ts quote <tweet-id> "worth reading"
twitter-ts bookmark <tweet-id>
twitter-ts unbookmark <tweet-id>
twitter-ts like <tweet-id>
twitter-ts unlike <tweet-id>
twitter-ts retweet <tweet-id>
twitter-ts unretweet <tweet-id>
twitter-ts follow <username>
twitter-ts unfollow <username>
```

## Structured output

Use `--json` or `--yaml` for machine-readable output. Envelope shape is documented in [SCHEMA.md](./SCHEMA.md).

## Package usage

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
const profile = await getUserProfile(client, "jack");
```
