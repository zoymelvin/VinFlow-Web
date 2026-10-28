"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/* Transfer header — compact and flush with content (x = 16px).
 * The shared PageHeader carries its own px-4, which stacked on the padded
 * main pushed its contents ~16px right of the page content; this page uses
 * an inline header instead so header and body share one padding edge. */
export default function TransferPage() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => { setHasMounted(true); }, []);
  if (!hasMounted) return null;

  return (
    <main className="relative min-h-screen bg-background text-foreground px-4 pb-28">
      <header className="pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/pockets"
            aria-label="Back to wallets"
            className="flex w-11 h-11 items-center justify-center rounded-full outline-none"
          >
            <span className="w-10 h-10 rounded-full bg-[#151922] border border-[#232938] flex items-center justify-center text-white/80">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-white leading-tight">Transfer</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2] mt-0.5">
              MOVE MONEY
            </p>
          </div>
        </div>
        <div className="h-px w-[150px] bg-gradient-to-r from-blue-500/40 to-transparent mt-2.5" />
      </header>

      <p className="mt-6 text-sm text-muted-foreground px-1">
        Choose two wallets and an amount — the full form is next.
      </p>
    </main>
  );
}
