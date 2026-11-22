"use client";

import { useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Press-and-hold for irreversible actions. Keyboard: hold Space/Enter.
// Screen-reader activation (a click with no pointer or key down) and reduced motion confirm on click.
export function HoldButton({
  onConfirm,
  duration = 1000,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { onConfirm: () => void; duration?: number }) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const holding = useRef(false);
  const keyed = useRef(false); // a Space/Enter press is in flight, so its native click must not confirm

  function start() {
    if (holding.current) return;
    holding.current = true;
    anim.current?.stop();
    anim.current = animate(progress, 1, {
      duration: (duration / 1000) * (1 - progress.get()),
      ease: "linear",
      onComplete: () => {
        holding.current = false;
        progress.set(0);
        onConfirm();
      },
    });
  }

  function cancel() {
    if (!holding.current) return;
    holding.current = false;
    anim.current?.stop();
    anim.current = animate(progress, 0, { duration: 0.25, ease: "easeOut" });
  }

  const isKey = (e: React.KeyboardEvent) => e.key === " " || e.key === "Enter";

  return (
    <Button
      {...props}
      className={cn("relative overflow-hidden select-none touch-none", className)}
      onClick={(e) => {
        // detail === 0 and no hold in progress: keyboard-less activation (assistive tech) or reduced motion.
        if (reduce || (e.detail === 0 && !holding.current && !keyed.current)) onConfirm();
      }}
      onPointerDown={(e) => !reduce && e.button === 0 && start()}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (reduce || !isKey(e)) return;
        e.preventDefault();
        keyed.current = true;
        if (!e.repeat) start();
      }}
      onKeyUp={(e) => {
        if (reduce || !isKey(e)) return;
        e.preventDefault();
        cancel();
        setTimeout(() => (keyed.current = false));
      }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-success"
        style={{ scaleX: progress }}
      />
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </Button>
  );
}
