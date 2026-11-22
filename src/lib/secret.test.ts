import { describe, expect, it } from "vitest";
import { decrypt, encrypt, ID_RE, KEY_RE, MAX_PLAINTEXT_BYTES, parseCreateBody, randomB64url } from "./secret";

describe("crypto", () => {
  it("round-trips multi-byte text", async () => {
    const text = "pässwörd 🔐 密码\nline two";
    const { key, payload } = await encrypt(text);
    expect(KEY_RE.test(key)).toBe(true);
    expect(await decrypt(payload, key)).toBe(text);
  });

  it("rejects a wrong key", async () => {
    const { payload } = await encrypt("hello");
    const { key: other } = await encrypt("x");
    await expect(decrypt(payload, other)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const { key, payload } = await encrypt("hello");
    const flipped = (payload.ct[0] === "A" ? "B" : "A") + payload.ct.slice(1);
    await expect(decrypt({ ...payload, ct: flipped }, key)).rejects.toThrow();
  });

  it("enforces the byte limit, not the character limit", async () => {
    await expect(encrypt("🔐".repeat(MAX_PLAINTEXT_BYTES / 4 + 1))).rejects.toThrow();
    await expect(encrypt("")).rejects.toThrow();
  });
});

describe("formats", () => {
  it("accepts generated ids and keys, rejects truncated or padded ones", async () => {
    const id = randomB64url(16);
    const { key } = await encrypt("x");
    expect(ID_RE.test(id)).toBe(true);
    expect(KEY_RE.test(key.slice(0, -1))).toBe(false);
    expect(KEY_RE.test(key + "=")).toBe(false);
    expect(ID_RE.test(id.slice(0, -1))).toBe(false);
  });
});

describe("parseCreateBody", () => {
  it("accepts a valid body at the max size", async () => {
    const { payload } = await encrypt("a".repeat(MAX_PLAINTEXT_BYTES));
    expect(parseCreateBody(JSON.stringify({ ...payload, ttl: "7d" }))).toEqual({ payload, ttl: 604800 });
  });

  it("rejects unknown ttls, bad shapes and oversized bodies", async () => {
    const { payload } = await encrypt("hi");
    expect(parseCreateBody(JSON.stringify({ ...payload, ttl: "30d" }))).toBeNull();
    expect(parseCreateBody(JSON.stringify({ ...payload, ttl: "toString" }))).toBeNull();
    expect(parseCreateBody(JSON.stringify({ ...payload, v: 2, ttl: "1h" }))).toBeNull();
    expect(parseCreateBody(JSON.stringify({ ...payload, iv: "short", ttl: "1h" }))).toBeNull();
    expect(parseCreateBody(JSON.stringify({ ...payload, ct: "a".repeat(20000), ttl: "1h" }))).toBeNull();
    expect(parseCreateBody("not json")).toBeNull();
    expect(parseCreateBody("null")).toBeNull();
  });
});
