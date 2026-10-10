"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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

const COLORS = [
  "#3b82f6", // blue-500
  "#34d399", // emerald-400
  "#a855f7", // purple-500
  "#f97316", // orange-400
  "#8b5cf6", // violet-500
  "#10b981", // green-500
  "#818cf8", // indigo-300
  "#f59e0b", // yellow-500
];

const INDO_MONTHS: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11,
};

function parseDateStr(dateStr: string): Date {
  if (!dateStr) return new Date();

  // ISO (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10) - 1,
      parseInt(isoMatch[3], 10)
    );
  }

  // en-US e.g. "Oct 7" or "Oct 7, 2024"
  const enMatch = dateStr.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:,\s+(\d{4}))?/);
  if (enMatch) {
    const monthStr = enMatch[1].toLowerCase();
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthStr.slice(0, 3));
    const day = parseInt(enMatch[2], 10);
    const year = enMatch[3] ? parseInt(enMatch[3], 10) : new Date().getFullYear();
    if (month !== -1) return new Date(year, month, day);
  }

  // Indonesian e.g. "7 Oktober" or "7 Oktober 2024"
  const indoMatch = dateStr.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/);
  if (indoMatch) {
    const day = parseInt(indoMatch[1], 10);
    const monthKey = indoMatch[2].toLowerCase();
    const month = INDO_MONTHS[monthKey] ?? new Date().getMonth();
    const year = indoMatch[3] ? parseInt(indoMatch[3], 10) : new Date().getFullYear();
    return new Date(year, month, day);
  }

  // DD/MM/YYYY
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return new Date(
      parseInt(slashMatch[3], 10),
      parseInt(slashMatch[2], 10) - 1,
      parseInt(slashMatch[1], 10)
    );
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date();
}

const formatYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function LaporanPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransactions = useFinanceStore((s) => s.addTransactions);
  const { text: moneyText, hideBalance } = useMoneyDisplay();

  const formatYAxis = (val: number) => {
    if (hideBalance) return "***";
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedPocket, setSelectedPocket] = useState<string>("");
  const [pocketDrawerOpen, setPocketDrawerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [tmpStart, setTmpStart] = useState("");
  const [tmpEnd, setTmpEnd] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  /* ── Filter transactions ─────────────────────── */
  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedPocket && t.pocketId !== selectedPocket) return false;
      if (dateRange) {
        const txnDate = parseDateStr(t.date);
        const start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        if (txnDate < start || txnDate > end) return false;
      }
      return true;
    });
  }, [transactions, selectedPocket, dateRange]);

  /* ── Aggregated metrics ──────────────────────── */
  const monthIncome = filteredTxns
    .filter((t) => !t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = filteredTxns
    .filter((t) => t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const netBalance = monthIncome - monthExpense;

  /* ── Smart Insights (modular engine) ─────────── */
  const expenseByCat = useMemo(() => {
    const m = new Map<string, number>();
    filteredTxns.filter((t) => t.isExpense && !t.isTransfer).forEach((t) => {
      const cat = t.category || "Other";
      m.set(cat, (m.get(cat) || 0) + t.amount);
    });
    return m;
  }, [filteredTxns]);

  const insightRange = useMemo(() => {
    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      return { start, end };
    }
    if (filteredTxns.length > 0) {
      const times = filteredTxns.map((t) => parseDateStr(t.date).getTime());
      return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
    }
    const now = new Date();
    return { start: now, end: now };
  }, [dateRange, filteredTxns]);

  const pocketTxns = useMemo(
    () => transactions.filter((t) => !selectedPocket || t.pocketId === selectedPocket),
    [transactions, selectedPocket]
  );

  const budgets = useFinanceStore((s) => s.budgets);

  const insightData = useMemo(
    () => generateInsightData(filteredTxns, pockets, insightRange.start, insightRange.end, pocketTxns, budgets),
    [filteredTxns, pockets, insightRange, pocketTxns, budgets]
  );

  const insights = useMemo(() => evaluateInsights(insightData), [insightData]);

  /* Animasi loading singkat tiap kali filter berubah */
  const [insightsLoading, setInsightsLoading] = useState(false);
  useEffect(() => {
    setInsightsLoading(true);
    const t = setTimeout(() => setInsightsLoading(false), 320);
    return () => clearTimeout(t);
  }, [insightData]);

  /* ── Chart data: cash flow per day ───────────── */
  const cashFlowData = useMemo(() => {
    if (filteredTxns.length === 0) return [];
    const daily: Record<string, { label: string; ts: number; delta: number }> = {};
    filteredTxns.forEach((t) => {
      if (t.isTransfer) return;
      const d = parseDateStr(t.date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const ts = dayStart.getTime();
      const key = String(ts);
      if (!daily[key]) {
        daily[key] = {
          label: dayStart.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          ts,
          delta: 0,
        };
      }
      daily[key].delta += t.isExpense ? -t.amount : t.amount;
    });
    let cum = 0;
    return Object.values(daily)
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, delta }) => {
        cum += delta;
        return { date: label, amount: cum };
      });
  }, [filteredTxns]);

  /* ── Chart data: income vs expense per day ──── */
  const barData = useMemo(() => {
    if (filteredTxns.length === 0) return [];
    const acc: Record<string, { ts: number; label: string; income: number; expense: number }> = {};
    filteredTxns.forEach((t) => {
      if (t.isTransfer) return;
      const d = parseDateStr(t.date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const ts = dayStart.getTime();
      const key = String(ts);
      if (!acc[key]) {
        acc[key] = {
          ts,
          label: dayStart.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          income: 0,
          expense: 0,
        };
      }
      if (t.isExpense) acc[key].expense += t.amount;
      else acc[key].income += t.amount;
    });
    return Object.values(acc)
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, income, expense }) => ({
        period: label,
        income,
        expense,
      }));
  }, [filteredTxns]);

  /* ── Chart data: expense pie ──────────────────── */
  const pieData = useMemo(() => {
    const m = expenseByCat;
    if (m.size === 0) {
      return [{ name: "None", value: 1 }];
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [expenseByCat]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  /* ── Date range shortcut handlers ───────────── */
  const handleShortcut = (type: "today" | "this_week" | "this_month" | "all") => {
    const now = new Date();
    if (type === "today") {
      const dStr = formatYYYYMMDD(now);
      setTmpStart(dStr);
      setTmpEnd(dStr);
      setDateRange({ start: dStr, end: dStr });
      setCalOpen(false);
    } else if (type === "this_week") {
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const sStr = formatYYYYMMDD(mon);
      const eStr = formatYYYYMMDD(sun);
      setTmpStart(sStr);
      setTmpEnd(eStr);
      setDateRange({ start: sStr, end: eStr });
      setCalOpen(false);
    } else if (type === "this_month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const sStr = formatYYYYMMDD(first);
      const eStr = formatYYYYMMDD(last);
      setTmpStart(sStr);
      setTmpEnd(eStr);
      setDateRange({ start: sStr, end: eStr });
      setCalOpen(false);
    } else if (type === "all") {
      setDateRange(null);
      setTmpStart("");
      setTmpEnd("");
      setCalOpen(false);
    }
  };

  const applyDateRange = () => {
    if (tmpStart && tmpEnd) {
      setDateRange({ start: tmpStart, end: tmpEnd });
    }
    setCalOpen(false);
  };

  const clearDateRange = () => {
    setDateRange(null);
    setTmpStart("");
    setTmpEnd("");
    setCalOpen(false);
  };

  /* ── Slider navigation ──────────────────────── */
  const scrollToSlide = (index: number) => {
    if (sliderRef.current) {
      const slideWidth = sliderRef.current.offsetWidth;
      sliderRef.current.scrollTo({ left: slideWidth * index, behavior: "smooth" });
      setActiveSlide(index);
    }
  };

  const handleScroll = () => {
    if (sliderRef.current) {
      const scrollLeft = sliderRef.current.scrollLeft;
      const slideWidth = sliderRef.current.offsetWidth;
      const newSlide = Math.round(scrollLeft / slideWidth);
      setActiveSlide(newSlide);
    }
  };

  const selectedPocketName = selectedPocket
    ? pockets.find((p) => p.id === selectedPocket)?.name || "Wallet"
    : "All Wallets";

  const activePieSlice = selectedPieIndex !== null && pieData[selectedPieIndex] ? pieData[selectedPieIndex] : null;

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >


      {/* Header */}
      <header className="relative mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Financial Reports</h1>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1 mb-1">
          Overview
        </p>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent mb-6" />

        {/* Filter Bar */}
        <div className="flex items-center gap-2.5 mb-2">
          {/* Pocket Select Button */}
          <button
            type="button"
            onClick={() => setPocketDrawerOpen(true)}
            className="flex-1 min-w-[140px] px-3.5 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white flex items-center justify-between gap-2 hover:bg-white/10 active:scale-[0.98] transition-all"
          >
            <span className="truncate font-medium">{selectedPocketName}</span>
            <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
          </button>

          {/* Date Range trigger */}
          <button
            type="button"
            onClick={() => {
              setTmpStart(dateRange?.start ?? "");
              setTmpEnd(dateRange?.end ?? "");
              setCalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 whitespace-nowrap bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
          >
            <Calendar className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <span className="truncate max-w-[130px]">
              {dateRange ? `${dateRange.start} → ${dateRange.end}` : "Select Date"}
            </span>
          </button>
        </div>
      </header>

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
          <p className="text-sm sm:text-base font-bold tracking-tight text-emerald-400 font-numeric text-center truncate">
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
          <p className="text-sm sm:text-base font-bold tracking-tight text-red-400/90 font-numeric text-center truncate">
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
          <p
            className={cn(
              "text-sm sm:text-base font-bold tracking-tight font-numeric text-center truncate",
              netBalance >= 0 ? "text-blue-400" : "text-red-400"
            )}
          >
            <Money value={netBalance} />
          </p>
        </div>
      </section>

      {/* Chart Slider Card */}
      <section className="relative mb-5">
        <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl">
          {/* Slider Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold text-white/70 uppercase tracking-widest">
              {activeSlide === 0 && "Expense Distribution"}
              {activeSlide === 1 && "Cash Flow Trend"}
              {activeSlide === 2 && "Financial Trend"}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
                disabled={activeSlide === 0}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center disabled:opacity-25 hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSlide(Math.min(2, activeSlide + 1))}
                disabled={activeSlide === 2}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center disabled:opacity-25 hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slider Container */}
          <div
            ref={sliderRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Slide 1: Pie Chart */}
            <div className="w-full shrink-0 snap-center">
              <div className="w-full h-72 flex flex-col justify-between items-center">
                {pieData.length > 0 && pieData[0].name !== "None" ? (
                  <div className="w-full h-full flex flex-col justify-between items-center">
                    {/* Donut Pie Chart Container */}
                    <div className="w-full flex-1 relative flex items-center justify-center min-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={56}
                            outerRadius={86}
                            stroke="none"
                            paddingAngle={4}
                            label={false}
                            onClick={(_, index) => setSelectedPieIndex(index === selectedPieIndex ? null : index)}
                          >
                            {pieData.map((item, idx) => (
                              <Cell
                                key={item.name}
                                fill={COLORS[idx % COLORS.length]}
                                className="cursor-pointer transition-all duration-200 hover:opacity-80"
                                stroke={selectedPieIndex === idx ? "#ffffff" : "none"}
                                strokeWidth={selectedPieIndex === idx ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<GlassTooltip format={moneyText} />} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Center Info inside Donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                        {activePieSlice ? (
                          <>
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-white/50 truncate max-w-[110px]">
                              {activePieSlice.name}
                            </span>
                            <span className="text-sm font-bold text-white font-numeric">
                              {moneyText(activePieSlice.value)}
                            </span>
                            <span className="text-[10px] text-blue-400 font-semibold font-numeric">
                              {monthExpense > 0 ? `${Math.round((activePieSlice.value / monthExpense) * 100)}%` : "0%"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-white/40">
                              Total
                            </span>
                            <span className="text-sm font-bold text-white font-numeric">
                              {moneyText(monthExpense)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Custom Legend - Strictly Single Row Horizontal Scroll */}
                    <div className="w-full flex flex-nowrap items-center overflow-x-auto gap-2.5 py-1 px-1 scrollbar-hide">
                      {pieData.map((item, idx) => {
                        const isSelected = selectedPieIndex === idx;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setSelectedPieIndex(isSelected ? null : idx)}
                            className={cn(
                              "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all",
                              isSelected ? "bg-white/15 ring-1 ring-white/30" : "bg-white/5 hover:bg-white/10"
                            )}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            <span className="text-white/80 font-medium">{item.name}</span>
                            <span className="text-white/40 font-numeric ml-0.5">
                              {monthExpense > 0 ? `${Math.round((item.value / monthExpense) * 100)}%` : "0%"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                    Insufficient data
                  </div>
                )}
              </div>
            </div>

            {/* Slide 2: Cash Flow (Full Width, Symmetrical) */}
            <div className="w-full shrink-0 snap-center">
              <div className="w-full h-72 flex flex-col justify-center">
                {cashFlowData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={cashFlowData}
                      margin={{ top: 20, right: 15, left: -5, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#ffffff08" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        stroke="#ffffff50"
                        dy={5}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        stroke="#ffffff50"
                        tickFormatter={formatYAxis}
                        width={45}
                      />
                      <Tooltip content={<GlassTooltip format={moneyText} />} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        name="Daily Balance"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#cashFlowGradient)"
                        dot={{ r: 3.5, fill: "#3b82f6", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#60a5fa", stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                    Insufficient data
                  </div>
                )}
              </div>
            </div>

            {/* Slide 3: Bar Chart (Financial Trend - Redesigned & Modern) */}
            <div className="w-full shrink-0 snap-center">
              <div className="w-full h-72 flex flex-col justify-between">
                {barData.length > 0 ? (
                  <div className="w-full h-full flex flex-col justify-between">
                    <div className="w-full flex-1 min-h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={barData}
                          margin={{ top: 20, right: 15, left: -5, bottom: 5 }}
                          barGap={8}
                          barCategoryGap={20}
                        >
                          <defs>
                            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38bdf8" />
                              <stop offset="100%" stopColor="#0284c7" />
                            </linearGradient>
                            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fb7185" />
                              <stop offset="100%" stopColor="#e11d48" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#ffffff08" strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="period"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                            dy={5}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                            tickFormatter={formatYAxis}
                            width={45}
                          />
                          <Tooltip
                            content={<GlassTooltip format={moneyText} />}
                            cursor={{ fill: "rgba(255, 255, 255, 0.05)", rx: 8 }}
                          />
                          <Bar
                            dataKey="income"
                            name="Income"
                            fill="url(#incomeGrad)"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={24}
                          />
                          <Bar
                            dataKey="expense"
                            name="Expense"
                            fill="url(#expenseGrad)"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Bar legend */}
                    <div className="flex justify-center gap-6 mt-1 py-1">
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <span className="w-3 h-3 rounded-md bg-gradient-to-b from-[#38bdf8] to-[#0284c7]" />
                        Income
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <span className="w-3 h-3 rounded-md bg-gradient-to-b from-[#fb7185] to-[#e11d48]" />
                        Expense
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                    Insufficient data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dots Pagination */}
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToSlide(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  activeSlide === i ? "bg-blue-500 w-5" : "bg-white/20 w-1.5 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Smart Insights */}
      <section className="relative">
        <InsightsCarousel
          insights={insights}
          data={insightData}
          isLoading={insightsLoading}
          onLoadDemo={() => addTransactions(generateSeedTransactions())}
        />
      </section>

      {/* Pocket Selection Drawer — unified opaque sheet */}
      <Overlay open={pocketDrawerOpen} onClose={() => setPocketDrawerOpen(false)} z={Z.sheet} label="Select wallet">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Select Wallet</h3>
          <button
            type="button"
            onClick={() => setPocketDrawerOpen(false)}
            aria-label="Close wallet picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-5 space-y-2" role="listbox" aria-label="Wallets">
          <button
            type="button"
            role="option"
            aria-selected={selectedPocket === ""}
            onClick={() => {
              setSelectedPocket("");
              setPocketDrawerOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left min-h-[52px]",
              selectedPocket === ""
                ? "bg-blue-600/20 border-blue-500/50 text-white"
                : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            <div>
              <p className="font-medium text-sm text-white">All Wallets</p>
              <p className="text-xs text-white/40">Show all transactions</p>
            </div>
            {selectedPocket === "" && <Check className="w-4 h-4 text-blue-400" />}
          </button>

          {pockets.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={selectedPocket === p.id}
              onClick={() => {
                setSelectedPocket(p.id);
                setPocketDrawerOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left min-h-[52px]",
                selectedPocket === p.id
                  ? "bg-blue-600/20 border-blue-500/50 text-white"
                  : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              <div>
                <p className="font-medium text-sm text-white">{p.name}</p>
                <p className="text-xs text-white/40 font-numeric">
                  {p.category} · {moneyText(p.balance)}
                </p>
              </div>
              {selectedPocket === p.id && <Check className="w-4 h-4 text-blue-400" />}
            </button>
          ))}
        </div>
      </Overlay>

      {/* Date Range Drawer — unified opaque sheet */}
      <Overlay open={calOpen} onClose={() => setCalOpen(false)} z={Z.sheet} label="Select date range">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Select Date Range</h3>
          <button
            type="button"
            onClick={() => setCalOpen(false)}
            aria-label="Close date picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 space-y-4">
          {/* Quick Shortcuts */}
          <div>
            <p className="text-[11px] font-medium text-white/40 mb-2 uppercase tracking-wider">Quick Shortcuts</p>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleShortcut("today")}
                className="py-2 px-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/40 border border-white/5 text-white/80 transition-all text-center min-h-[44px]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleShortcut("this_week")}
                className="py-2 px-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/40 border border-white/5 text-white/80 transition-all text-center min-h-[44px]"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => handleShortcut("this_month")}
                className="py-2 px-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/40 border border-white/5 text-white/80 transition-all text-center min-h-[44px]"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleShortcut("all")}
                className="py-2 px-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/40 border border-white/5 text-white/80 transition-all text-center min-h-[44px]"
              >
                All
              </button>
            </div>
          </div>

          {/* Manual Date Inputs */}
          <div className="flex flex-col gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Start Date</label>
              <input
                type="date"
                value={tmpStart}
                onChange={(e) => setTmpStart(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">End Date</label>
              <input
                type="date"
                value={tmpEnd}
                onChange={(e) => setTmpEnd(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={clearDateRange}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-white/10 text-white/60 hover:bg-white/15 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyDateRange}
              disabled={!tmpStart || !tmpEnd}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Apply
            </button>
          </div>
        </div>
      </Overlay>
    </motion.main>
  );
}

/* ── Glass Tooltip ─────────────────────────── */
function GlassTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
  format?: (n: number) => string;
}) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const fmt = format ?? ((n: number) => String(n));
    return (
      <div className="bg-card border border-white/10 text-white rounded-xl p-2.5 shadow-xl text-xs backdrop-blur-xl">
        {label ? <p className="text-white/50 mb-0.5 font-medium">{label}</p> : null}
        <p className="font-semibold text-white/80">{data.name}</p>
        <p className="text-blue-400 font-bold mt-0.5 font-numeric">
          {typeof data.value === "number" ? fmt(data.value) : data.value}
        </p>
      </div>
    );
  }
  return null;
}
