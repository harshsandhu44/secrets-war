import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleCheck, Clock, QrCode, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { formatRemaining } from "@/lib/utils";

const noop = () => () => {};

export function LinkResult({ link, expiresAt, onReset }: { link: string; expiresAt: number; onReset: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const left = expiresAt - now;

  return (
    <section className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <motion.span
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.1 }}
        >
          <CircleCheck className="size-4" />
        </motion.span>
        Link created
      </p>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-start gap-0.5 py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 py-1.5 font-mono text-sm break-all">{link}</code>
          <CopyButton value={link} className="rounded-lg" aria-label="Copy link" />
          {canShare && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Share link"
              onClick={() => navigator.share({ url: link }).catch(() => {})}
            >
              <Share2 />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={showQr ? "Hide QR code" : "Show QR code"}
            aria-pressed={showQr}
            className="aria-pressed:bg-muted"
            onClick={() => setShowQr((s) => !s)}
          >
            <QrCode />
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showQr && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex justify-center border-t p-4">
                {/* White plate in both themes: scanners need dark-on-light. */}
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={link} size={176} marginSize={0} title="QR code for the secret link" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {left > 0 ? `Works once. Expires in ${formatRemaining(left)}.` : "Expired."}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        You won&apos;t be able to see this secret again. Send the link to the recipient.
      </p>
      <Button variant="outline" className="self-start" onClick={onReset}>
        Create another
      </Button>
    </section>
  );
}
