// Shared by browser and server. The key never leaves the browser; the server only sees { v, iv, ct }.

export const MAX_PLAINTEXT_BYTES = 10 * 1024;
export const MAX_BODY_BYTES = 16 * 1024;
// AES-GCM adds a 16-byte tag; base64url is 4 chars per 3 bytes.
const MAX_CT_CHARS = Math.ceil(((MAX_PLAINTEXT_BYTES + 16) * 4) / 3);

export const TTLS = { "1h": 3600, "1d": 86400, "7d": 604800 } as const;
export type Ttl = keyof typeof TTLS;

export const ID_RE = /^[A-Za-z0-9_-]{22}$/; // 16 bytes
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes
const IV_RE = /^[A-Za-z0-9_-]{16}$/; // 12 bytes
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export type Payload = { v: 1; iv: string; ct: string };

export function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const randomB64url = (n: number) => toB64url(crypto.getRandomValues(new Uint8Array(n)));

export const byteLength = (text: string) => new TextEncoder().encode(text).length;

function importKey(raw: Uint8Array<ArrayBuffer>, usage: KeyUsage) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

export async function encrypt(text: string): Promise<{ key: string; payload: Payload }> {
  const data = new TextEncoder().encode(text);
  if (data.length === 0 || data.length > MAX_PLAINTEXT_BYTES) throw new Error("size");
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(raw, "encrypt"), data);
  return { key: toB64url(raw), payload: { v: 1, iv: toB64url(iv), ct: toB64url(new Uint8Array(ct)) } };
}

// Throws on a wrong key or tampered ciphertext (GCM auth tag check).
export async function decrypt(payload: Payload, key: string): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(payload.iv) },
    await importKey(fromB64url(key), "decrypt"),
    fromB64url(payload.ct),
  );
  return new TextDecoder().decode(pt);
}

// Server-side validation of the create request. Returns null for anything malformed.
export function parseCreateBody(raw: string): { payload: Payload; ttl: number } | null {
  if (raw.length > MAX_BODY_BYTES) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const { v, iv, ct, ttl } = body as Record<string, unknown>;
  if (v !== 1 || typeof iv !== "string" || typeof ct !== "string" || typeof ttl !== "string") return null;
  if (!IV_RE.test(iv) || !B64URL_RE.test(ct) || ct.length > MAX_CT_CHARS) return null;
  if (!Object.hasOwn(TTLS, ttl)) return null;
  return { payload: { v: 1, iv, ct }, ttl: TTLS[ttl as Ttl] };
}
