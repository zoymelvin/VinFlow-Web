"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, BarChart3, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore } from "@/store/useFinanceStore";
import { calculateBudget, currentPeriod, splitBudgets } from "@/lib/budget";
import Money from "@/components/Money";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import { parseRupiahAmount } from "@/lib/parseAmount";
import CategoryIcon from "@/components/CategoryIcon";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function statusLine(percentRemaining: number, totalSpent: number): string {
  if (totalSpent === 0) return "You haven't spent from your budgets yet";
  if (percentRemaining <= 0) return "Over budget — time to review spending";
  if (percentRemaining <= 20) return "Almost out — consider cutting back";
  if (percentRemaining <= 50) return "Watch out — you're doing great";
  return "On track — excellent";
}

export default function BudgetsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const budgetsRaw = useFinanceStore((s) => s.budgets);
  const addBudget = useFinanceStore((s) => s.addBudget);
  const updateBudget = useFinanceStore((s) => s.updateBudget);
  const deleteBudget = useFinanceStore((s) => s.deleteBudget);

  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [startDateOption, setStartDateOption] = useState<"today" | "first_month">("today");
  const [formError, setFormError] = useState("");

  const { valid: budgets, invalid: invalidBudgets } = useMemo(() => splitBudgets(budgetsRaw), [budgetsRaw]);

  const filteredValid = useMemo(() => budgets.filter((b) => b.period === period), [budgets, period]);
  const filteredInvalid = useMemo(() => invalidBudgets.filter((b) => b.period === period), [invalidBudgets, period]);

  const expenseCategories = useMemo(() => EXPENSE_CATEGORIES, []);

  const totalSummary = useMemo(() => {
    if (filteredValid.length === 0) return null;
    const totalLimit = filteredValid.reduce((sum, b) => sum + (b.baseAmount + (b.topUps?.reduce((s, u) => s + u.amount, 0) ?? 0)), 0);
    const totalSpent = filteredValid.reduce((sum, b) => sum + calculateBudget(b, transactions, period).spent, 0);
    const totalRemaining = totalLimit - totalSpent;
    const totalPercent = totalLimit > 0 ? Math.max(0, Math.floor((totalRemaining / totalLimit) * 100)) : 0;
    return { totalLimit, totalSpent, totalRemaining, totalPercent };
  }, [filteredValid, transactions, period]);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isCurrentMonth = period === currentPeriod();

  const openAdd = () => {
    setEditId(null);
    setCategoryInput(expenseCategories[0]?.id ?? "");
    setAmountInput("");
    setStartDateOption("today");
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (b: typeof budgets[0]) => {
    setEditId(b.id);
    setCategoryInput(b.categoryId);
    setAmountInput(b.baseAmount.toString());
    setStartDateOption(b.startDate?.startsWith(period) ? "today" : "first_month");
    setFormError("");
    setFormOpen(true);
  };

  const submitForm = () => {
    const amount = parseRupiahAmount(amountInput);
    if (!categoryInput) { setFormError("Select a category"); return; }
    if (!amount) { setFormError("Enter a valid amount"); return; }
    const startDate = startDateOption === "today" ? new Date().toISOString().slice(0, 10) : `${period}-01`;
    if (editId) {
      updateBudget(editId, { categoryId: categoryInput, baseAmount: amount, startDate, period });
    } else {
      addBudget({
        id: `budget-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        categoryId: categoryInput,
        baseAmount: amount,
        period,
        startDate,
        topUps: [],
        createdAt: new Date().toISOString().slice(0, 10),
      });
    }
    setFormOpen(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 pb-28">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" aria-label="Back" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Budgets</h1>
        <button onClick={openAdd} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-500 active:scale-90 transition">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setPeriod(shiftPeriod(period, -1))} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white/80 min-w-[92px] text-center">{periodLabel(period)}</span>
        <button onClick={() => !isCurrentMonth && setPeriod(shiftPeriod(period, 1))} className={cn("w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition", isCurrentMonth ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10 active:scale-90")}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {totalSummary && (
        <section className="rounded-3xl bg-white/5 border border-white/10 p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Total Budget</p>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <Money value={totalSummary.totalRemaining} className="text-2xl font-bold" />
            <span className="text-sm text-white/40">of <Money value={totalSummary.totalLimit} /></span>
            <span className="ml-auto text-sm font-bold text-white/70">{totalSummary.totalPercent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mt-3">
            <div className="h-full bg-blue-500" style={{ width: `${totalSummary.totalPercent}%` }} />
          </div>
          <p className="text-xs text-white/50 mt-2">{statusLine(totalSummary.totalPercent, totalSummary.totalSpent)}</p>
        </section>
      )}

      <section className="space-y-3">
        {filteredValid.map((b) => {
          const res = calculateBudget(b, transactions, period);
          const barColor = res.status === "over_budget" ? "bg-red-500" : res.status === "almost_out" ? "bg-orange-400" : res.status === "watch_out" ? "bg-amber-400" : "bg-blue-500";
          return (
            <div key={b.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <CategoryIcon category={b.categoryId} />
                  <span className="text-sm font-semibold">{b.categoryId}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="p-1 text-white/60 hover:text-white"><Edit size={16} /></button>
                  <button onClick={() => deleteBudget(b.id)} className="p-1 text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <Money value={res.remaining} className="text-lg font-bold" />
                <span className="text-xs text-white/40">Spent <Money value={res.spent} /> of <Money value={res.limit} /></span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                <div className={cn("h-full transition-all", barColor)} style={{ width: `${Math.min(100, res.percentRemaining)}%` }} />
              </div>
              <p className="text-xs text-white/50 mt-1">{res.status.replace("_", " ")}</p>
            </div>
          );
        })}
        {filteredInvalid.map((b) => (
          <div key={b.id} className="rounded-xl bg-yellow-600/10 border border-yellow-500/30 p-4">
            <p className="text-sm font-semibold text-yellow-100">Invalid budget – {b.categoryId}</p>
            <button onClick={() => deleteBudget(b.id)} className="mt-2 text-red-400">Delete</button>
          </div>
        ))}
        {filteredValid.length === 0 && filteredInvalid.length === 0 && (
          <div className="text-center text-white/40 py-8">No budgets for this month.</div>
        )}
      </section>

      <Overlay open={formOpen} onClose={() => setFormOpen(false)} z={Z.sheet} label={editId ? "Edit Budget" : "Add Budget"}>
        <GrabHandle />
        <div className="px-5 pb-6 pt-1">
          <h2 className="text-lg font-bold mb-2">{editId ? "Edit" : "Create"} Budget</h2>
          {formError && <p className="text-red-400 mb-2">{formError}</p>}
          <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
          <select value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded p-2 mb-3 text-white">
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <label className="block text-sm font-medium text-white/70 mb-1">Amount</label>
          <input type="text" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded p-2 mb-3 text-white" />
          <label className="block text-sm font-medium text-white/70 mb-1">Count from</label>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center space-x-2">
              <input type="radio" name="start" value="today" checked={startDateOption === "today"} onChange={() => setStartDateOption("today")} />
              <span>Today</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" name="start" value="first_month" checked={startDateOption === "first_month"} onChange={() => setStartDateOption("first_month")} />
              <span>From 1st of month</span>
            </label>
          </div>
          <button onClick={submitForm} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition">
            {editId ? "Save Changes" : "Create Budget"}
          </button>
        </div>
      </Overlay>
    </main>
  );
}
