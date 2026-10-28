"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";

/* Placeholder shell — the full transfer form lands in the next phase. */
export default function TransferPage() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => { setHasMounted(true); }, []);
  if (!hasMounted) return null;

  const backButton = (
    <Link
      href="/pockets"
      aria-label="Back to wallets"
      className="w-11 h-11 rounded-full bg-[#151922] border border-[#232938] flex items-center justify-center text-white/80 hover:bg-white/5 active:scale-95 transition"
    >
      <ArrowLeft className="w-5 h-5" aria-hidden="true" />
    </Link>
  );

  return (
    <main className="relative min-h-screen bg-background text-foreground px-4 pt-4 pb-28">
      <PageHeader title="Transfer" label="MOVE MONEY" left={backButton} />
      <p className="mt-6 text-sm text-muted-foreground px-1">
        Choose two wallets and an amount — the full form is next.
      </p>
    </main>
  );
}
