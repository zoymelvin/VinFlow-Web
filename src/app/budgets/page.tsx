"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Calendar,
  BarChart3, Wallet, Coffee, Zap, ShoppingBag, Home,
  Receipt, Smartphone, Building, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import Money from "@/components/Money";
import { useFinanceStore, type Budget } from "@/store/useFinanceStore";
import {
  spentByCategory, spentTotal, statusPct, safeToSpend,
  currentPeriod, paceProjection, formatIDR,
} from "@/lib/budget";

const CATS = [
  { id: "Food", label: "Food", icon: Coffee },
  { id: "Transport", label: "Transport", icon: Zap },
  { id: "Shopping", label: "Shopping", icon: ShoppingBag },
  { id: "Rent", label: "Rent", icon: Home },
  { id: "Hobby", label: "Hobby", icon: Receipt },
  { id: "Data Plan", label: "Data Plan", icon: Smartphone },
  { id: "Salary", label: "Salary", icon: Building },
  { id: "Other", label: "Other", icon: LayoutGrid },
];

function catIcon(cat: string) {
  return CATS.find((c) => c.id === cat)?.icon ?? LayoutGrid;
}

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function statusLine(pct: number): string {
  if (pct >= 120) return "Way over budget — time to review spending";
  if (pct >= 110) return "Over budget — consider cutting back";
  if (pct >= 100) return "At the limit — nice tracking";
  if (pct >= 90) return "Almost there — you're doing great";
  if (pct >= 75) return "Good pace — keep it up";
  return "Well within budget — excellent";
}

function barColor(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "bg-red-500";
  if (status === "warning") return "bg-amber-400";
  return "bg-blue-500";
}

function statusLabel(status: "ok" | "warning" | "exceeded"): { text: string; cls: string } {
  if (status === "exceeded") return { text: "Exceeded", cls: "text-red-400" };
  if (status === "warning") return { text: "Near limit", cls: "text-amber-400" };
  return { text: "On track", cls: "text-green-400" };
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState("Food");
  const [amountInput, setAmountInput] = useState("");
  const [onward, setOnward] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  const budgets = useMemo(
    () => budgetsRaw.filter((b) => b.period === period),
    [budgetsRaw, period]
  );
  const totalRec = budgets.find((b) => b.category === "__total__");
  const catBudgets = useMemo(
    () => budgets.filter((b) => b.category !== "__total__").sort((a, b) => {
      const sa = a.amount ? spentByCategory(transactions, a.category, period) / a.amount : 0;
      const sb = b.amount ? spentByCategory(transactions, b.category, period) / b.amount : 0;
      return sb - sa;
    }),
    [budgets, transactions, period]
  );
  const totalSpent = useMemo(() => spentTotal(transactions, period), [transactions, period]);
  const totalStatus = totalRec ? statusPct(totalSpent, totalRec.amount) : "ok";
  const totalPctVal = totalRec ? Math.round((totalSpent / totalRec.amount) * 100) : 0;
  const pace = totalRec ? paceProjection(totalSpent, totalRec.amount, period) : null;
  const safeDay = totalRec ? safeToSpend(totalSpent, totalRec.amount, period) : 0;

  const avgSuggestion = useMemo(() => {
    if (categoryInput === "__total__" || !categoryInput) return null;
    const vals: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const sum = spentByCategory(transactions, categoryInput, shiftPeriod(period, -i));
      if (sum > 0) vals.push(sum);
    }
    if (vals.length < 2) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [categoryInput, transactions, period]);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isCurrent = period === currentPeriod();

  const openAdd = (cat = "Food") => {
    setEditingId(null);
    setCategoryInput(cat);
    setAmountInput("");
    setError("");
    setFormOpen(true);
  };
  const openEdit = (b: Budget) => {
    setEditingId(b.id);
    setCategoryInput(b.category === "__total__" ? "__total__" : b.category);
    setAmountInput(b.amount.toLocaleString("id-ID"));
    setError("");
    setFormOpen(true);
  };

  const saveBudget = () => {
    const amount = parseInt(amountInput.replace(/\D/g, ""), 10);
    if (!amount || amount <= 0) { setError("Enter an amount above Rp 0."); return; }
    const isTotal = categoryInput === "__total__";
    const dup = budgets.some((b) => b.category === categoryInput && b.id !== editingId);
    if (dup) { setError(isTotal ? "Total budget already exists this month." : `Budget for ${categoryInput} already exists this month.`); return; }
    if (editingId) {
      updateBudget(editingId, { category: categoryInput, amount });
    } else {
      addBudget({
        id: `budget-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        category: categoryInput,
        amount,
        period,
      });
    }

    if (onward) {
      for (let i = 1; i <= 11; i++) {
        const nextPeriod = shiftPeriod(period, i);
        const existing = budgetsRaw.find((b) => b.period === nextPeriod && b.category === categoryInput);
        if (existing) {
          updateBudget(existing.id, { amount });
        } else {
          addBudget({
            id: `budget-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`,
            category: categoryInput,
            amount,
            period: nextPeriod,
          });
        }
      }
    }
    setFormOpen(false);
    setEditingId(null);
    setAmountInput("");
    setError("");
  };

  const copyLastMonth = () => {
    const last = shiftPeriod(period, -1);
    budgetsRaw.filter((b) => b.period === last).forEach((b) => {
      const exists = budgetsRaw.some((x) => x.period === period && x.category === b.category);
      if (!exists) {
        addBudget({ id: `budget-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, category: b.category, amount: b.amount, period });
      }
    });
  };

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="relative mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/" aria-label="Back home" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1">Monthly spending limits</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      {/* Period nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Previous month" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white/80 min-w-[92px] text-center">{periodLabel(period)}</span>
          <button onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Next month" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {!isCurrent && (
          <button onClick={() => setPeriod(currentPeriod())} className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/20 transition">
            This month
          </button>
        )}
      </div>

      {/* Summary */}
      <section className="rounded-3xl bg-white/5 border border-white/10 p-5 mb-4" aria-label="Budget summary">
        {totalRec ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-blue-500" />
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Total budget</p>
              <span className={cn("ml-auto text-xs font-semibold", statusLabel(totalStatus).cls)}>
                {statusLabel(totalStatus).text}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <Money value={totalSpent} className="text-2xl font-bold tracking-tight" />
              <span className="text-sm text-white/40">of <Money value={totalRec.amount} /></span>
              <span className="ml-auto text-sm font-bold text-white/70">{totalPctVal}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mt-3" role="progressbar" aria-valuenow={Math.min(100, totalPctVal)} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full transition-all duration-500", barColor(totalStatus))} style={{ width: `${Math.min(100, totalPctVal)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-white/40">Safe to spend/day</span>
              <Money value={safeDay} className="font-bold" />
            </div>
            <p className="text-xs text-white/50 mt-2">{statusLine(totalPctVal)}</p>
             {pace && (
               <div className="flex items-center gap-2 mt-3 text-xs">
                 <span className="text-white/40">Pace:</span>
                 <span className={cn("text-sm font-semibold", pace.willExceed ? "text-red-400" : "text-green-400")}>
                   {pace.willExceed ? `Will exceed by ${formatIDR(pace.overBy)}` : "On track to stay within"}
                 </span>
               </div>
             )}
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-semibold">No total budget yet</p>
            <p className="text-xs text-white/40 mt-1">Category budgets still work, but set a total to see daily pace.</p>
            <button onClick={() => openAdd("__total__")} className="mt-3 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-95 transition">
              Set total budget
            </button>
          </div>
        )}
      </section>

      {/* Category list */}
      <section className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Category budgets</h2>
        <div className="flex items-center gap-2">
          <button onClick={copyLastMonth} aria-label="Copy last month" title="Copy last month" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 active:scale-90 transition">
            <Calendar className="w-4 h-4" />
          </button>
          <button onClick={() => openAdd()} aria-label="Add budget" className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-500 active:scale-90 transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      {catBudgets.length === 0 ? (
        <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-semibold">No category budgets</p>
          <p className="text-xs text-white/40 mt-1 mb-4">Set limits per category. Copy last month to start fast.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => openAdd()} className="px-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-95 transition min-h-[44px]">
              Add budget
            </button>
            <button onClick={copyLastMonth} className="px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 active:scale-95 transition min-h-[44px]">
              Copy last month
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {catBudgets.map((b) => {
            const spent = spentByCategory(transactions, b.category, period);
            const st = statusPct(spent, b.amount);
            const pct = b.amount ? Math.round((spent / b.amount) * 100) : 0;
            const Icon = catIcon(b.category);
            const over = Math.max(0, spent - b.amount);
            const sl = statusLabel(st);
            return (
              <li
                key={b.id}
                onClick={() => setSelectedBudget(b)}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 cursor-pointer hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{b.category}</p>
                      <p className="text-xs text-white/40 shrink-0">{pct}%</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                      <Money value={spent} className="text-sm font-bold" />
                      <span className="text-xs text-white/40">of <Money value={b.amount} /></span>
                      <span className={cn("ml-auto text-xs font-semibold", sl.cls)}>{sl.text}</span>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mt-3" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.category} budget progress`}>
                  <div className={cn("h-full transition-all duration-500", barColor(st))} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-white/40">
                    {st === "exceeded" ? <>Over by <Money value={over} className="text-red-400 font-semibold" /></> : <><Money value={b.amount - spent} className="font-semibold" /> left</>}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/transaksi?cat=${encodeURIComponent(b.category)}`} className="text-xs font-semibold text-blue-400 hover:text-blue-300 min-h-[32px] flex items-center px-2">
                      + Add
                    </Link>
                    <button onClick={() => openEdit(b)} aria-label={`Edit ${b.category} budget`} className="text-xs font-semibold text-white/50 hover:text-white min-h-[32px] px-2">Edit</button>
                    <button onClick={() => setConfirmDelete(b.id)} aria-label={`Delete ${b.category} budget`} className="text-xs font-semibold text-red-400/80 hover:text-red-300 min-h-[32px] px-2">Delete</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-white/30 mt-4 leading-relaxed">
        Total budget always applies, even without category budgets. Goal savings never count as spending. Uncategorized transactions count toward total only.
      </p>

      {/* Add/Edit sheet */}
      <Overlay open={formOpen} onClose={() => setFormOpen(false)} z={Z.sheet} label={editingId ? "Edit budget" : "Add budget"}>
        <GrabHandle />
        <div className="px-5 pb-6 pt-1 overflow-y-auto">
          <h2 className="text-lg font-bold mb-1">{editingId ? "Edit budget" : "Add budget"}</h2>
          <p className="text-xs text-white/40 mb-4">{periodLabel(period)}{isCurrent ? " · current month" : ""}</p>
          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="budget-cat">Category</label>
          <select
            id="budget-cat"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[48px]"
          >
            <option value="__total__">Total (all spending)</option>
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="budget-amt">Monthly limit</label>
          <div className="relative mt-1 mb-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rp</span>
            <input
              id="budget-amt"
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
                setAmountInput(digits ? Number(digits).toLocaleString("id-ID") : "");
              }}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white min-h-[48px]"
            />
          </div>
          {avgSuggestion !== null && (
            <button
              type="button"
              onClick={() => setAmountInput(avgSuggestion.toLocaleString("id-ID"))}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 mb-3"
            >
              Use 3-month average: Rp {avgSuggestion.toLocaleString("id-ID")}
            </button>
          )}
          {error && <p role="alert" className="text-xs text-red-400 mb-3">{error}</p>}
          <label className="flex items-center gap-2 mt-3 text-xs">
            <input type="checkbox" checked={onward} onChange={(e) => setOnward(e.target.checked)} className="w-3.5 h-3.5 rounded bg-white/5 border border-white/10" />
            <span className="text-white/60">Apply to next 11 months</span>
          </label>
          <button onClick={saveBudget} className="w-full h-12 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 active:scale-[0.98] transition mt-3">
            {editingId ? "Save changes" : "Add budget"}
          </button>
        </div>
      </Overlay>

      {/* Delete confirm */}
      <Overlay open={!!confirmDelete} onClose={() => setConfirmDelete(null)} z={Z.confirm} label="Delete budget" variant="modal">
        <div className="p-5">
          <h2 className="text-base font-bold mb-1">Delete this budget?</h2>
          <p className="text-xs text-white/50 mb-4">Past spending stays. Only the limit is removed.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm active:scale-95 transition">Cancel</button>
            <button
              onClick={() => { if (confirmDelete) deleteBudget(confirmDelete); setConfirmDelete(null); }}
              className="flex-1 h-11 rounded-xl bg-red-600 font-semibold text-sm active:scale-95 transition"
            >
              Delete
            </button>
          </div>
        </div>
      </Overlay>

      {/* Detail view sheet */}
      <Overlay open={!!selectedBudget} onClose={() => setSelectedBudget(null)} z={Z.sheet} label="Budget Details">
        <GrabHandle />
        {selectedBudget && (() => {
          const spent = spentByCategory(transactions, selectedBudget.category, period);
          const pct = selectedBudget.amount ? Math.round((spent / selectedBudget.amount) * 100) : 0;
          const st = statusPct(spent, selectedBudget.amount);
          const sl = statusLabel(st);
          const txns = transactions.filter((t) => t.isExpense && t.category === selectedBudget.category && t.date.startsWith(period));

          return (
            <div className="px-5 pb-6 pt-1 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">{selectedBudget.category}</h2>
                <span className={cn("text-xs font-semibold px-2 py-1 rounded-full bg-white/5", sl.cls)}>
                  {sl.text}
                </span>
              </div>
              <p className="text-xs text-white/40 mb-4">{periodLabel(period)}</p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-white/40">Spent</span>
                  <div className="text-right">
                    <Money value={spent} className="text-lg font-bold" />
                    <span className="text-xs text-white/40"> of <Money value={selectedBudget.amount} /></span>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
                  <div className={cn("h-full transition-all", barColor(st))} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="text-right text-xs text-white/50">{pct}% used</div>
              </div>

              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    const b = selectedBudget;
                    setSelectedBudget(null);
                    openEdit(b);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-semibold hover:bg-white/15"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    const id = selectedBudget.id;
                    setSelectedBudget(null);
                    setConfirmDelete(id);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Contributing Transactions</h3>
              {txns.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-4">No spending yet this month</p>
              ) : (
                <div className="space-y-2">
                  {txns.map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-white/40">{t.date}</p>
                      </div>
                      <Money value={t.amount} className="text-sm font-bold text-white" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </Overlay>

      <AnimatePresence />
    </motion.main>
  );
}
