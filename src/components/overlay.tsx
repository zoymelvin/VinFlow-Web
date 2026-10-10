"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Single layering rule for the whole app (bottom → top):
 * page content 0 (plain `relative`, no z) · sticky headers 10 ·
 * BottomNav 50 · bottom sheets 100 · centered modals 110 ·
 * confirm dialogs 120 · toasts 130 · image lightbox 140.
 *
 * Every floating panel renders through Overlay/Portal below, straight into
 * document.body. Ancestor stacking contexts (page transforms, `relative z-10`
 * sections, sticky headers) can therefore never trap a panel again.
 */
export const Z = {
  sticky: 10,
  nav: 50,
  sheet: 100,
  modal: 110,
  confirm: 120,
  toast: 130,
  lightbox: 140,
} as const;

/* ── Body scroll lock (counter-safe for stacked overlays) ── */
let locks = 0;
let prevOverflow = "";

export function useLockBody(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    locks += 1;
    if (locks === 1) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      locks -= 1;
      if (locks <= 0) {
        locks = 0;
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [locked]);
}

/* ── Shared back-button + Escape handling ─────────────────────
 * Each open overlay pushes one history entry and registers itself.
 * A back press fires every listener, but only the topmost entry acts —
 * lower overlays stay open with their own entries intact.
 * Escape delegates to history.back() so the same single path closes.
 * Non-overlay entries (e.g. select mode) can join the same stack via
 * useBackEntry so back always unwinds top-first.
 */
const backStack: Array<{ close: () => void }> = [];

/** Stack depth for non-overlay back entries (select mode). */
export function overlayDepth(): number {
  return backStack.length;
}

function pushBackEntry(onClose: () => void): () => void {
  const closeRef = { current: onClose };
  const entry = { close: () => closeRef.current() };
  backStack.push(entry);
  window.history.pushState({ vinflowOverlay: true }, "");

  const onPop = () => {
    if (backStack[backStack.length - 1] === entry) {
      backStack.pop();
      entry.close();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (backStack[backStack.length - 1] === entry) {
      window.history.back();
    }
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("keydown", onKey);
    const i = backStack.indexOf(entry);
    if (i !== -1) backStack.splice(i, 1);
  };
}

export function useOverlayHandle(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    return pushBackEntry(() => closeRef.current());
  }, [open]);
}

/** Generic back entry for non-overlay states (select mode). */
export function useBackEntry(open: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!open) return undefined;
    return pushBackEntry(() => ref.current());
  }, [open]);
}

/** Render children straight into document.body (escapes page stacking). */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  z?: number;
  label: string;
  children: React.ReactNode;
  /** centered modal vs bottom sheet */
  variant?: "sheet" | "modal";
}

/**
 * Shared overlay primitive: dark solid backdrop + one solid panel.
 * Panels are ALWAYS opaque — frosted blur is reserved for plain cards,
 * never for anything floating above content.
 */
export function Overlay({ open, onClose, z = Z.sheet, label, children, variant = "sheet" }: OverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const shown = open && mounted;
  useLockBody(shown);
  useOverlayHandle(shown, onClose);
  // Touch fallback: lock scroll position while an overlay is open so the
  // background can't be panned on mobile even if body overflow is ignored.
  useEffect(() => {
    if (!shown) return;
    const y = window.scrollY;
    const onTouch = (e: TouchEvent) => {
      if (!(e.target as HTMLElement)?.closest("[data-overlay-panel]")) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      document.removeEventListener("touchmove", onTouch);
      window.scrollTo(0, y);
    };
  }, [shown]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 isolate flex items-end justify-center sm:items-center"
          style={{ zIndex: z }}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          {variant === "sheet" ? (
            <motion.div
              data-overlay-panel
               className="relative isolate w-full max-w-md mx-auto mb-0 rounded-t-3xl bg-card border border-white/10 border-b-0 shadow-2xl max-h-[86dvh] flex flex-col overflow-hidden"
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              data-overlay-panel
               className="relative isolate w-[calc(100%-2rem)] max-w-md mx-auto rounded-3xl bg-card border border-white/10 shadow-2xl max-h-[86dvh] flex flex-col overflow-hidden my-4"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {children}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Grab handle shown on top of every bottom sheet. */
export function GrabHandle() {
  return <div aria-hidden="true" className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />;
}
