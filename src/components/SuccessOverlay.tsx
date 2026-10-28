"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Portal, Z } from "@/components/overlay";

/**
 * Shared full-screen success animation, extracted from Add Transaction so
 * Transfer reuses the exact same staging and timing.
 *
 * Defaults reproduce Add's look pixel-for-pixel (translucent black backdrop,
 * modal layer, iOS blue, no skip button). Transfer opts into the transfer
 * blue tone, a solid backdrop, the topmost layer, tap-to-skip and
 * reduced-motion support.
 *
 * Performance: only transform and opacity are animated — the expanding ring
 * is a scaled/fading element, not a box-shadow spread. No backdrop-filter,
 * no infinite animations, no layout shift.
 */
export interface SuccessOverlayProps {
  /** Color tone. "default" matches Add's iOS blue; "transfer" uses the transfer blue. */
  tone?: "default" | "transfer";
  title: string;
  /** Main text — the moved amount (Money handles Hide Balances). */
  amount?: React.ReactNode;
  caption: string;
  /** Optional extra line (e.g. "Admin fee Rp 1.000"). */
  extra?: string;
  /** Announced to screen readers via role="status". */
  ariaLabel?: string;
  /** Add keeps its translucent backdrop; default is solid. */
  backdropClassName?: string;
  /** Layer from the shared Z scale. Add keeps Z.modal; default is topmost. */
  z?: number;
  /** Reduced-motion users see the final state instantly. */
  reducedMotion?: boolean;
  /** When set, a full-screen skip button calls onDone immediately. */
  skipLabel?: string;
  /** Called when the animation sequence finishes (or is skipped). */
  onDone?: () => void;
}

const TONE_ACCENT = { default: "#007AFF", transfer: "#6ea4ff" } as const;
const TONE_CIRCLE = { default: "#007AFF", transfer: "#2563eb" } as const;

/** Total on-screen time before onDone — matches Add's 1500ms navigate delay. */
const DONE_MS = 1500;
const REDUCED_DONE_MS = 900;

export default function SuccessOverlay({
  tone = "default",
  title,
  amount,
  caption,
  extra,
  ariaLabel = "Success",
  backdropClassName = "bg-[#0b0d12]",
  z = Z.lightbox,
  reducedMotion = false,
  skipLabel,
  onDone,
}: SuccessOverlayProps) {
  const accent = TONE_ACCENT[tone];
  const circleTint = TONE_CIRCLE[tone];
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDoneRef.current?.();
  }, []);

  // Primary completion path; the host page keeps its own fallback timer.
  useEffect(() => {
    if (!onDone) return undefined;
    timerRef.current = setTimeout(finish, reducedMotion ? REDUCED_DONE_MS : DONE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [finish, onDone, reducedMotion]);

  const anim = !reducedMotion;

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 isolate flex items-center justify-center"
        style={{ zIndex: z }}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        initial={anim ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div aria-hidden="true" className={`absolute inset-0 ${backdropClassName}`} />
        {skipLabel ? (
          <button
            type="button"
            aria-label={skipLabel}
            onClick={finish}
            className="absolute inset-0 cursor-pointer"
          />
        ) : null}
        <motion.div
          className="relative flex flex-col items-center gap-4 px-8 pointer-events-none"
          initial={anim ? { scale: 0.8, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            anim
              ? { type: "spring", stiffness: 200, damping: 20, duration: 0.5 }
              : undefined
          }
        >
          {/* Circle with one pulse + expanding ring (transform/opacity only) */}
          <div className="relative flex items-center justify-center">
            {!reducedMotion && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: accent }}
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.45 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            )}
            <motion.div
              className="w-24 h-24 rounded-full flex items-center justify-center border"
              style={{ backgroundColor: `${circleTint}14`, borderColor: `${circleTint}33` }}
              animate={anim ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={anim ? { duration: 1.2, times: [0, 0.5, 1] } : undefined}
            >
              <motion.div
                animate={anim ? { scale: [0.8, 1.1, 1], rotate: [0, 10, 0] } : { scale: 1, rotate: 0 }}
                transition={anim ? { duration: 0.6, times: [0, 0.5, 1] } : undefined}
              >
                <Check className="w-12 h-12" strokeWidth={2.5} style={{ color: accent }} aria-hidden="true" />
              </motion.div>
            </motion.div>
          </div>

          {/* Text block — same staging as Add: block rises, then title, caption */}
          <motion.div
            className="text-center"
            initial={anim ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={anim ? { delay: 0.15, duration: 0.4 } : undefined}
          >
            {amount ? (
              <motion.div
                className="text-[34px] font-bold tracking-tight text-white font-numeric"
                initial={anim ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={anim ? { delay: 0.2, duration: 0.3 } : undefined}
              >
                {amount}
              </motion.div>
            ) : null}
            <motion.h3
              className="text-2xl font-bold text-foreground tracking-tighter mb-1"
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={anim ? { delay: 0.25, duration: 0.3 } : undefined}
            >
              {title}
            </motion.h3>
            <motion.p
              className="text-sm text-muted-foreground truncate max-w-[280px] mx-auto"
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={anim ? { delay: 0.35, duration: 0.3 } : undefined}
            >
              {caption}
            </motion.p>
            {extra ? (
              <motion.p
                className="text-xs text-muted-foreground mt-1"
                initial={anim ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={anim ? { delay: 0.45, duration: 0.3 } : undefined}
              >
                {extra}
              </motion.p>
            ) : null}
          </motion.div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
