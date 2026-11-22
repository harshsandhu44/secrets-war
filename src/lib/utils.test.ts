import { describe, expect, it } from "vitest";
import { formatRemaining, scrambleFrame } from "./utils";

const MIN = 60_000;

describe("formatRemaining", () => {
  it("formats days, hours and minutes", () => {
    expect(formatRemaining(7 * 1440 * MIN)).toBe("7d 0h");
    expect(formatRemaining((1440 - 1) * MIN)).toBe("23h 59m");
    expect(formatRemaining(60 * MIN)).toBe("1h 0m");
    expect(formatRemaining(59 * MIN)).toBe("59m");
    expect(formatRemaining(30_000)).toBe("<1m");
    expect(formatRemaining(-5)).toBe("<1m");
  });
});

describe("scrambleFrame", () => {
  const text = "pass word\nline two";
  it("settles to the real text and keeps whitespace and length", () => {
    expect(scrambleFrame(text, 1)).toBe(text);
    for (const p of [0, 0.3, 0.7]) {
      const frame = scrambleFrame(text, p);
      expect(frame).toHaveLength(text.length);
      expect(frame[4]).toBe(" ");
      expect(frame[9]).toBe("\n");
    }
    expect(scrambleFrame(text, 0.5, () => 0).startsWith(text.slice(0, 9))).toBe(true);
  });

  it("never splits an emoji into a lone surrogate", () => {
    const emoji = "key 🔐 here";
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (let p = 0; p <= 1; p += 0.05) expect(lone.test(scrambleFrame(emoji, p))).toBe(false);
  });
});
