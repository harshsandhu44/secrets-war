import { ID_RE, type Payload } from "@/lib/secret";
import { bump, clientIp, json, limits, log, redis, tooMany } from "@/lib/server";
import { errorMessage } from "@/lib/utils";

// POST only: link scanners follow GETs, they don't send POSTs from button clicks.
export async function POST(req: Request, ctx: RouteContext<"/api/secrets/[id]/reveal">) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return json({ error: "gone" }, 404);

  try {
    const ip = clientIp(req);
    const rl = await limits.reveal.limit(ip);
    if (!rl.success) {
      log("rate_limited", { route: "reveal", ip });
      return tooMany(rl.reset);
    }

    // Atomic read-and-delete: exactly one caller ever gets the ciphertext.
    const payload = await redis.getdel<Payload>(`s:${id}`);
    if (!payload) {
      bump("not_found");
      return json({ error: "gone" }, 404);
    }

    bump("revealed");
    return json({ iv: payload.iv, ct: payload.ct, v: payload.v });
  } catch (err) {
    log("redis_error", { route: "reveal", message: errorMessage(err) });
    return json({ error: "busy" }, 503);
  }
}
