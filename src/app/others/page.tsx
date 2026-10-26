"use client";

import Link from "next/link";
import { ArrowLeft, Bitcoin } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardConfig {
  name: string;
  href: string;
  icon: React.ComponentType<{className?: string}>;
  color: string;
}

const cards: CardConfig[] = [
  { name: "Crypto", href: "/crypto", icon: Bitcoin, color: "#6ea4ff" },
];

export default function OthersPage() {
  return (
    <main className="relative min-h-screen bg-[#0b0d12] text-white pb-28 px-4 pt-4">
      <header className="flex items-center mb-6">
        <Link href="/" className="w-10 h-10 rounded-full bg-[#151922] border border-[#232938] flex items-center justify-center mr-4 transition active:scale-95" aria-label="Back to Home">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-xl font-bold text-white">Others</h1>
      </header>
      <section className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.name} href={c.href} className="flex flex-col items-center justify-center p-4 min-h-[92px] rounded-2xl bg-[#151922] border border-[#232938] hover:bg-white/5 transition active:scale-[0.97] duration-90 gap-2">
            <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${c.color}29` }}>
                <c.icon className="w-[18px] h-[18px] text-[#ffa94d]" />
            </div>
            <span className={cn("text-xs text-white font-medium")}>{c.name}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
