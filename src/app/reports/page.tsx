"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Scale, Calendar, ChevronLeft, ChevronRight, ChevronDown, Check, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import { useFinanceStore } from "@/store/useFinanceStore";
import { generateInsightData, evaluateInsights } from "@/lib/insights/engine";
import InsightsCarousel from "@/components/insights/InsightsCarousel";
import { generateSeedTransactions } from "@/lib/insights/seed";
import Money, { useMoneyDisplay } from "@/components/Money";
import PageHeader from "@/components/PageHeader";

const COLORS = [
  "#3b82f6", "#34d399", "#a855f7", "#f97316", "#8b5cf6", "#10b981", "#818cf8", "#f59e0b",
];

export default function LaporanPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransactions = useFinanceStore((s) => s.addTransactions);
  const { text: moneyText, hideBalance } = useMoneyDisplay();

  const [hasMounted, setHasMounted] = useState(false);
  const [selectedPocket, setSelectedPocket] = useState<string>("");
  const [pocketDrawerOpen, setPocketDrawerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  
  useEffect(() => { setHasMounted(true); }, []);

  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedPocket && t.pocketId !== selectedPocket) return false;
      if (dateRange) {
        const d = new Date(t.date);
        const start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        if (d < start || d > end) return false;
      }
      return true;
    });
  }, [transactions, selectedPocket, dateRange]);

  const monthIncome = filteredTxns
    .filter((t) => !t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = filteredTxns
    .filter((t) => t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const netBalance = monthIncome - monthExpense;

  const data = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const pocketTxns = transactions.filter((t) => !selectedPocket || t.pocketId === selectedPocket);
    return generateInsightData(filteredTxns, pockets, dateRange ? new Date(dateRange.start) : start, dateRange ? new Date(dateRange.end) : now, pocketTxns);
  }, [filteredTxns, pockets, dateRange, transactions, selectedPocket]);

  const insights = useMemo(() => evaluateInsights(data), [data]);

  if (!hasMounted) return null;

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <PageHeader
        isCompact
        title="Financial Reports"
        label="OVERVIEW"
      />

      <div className="px-4 pt-4">
        {/* Filter Bar */}
        <div className="flex items-center gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => setPocketDrawerOpen(true)}
            className="flex-1 min-w-[140px] px-3.5 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between gap-2 hover:bg-white/10 active:scale-[0.98] transition-all"
          >
            <span className="truncate font-medium">{selectedPocket ? pockets.find(p=>p.id === selectedPocket)?.name : "All Wallets"}</span>
            <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => setCalOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 whitespace-nowrap bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
          >
            <Calendar className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <span className="truncate max-w-[130px]">
              {dateRange ? `${dateRange.start} → ${dateRange.end}` : "Select Date"}
            </span>
          </button>
        </div>

        {/* Summary Cards */}
        <section className="relative grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 shadow-xl">
            <div className="flex items-center justify-center mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
              </span>
            </div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest text-center mb-0.5">
              Income
            </p>
            <p className="text-sm font-bold tracking-tight text-emerald-400 font-numeric text-center truncate">
              <Money value={monthIncome} />
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 shadow-xl">
            <div className="flex items-center justify-center mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
              </span>
            </div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest text-center mb-0.5">
              Expense
            </p>
            <p className="text-sm font-bold tracking-tight text-red-400 font-numeric text-center truncate">
              <Money value={monthExpense} />
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 shadow-xl">
            <div className="flex items-center justify-center mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Scale className="w-3.5 h-3.5 text-blue-400" strokeWidth={2.5} />
              </span>
            </div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest text-center mb-0.5">
              Net Balance
            </p>
            <p className={cn("text-sm font-bold tracking-tight font-numeric text-center truncate", netBalance >= 0 ? "text-blue-400" : "text-red-400")}>
              <Money value={netBalance} />
            </p>
          </div>
        </section>

        {/* Insights Carousel */}
        <section className="relative">
          <InsightsCarousel
            insights={insights}
            data={data}
            onLoadDemo={() => addTransactions(generateSeedTransactions())}
          />
        </section>
      </div>
    </motion.main>
  );
}
