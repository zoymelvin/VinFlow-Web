"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Bug } from "lucide-react";
import { Insight, InsightData } from "@/lib/insights/types";
import { computeFinancialHealthScore } from "@/lib/insights/engine";
import InsightCard from "./InsightCard";
import InsightsSummary from "./InsightsSummary";
import { cn } from "@/lib/utils";

type InsightsCarouselProps = {
  insights: Insight[];
  data: InsightData;
  isLoading?: boolean;
  onLoadDemo?: () => void;
  isDev?: boolean;
};

export default function InsightsCarousel({ insights, data, isLoading, onLoadDemo, isDev }: InsightsCarouselProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const healthScore = computeFinancialHealthScore(data);
  const showDevTools = isDev ?? process.env.NODE_ENV !== "production";

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 60) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (score >= 40) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Sangat Sehat";
    if (score >= 60) return "Cukup Sehat";
    if (score >= 40) return "Perlu Perhatian";
    return "Kondisi Kritis";
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-20 bg-white/5 rounded-2xl" />
        <div className="h-20 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl space-y-4">
      {/* Header + Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Smart Insights</h3>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn("px-2.5 py-1 rounded-xl border text-xs font-bold font-numeric flex items-center gap-1.5", getScoreColor(healthScore))}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Skor Keuangan: {healthScore}/100</span>
            <span className="text-[10px] font-normal opacity-80">({getScoreLabel(healthScore)})</span>
          </div>

          {showDevTools && (
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
              title="Toggle Debug Mode"
              aria-label="Toggle debug mode"
              aria-pressed={showDebug}
            >
              <Bug className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Debug Info — hanya mode development */}
      {showDevTools && showDebug && (
        <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-[11px] font-mono text-white/70 space-y-1">
          <p className="font-bold text-blue-400">=== DEBUG ENGINE INFO ===</p>
          <p>Total Txns: {data.totalTransactions} | Days: {data.periodLengthDays}</p>
          <p>Income: {data.totalIncome} | Expense: {data.totalExpense} | Net: {data.netBalance}</p>
          <p>Top Exp: {data.topExpenseCategory.name} ({data.topExpenseCategory.amount})</p>
          <p>Prev Period: {data.prevPeriod ? `${data.prevPeriod.count} txns, exp ${data.prevPeriod.expense}` : "tidak cukup histori"}</p>
          <p>Active Insights Generated: {insights.length}</p>
          <ul className="pt-1 space-y-0.5 border-t border-white/10">
            {insights.map((i) => (
              <li key={i.id}>
                [{i.category}] {i.type} — priority {i.priority} | {i.sentiment} | variant {i.displayProps?.variantIndex ?? 0}
              </li>
            ))}
          </ul>
          {onLoadDemo && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-2 px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
            >
              Muat data contoh (3 bulan)
            </button>
          )}
        </div>
      )}

      {/* Cards List */}
      {insights.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                isExpanded={expandedId === insight.id}
                onToggleExpand={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="p-6 text-center text-white/40 text-xs rounded-2xl border border-dashed border-white/10">
          Belum cukup data transaksi untuk menampilkan insight pintar pada filter terpilih.
        </div>
      )}

      {/* Ringkasan singkat — ikut filter dompet & tanggal aktif */}
      <InsightsSummary data={data} />
    </div>
  );
}
