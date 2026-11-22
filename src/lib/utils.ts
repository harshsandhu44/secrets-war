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
export function scrambleFrame(text: string, progress: number, rand = Math.random): string {
  const settled = Math.floor(text.length * progress)
  let out = text.slice(0, settled)
  for (let i = settled; i < text.length; i++) {
    out += /\s/.test(text[i]) ? text[i] : GLYPHS[Math.floor(rand() * GLYPHS.length)]
  }
  return out
}
