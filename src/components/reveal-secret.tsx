"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { HoldButton } from "@/components/ui/hold-button";
import { Spinner } from "@/components/ui/spinner";
import { decrypt, ID_RE, KEY_RE } from "@/lib/secret";
import { cn, scrambleFrame } from "@/lib/utils";

type State =
  | { kind: "idle" | "loading" }
  | { kind: "revealed"; text: string }
  | { kind: "error"; title: string; body: string; final: boolean };

const fail = (title: string, body: string, final = true): State => ({ kind: "error", title, body, final });

// Glyphs settle into the plaintext left to right, mirroring the in-browser decrypt. Writes the DOM, not state.
function ScrambleText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    // ponytail: long secrets skip the effect, each frame rebuilds the whole string.
    if (!el || reduce || text.length > 500) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / 600, 1);
      el.textContent = scrambleFrame(text, p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = scrambleFrame(text, 0);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text, reduce]);
  return <span ref={ref}>{text}</span>;
}

export function RevealSecret({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [hidden, setHidden] = useState(false);
  const inFlight = useRef(false);

  async function reveal() {
    if (inFlight.current) return;
    const key = location.hash.slice(1);
    // Check before touching the server: a truncated link would otherwise burn the secret.
    if (!ID_RE.test(id) || !KEY_RE.test(key)) {
      setState(fail("This link looks incomplete", "Ask the sender to copy the whole link, including the part after #."));
      return;
    }
    inFlight.current = true;
    setState({ kind: "loading" });

    let res: Response;
    try {
      res = await fetch(`/api/secrets/${id}/reveal`, { method: "POST", cache: "no-store" });
    } catch {
      setState(fail(
        "Couldn't confirm the reveal",
        "If the secret doesn't appear, it may have been consumed. Ask the sender for a new link.",
      ));
      return;
    }

    if (res.status === 404) {
      setState(fail("This secret was already viewed or has expired", "Ask the sender for a new link."));
      return;
    }
    if (!res.ok) {
      inFlight.current = false; // nothing was consumed, retry is safe
      const retry = Number(res.headers.get("Retry-After")) || 60;
      setState(res.status === 429
        ? fail("Too many attempts", `Try again in ${Math.ceil(retry / 60)} min.`, false)
        : fail("The service is busy", "The secret is still there. Try again in a moment.", false));
      return;
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      setState(fail(
        "Couldn't confirm the reveal",
        "If the secret doesn't appear, it may have been consumed. Ask the sender for a new link.",
      ));
      return;
    }
    try {
      const text = await decrypt(payload, key);
      history.replaceState(null, "", location.pathname);
      setState({ kind: "revealed", text });
    } catch {
      setState(fail("This link is invalid", "The secret has been destroyed. Ask the sender for a new link."));
    }
  }

  if (state.kind === "revealed") {
    return (
      <section className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
        <div className="flex items-start gap-0.5 rounded-xl border bg-card py-1 pr-1 pl-3">
          <pre
            className={cn(
              "min-w-0 flex-1 py-1.5 font-mono text-sm whitespace-pre-wrap break-all transition-[filter]",
              hidden && "blur-[6px] select-none",
            )}
          >
            <ScrambleText text={state.text} />
          </pre>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Show secret" : "Hide secret"}
          >
            {hidden ? <Eye /> : <EyeOff />}
          </Button>
          <CopyButton value={state.text} className="rounded-lg" aria-label="Copy secret" />
        </div>
        <p className="text-sm font-medium text-success">
          Secret revealed and deleted from the server. Copy it now, it won&apos;t be shown again.
        </p>
      </section>
    );
  }

  if (state.kind === "error" && state.final) {
    return (
      <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
        <AlertCircle />
        <AlertTitle>{state.title}</AlertTitle>
        <AlertDescription>{state.body}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {state.kind === "error" && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
          <AlertCircle />
          <AlertTitle>{state.title}</AlertTitle>
          <AlertDescription>{state.body}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col items-start gap-2">
        <HoldButton
          size="lg"
          className="px-4"
          onConfirm={reveal}
          disabled={state.kind === "loading"}
          aria-describedby="reveal-hint"
        >
          {state.kind === "loading" ? <Spinner /> : <Lock />}
          {state.kind === "loading" ? "Decrypting…" : "Hold to reveal"}
        </HoldButton>
        <p id="reveal-hint" className="text-xs text-muted-foreground">
          You can only view this once. It&apos;s destroyed as soon as it&apos;s revealed.
        </p>
      </div>
    </section>
  );
}
