import { parseCreateBody, randomB64url } from "@/lib/secret";
import { bump, clientIp, json, limits, log, redis, tooMany } from "@/lib/server";
import { errorMessage } from "@/lib/utils";

export async function POST(req: Request) {
  const parsed = parseCreateBody(await req.text());
  if (!parsed) return json({ error: "invalid" }, 400);

  try {
    const ip = clientIp(req);
    const perIp = await limits.create.limit(ip);
    if (!perIp.success) {
      log("rate_limited", { route: "create", ip });
      return tooMany(perIp.reset);
    }
    const global = await limits.global.limit("create");
    if (!global.success) {
      log("global_cap_hit");
      bump("global_cap_hit");
      return json({ error: "busy" }, 503);
    }

    const id = randomB64url(16);
    // NX: a 128-bit collision is practically impossible, but never overwrite.
    const ok = await redis.set(`s:${id}`, parsed.payload, { ex: parsed.ttl, nx: true });
    if (!ok) return json({ error: "busy" }, 503);

    bump("created");
    return json({ id }, 201);
  } catch (err) {
    log("redis_error", { route: "create", message: errorMessage(err) });
    return json({ error: "busy" }, 503);
  }
}
