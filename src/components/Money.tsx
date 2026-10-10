"use client";

import { useSettingsStore } from "@/store/useSettingsStore";
import { formatMoneyDisplay } from "@/lib/settings";

/**
 * Global Hide Balance state + formatter. When hidden, amounts render as
 * "Rp ••••••"; tapping a masked amount reveals all amounts for 8 seconds.
 */
export function useMoneyDisplay() {
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const revealed = useSettingsStore((s) => s.revealed);
  const toggleRevealed = useSettingsStore((s) => s.toggleRevealed);
  return {
    hideBalance,
    revealed,
    hidden: hideBalance && !revealed,
    toggleRevealed,
    text: (value: number) => formatMoneyDisplay(value, { hide: hideBalance, revealed }),
  };
}

/** Money display honoring Hide Balance. Tap a masked value to peek. */
export default function Money({ value, className, prefix }: {
  value: number; className?: string; prefix?: string;
}) {
  const { hideBalance, revealed, toggleRevealed, text } = useMoneyDisplay();
  const out = `${prefix ?? ""}${text(value)}`;
  if (!hideBalance) return <span className={className}>{out}</span>;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={revealed ? undefined : "Amount hidden, tap to reveal"}
      onClick={(e) => { e.stopPropagation(); toggleRevealed(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRevealed(); }
      }}
      className={`${className ?? ""} cursor-pointer no-underline border-none outline-none`}
    >
      {out}
    </span>
  );
}
