import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { after, NextResponse } from "next/server";

export const redis = Redis.fromEnv();

// ephemeralCache is on by default: an IP that's already blocked is rejected in memory, no Redis call.
export const limits = {
  create: new Ratelimit({ redis, prefix: "rl:create", limiter: Ratelimit.slidingWindow(10, "1 h") }),
  reveal: new Ratelimit({ redis, prefix: "rl:reveal", limiter: Ratelimit.slidingWindow(30, "1 h") }),
  // Protects the free quota from many-IP abuse. Reveals are never globally capped.
  global: new Ratelimit({ redis, prefix: "rl:global", limiter: Ratelimit.fixedWindow(500, "1 d") }),
};

// Vercel overwrites x-forwarded-for with the real client IP, so the first hop is trustworthy there.
export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

// Never log secret IDs or bodies.
export const log = (evt: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ evt, ...extra }));

export type StatField = "created" | "revealed" | "not_found" | "rate_limited" | "global_cap_hit";

// Daily counters, read them in the Upstash data browser. Runs after the response is sent.
export function bump(field: StatField) {
  after(async () => {
    const key = `stats:${new Date().toISOString().slice(0, 10)}`;
    try {
      await redis.pipeline().hincrby(key, field, 1).expire(key, 30 * 86400).exec();
    } catch (err) {
      log("stats_error", { message: String(err) });
    }
  });
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function tooMany(reset: number) {
  bump("rate_limited");
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return json({ error: "rate_limited", retryAfter }, 429, { "Retry-After": String(retryAfter) });
}
