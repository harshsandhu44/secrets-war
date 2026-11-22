"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { byteLength, encrypt, MAX_PLAINTEXT_BYTES, type Ttl } from "@/lib/secret";

const TTL_LABELS: Record<Ttl, string> = { "1h": "1 hour", "1d": "1 day", "7d": "7 days" };

export function CreateSecret() {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<Ttl>("1d");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ link: string; ttl: Ttl } | null>(null);

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
        setCreated({ link: `${location.origin}/s/${data.id}#${key}`, ttl });
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

  if (created) {
    return (
      <section className="flex flex-col gap-4 animate-in fade-in duration-150 motion-reduce:animate-none">
        <p className="text-sm font-medium text-success">
          Link created. It works once and expires in {TTL_LABELS[created.ttl]}.
        </p>
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 py-1.5 font-mono text-sm break-all">{created.link}</code>
          <CopyButton value={created.link} className="rounded-lg" aria-label="Copy link" />
        </div>
        <p className="text-sm text-muted-foreground">
          You won&apos;t be able to see this secret again. Send the link to the recipient.
        </p>
        <Button variant="outline" className="self-start" onClick={() => setCreated(null)}>
          Create another
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="secret">Secret</Label>
        <Textarea
          id="secret"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={tooBig || undefined}
          aria-describedby="secret-size"
          className="min-h-40 font-mono text-sm"
        />
        <p id="secret-size" className={tooBig ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {bytes.toLocaleString()} / {MAX_PLAINTEXT_BYTES.toLocaleString()} bytes
          {tooBig && ". Too long to share."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="ttl-label">Expires after</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={ttl}
          onValueChange={(v) => v && setTtl(v as Ttl)}
          aria-labelledby="ttl-label"
        >
          {(Object.keys(TTL_LABELS) as Ttl[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3">
              {TTL_LABELS[k]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="self-start" disabled={pending || !text || tooBig}>
        {pending && <Spinner />}
        Create link
      </Button>
    </form>
  );
}
