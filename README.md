# Secrets

One-time secret sharing. Text is encrypted in the browser (AES-256-GCM), the key lives only in the URL fragment, and the server stores ciphertext in Upstash Redis until it's revealed once (`GETDEL`) or expires.

Live at **https://secrets.harshsandhu.com**.

## Setup

1. Create a free Upstash Redis database (us-east-1, next to Vercel's default region).
2. Copy `.env.example` to `.env.local` and fill in its REST URL and token.
3. `pnpm install && pnpm dev`

On Vercel, set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for all environments. Upstash's free plan allows one database, so dev, previews and production share it: dev traffic shows up in the stats and rate-limit counters.

`@upstash/ratelimit` uses an Upstash-only Lua flag, so a plain local Redis won't work. Use a real Upstash database.

## Limits

- 10 KB plaintext, expiry 1h / 1d / 7d
- Per IP: 10 creates/hour, 30 reveals/hour. Global: 500 creates/day.
- Daily counters live in the `stats:YYYY-MM-DD` hash (30-day TTL). Read them in the Upstash data browser.

## Tests

`pnpm test`
