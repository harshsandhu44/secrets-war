"use client";

import { useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { decrypt, ID_RE, KEY_RE } from "@/lib/secret";

type State =
  | { kind: "idle" | "loading" }
  | { kind: "revealed"; text: string }
  | { kind: "error"; title: string; body: string; final: boolean };

const fail = (title: string, body: string, final = true): State => ({ kind: "error", title, body, final });

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
      <section className="flex flex-col gap-4 animate-in fade-in duration-150 motion-reduce:animate-none">
        <div className="flex items-start gap-1 rounded-lg border bg-muted/40 py-1 pr-1 pl-3">
          <pre className="min-w-0 flex-1 py-1.5 font-mono text-sm whitespace-pre-wrap break-all">
            {hidden ? "•".repeat(Math.min(state.text.length, 24)) : state.text}
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
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{state.title}</AlertTitle>
        <AlertDescription>{state.body}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {state.kind === "error" && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{state.title}</AlertTitle>
          <AlertDescription>{state.body}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col items-start gap-2">
        <Button size="lg" onClick={reveal} disabled={state.kind === "loading"}>
          {state.kind === "loading" && <Spinner />}
          Reveal secret
        </Button>
        <p className="text-xs text-muted-foreground">You can only view this once.</p>
      </div>
    </section>
  );
}
