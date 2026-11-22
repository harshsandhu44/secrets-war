"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { LinkResult } from "@/components/link-result";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { byteLength, encrypt, MAX_PLAINTEXT_BYTES, TTLS, type Ttl } from "@/lib/secret";
import { cn } from "@/lib/utils";

const TTL_LABELS: Record<Ttl, string> = { "1h": "1 hour", "1d": "1 day", "7d": "7 days" };
const SWAP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
};
const noop = () => () => {};

export function CreateSecret() {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<Ttl>("1d");
  const [masked, setMasked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ link: string; expiresAt: number } | null>(null);
  const isMac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => true);

  const bytes = byteLength(text);
  const tooBig = bytes > MAX_PLAINTEXT_BYTES;

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !text || tooBig) return;
    setPending(true);
    setError(null);
    try {
      const { key, payload } = await encrypt(text);
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ttl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.id === "string") {
        setCreated({ link: `${location.origin}/s/${data.id}#${key}`, expiresAt: Date.now() + TTLS[ttl] * 1000 });
        setText("");
      } else if (res.status === 429) {
        const minutes = Math.ceil((Number(data.retryAfter) || 60) / 60);
        setError(`Too many secrets from your network. Try again in ${minutes} min.`);
      } else if (res.status === 400) {
        setError("That secret couldn't be saved. Check its size and try again.");
      } else {
        setError("The service is busy. Try again later.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <motion.div key="result" {...SWAP}>
            <LinkResult link={created.link} expiresAt={created.expiresAt} onReset={() => setCreated(null)} />
          </motion.div>
        ) : (
          <motion.form key="form" {...SWAP} onSubmit={submit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret">Secret</Label>
              <div className="relative">
                <Textarea
                  id="secret"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={7}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={tooBig || undefined}
                  aria-describedby="secret-size"
                  className={cn(
                    "min-h-40 rounded-xl bg-card pr-11 font-mono text-sm pointer-coarse:pr-14",
                    // Blur the glyphs only, not the field: transparent text plus a soft shadow of itself.
                    masked && "text-transparent caret-foreground [text-shadow:0_0_7px_var(--color-foreground)]",
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5 text-muted-foreground"
                  aria-label={masked ? "Show secret while typing" : "Hide secret while typing"}
                  aria-pressed={masked}
                  onClick={() => setMasked((m) => !m)}
                >
                  {masked ? <Eye /> : <EyeOff />}
                </Button>
              </div>
              <div className="h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn(
                    "h-full origin-left transition-[transform,background-color] duration-300 ease-out",
                    tooBig ? "bg-destructive" : "bg-success",
                  )}
                  style={{ transform: `scaleX(${Math.min(bytes / MAX_PLAINTEXT_BYTES, 1)})` }}
                />
              </div>
              <p
                id="secret-size"
                className={cn("text-xs tabular-nums", tooBig ? "text-destructive" : "text-muted-foreground")}
              >
                {bytes.toLocaleString()} / {MAX_PLAINTEXT_BYTES.toLocaleString()} bytes
                {tooBig && ". Too long to share."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label id="ttl-label">Expires after</Label>
              <ToggleGroup
                type="single"
                spacing={1}
                value={ttl}
                onValueChange={(v) => v && setTtl(v as Ttl)}
                aria-labelledby="ttl-label"
                className="rounded-xl bg-muted p-1"
              >
                {(Object.keys(TTL_LABELS) as Ttl[]).map((k) => (
                  <ToggleGroupItem
                    key={k}
                    value={k}
                    className="relative px-3 text-muted-foreground hover:bg-transparent data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                  >
                    {ttl === k && (
                      <motion.span
                        layoutId="ttl-pill"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-success/40"
                      />
                    )}
                    <span className="relative">{TTL_LABELS[k]}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div {...SWAP}>
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" size="lg" className="self-start" disabled={pending || !text || tooBig}>
              {pending && <Spinner />}
              {pending ? "Encrypting…" : "Create link"}
              <kbd className="ml-1 hidden rounded-md bg-primary-foreground/15 px-1.5 font-sans text-[0.7rem] sm:inline">
                {isMac ? "⌘" : "Ctrl"} ↵
              </kbd>
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
