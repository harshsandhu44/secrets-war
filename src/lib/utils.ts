export { cn } from "cn"

// "6d 23h", "23h 59m", "59m", "<1m"
export function formatRemaining(ms: number): string {
  const m = Math.floor(ms / 60000)
  if (m < 1) return "<1m"
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `${d}d ${h}h`
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@"

// Real text up to progress, random glyphs after. Whitespace stays put so line breaks don't jump.
// Walks code points, not UTF-16 units, so emoji never split into a lone surrogate.
export function scrambleFrame(text: string, progress: number, rand = Math.random): string {
  const chars = Array.from(text)
  const settled = Math.floor(chars.length * progress)
  let out = chars.slice(0, settled).join("")
  for (let i = settled; i < chars.length; i++) {
    out += /\s/.test(chars[i]) ? chars[i] : GLYPHS[Math.floor(rand() * GLYPHS.length)]
  }
  return out
}
