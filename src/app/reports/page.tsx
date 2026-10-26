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
  const [tmpStart, setTmpStart] = useState("");
  const [tmpEnd, setTmpEnd] = useState("");

  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  const formatYAxis = (val: number) => {
    if (hideBalance) return "***";
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };

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

  const expenseByCat = useMemo(() => {
    const m = new Map<string, number>();
    filteredTxns.filter((t) => t.isExpense && !t.isTransfer).forEach((t) => {
      const cat = t.category || "Other";
      m.set(cat, (m.get(cat) || 0) + t.amount);
    });
    return m;
  }, [filteredTxns]);

  const cashFlowData = useMemo(() => {
    if (filteredTxns.length === 0) return [];
    const daily: Record<string, { label: string; ts: number; delta: number }> = {};
    filteredTxns.forEach((t) => {
      if (t.isTransfer) return;
      const d = new Date(t.date);
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

  const barData = useMemo(() => {
    if (filteredTxns.length === 0) return [];
    const acc: Record<string, { ts: number; label: string; income: number; expense: number }> = {};
    filteredTxns.forEach((t) => {
      if (t.isTransfer) return;
      const d = new Date(t.date);
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

  const pieData = useMemo(() => {
    if (expenseByCat.size === 0) {
      return [{ name: "None", value: 1 }];
    }
    return Array.from(expenseByCat.entries()).map(([name, value]) => ({ name, value }));
  }, [expenseByCat]);

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

  const activePieSlice = selectedPieIndex !== null && pieData[selectedPieIndex] ? pieData[selectedPieIndex] : null;

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
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 shadow-xl">
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
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 shadow-xl">
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
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 shadow-xl">
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

        {/* Chart Slider Card */}
        <section className="relative mb-5">
          <div className="rounded-3xl bg-[#151922] border border-[#232938] p-5 shadow-xl">
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
                  aria-label="Previous chart"
                  onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
                  disabled={activeSlide === 0}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center disabled:opacity-25 hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next chart"
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
                      <div className="w-full flex-1 relative flex items-center justify-center min-h-[200px]">
                        <ResponsiveContainer width="100%" height={200}>
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

                      {/* Custom Legend */}
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

              {/* Slide 2: Cash Flow */}
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

              {/* Slide 3: Bar Chart */}
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
                  aria-label={`Go to chart ${i + 1}`}
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

        {/* Insights Carousel */}
        <section className="relative">
          <InsightsCarousel
            insights={insights}
            data={data}
            onLoadDemo={() => addTransactions(generateSeedTransactions())}
          />
        </section>
      </div>

      {/* Pocket Selection Drawer */}
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

      {/* Date Range Drawer */}
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

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setDateRange(null);
                setTmpStart("");
                setTmpEnd("");
                setCalOpen(false);
              }}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-white/10 text-white/60 hover:bg-white/15 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                if (tmpStart && tmpEnd) {
                  setDateRange({ start: tmpStart, end: tmpEnd });
                }
                setCalOpen(false);
              }}
              disabled={!tmpStart || !tmpEnd}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Apply
            </button>
          </div>
        </div>
      </Overlay>
    </motion.main>
  );
}

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
      <div className="bg-[#151922] border border-white/10 text-white rounded-xl p-2.5 shadow-xl text-xs">
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
