"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, Trophy, Check,
  Coffee, Zap, ShoppingBag, Home, Receipt,
  Smartphone, Building, LayoutGrid, Clock, Star,
  Plus, Minus, Wallet, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import Money from "@/components/Money";
import { useFinanceStore, type Goal } from "@/store/useFinanceStore";
import {
  goalSavingsTotal, goalRemaining,
  daysUntilDeadline,
  goalSavingsForGoal, suggestedMonthlySaving
} from "@/lib/goal";
import Toast from "@/components/Toast";

function catIcon(cat?: string) {
  const map: Record<string, React.ElementType> = {
    Food: Coffee,
    Transport: Zap,
    Shopping: ShoppingBag,
    Rent: Home,
    Hobby: Receipt,
    "Data Plan": Smartphone,
    Salary: Building,
    Other: LayoutGrid,
  };
  return map[cat ?? ""] ?? Trophy;
}

function deadlineLabel(deadline?: string): string {
  if (!deadline) return "No deadline";
  const diff = daysUntilDeadline(deadline);
  if (diff === Infinity) return "No deadline";
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `${diff} days left`;
}

function goalBucket(goal: Goal, saved: number): "active" | "completed" | "archived" {
  if (goal.status === "archived") return "archived";
  if (saved >= goal.target) return "completed";
  return "active";
}

function progressStatus(goal: Goal, saved: number) {
  const bucket = goalBucket(goal, saved);
  if (bucket === "archived") return { text: "Archived", color: "text-white/50", icon: Clock };
  if (goal.status === "paused") return { text: "Paused", color: "text-yellow-400", icon: Clock };
  if (bucket === "completed") return { text: "Completed", color: "text-green-400", icon: Check };
  const pct = saved / goal.target;
  if (pct >= 0.75) return { text: "On track", color: "text-blue-400", icon: Star };
  return { text: "In progress", color: "text-amber-300", icon: Trophy };
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function parseAmount(val: string): number {
  return parseInt(val.replace(/\D/g, ""), 10);
}

export default function GoalsPage() {
  const goals = useFinanceStore((s) => s.goals);
  const goalSavings = useFinanceStore((s) => s.goalSavings);
  const pockets = useFinanceStore((s) => s.pockets);
  const addGoal = useFinanceStore((s) => s.addGoal);
  const updateGoal = useFinanceStore((s) => s.updateGoal);
  const deleteGoal = useFinanceStore((s) => s.deleteGoal);
  const addGoalSaving = useFinanceStore((s) => s.addGoalSaving);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const transfer = useFinanceStore((s) => s.transfer);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "archived">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [goalPocketId, setGoalPocketId] = useState<string>("");
  const [goalColor, setGoalColor] = useState("#3b82f6");
  const [goalIcon, setGoalIcon] = useState("Trophy");
  const [goalNote, setGoalNote] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [savingModal, setSavingModal] = useState<{ goal: Goal; type: "add" | "withdraw" } | null>(null);
  const [withdrawDestination, setWithdrawDestination] = useState<"wallet" | "expense">("wallet");
  const [savingAmount, setSavingAmount] = useState(0);
  const [savingNote, setSavingNote] = useState("");
  const [savingPocketId, setSavingPocketId] = useState("");
  const [savingDate, setSavingDate] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const savedOf = useCallback(
    (g: Goal) => goalSavingsTotal(goalSavingsForGoal(goalSavings, g.id)),
    [goalSavings]
  );
  const bucketOf = useCallback(
    (g: Goal) => goalBucket(g, savedOf(g)),
    [savedOf]
  );

  const filteredGoals = useMemo(
    () => goals.filter((g) => bucketOf(g) === activeTab),
    [goals, activeTab, bucketOf]
  );

  const activeGoals = useMemo(
    () => goals.filter((g) => bucketOf(g) === "active"),
    [goals, bucketOf]
  );
  const totalTarget = useMemo(
    () => activeGoals.reduce((sum, g) => sum + g.target, 0),
    [activeGoals]
  );
  const totalSaved = useMemo(
    () => activeGoals.reduce((sum, g) => sum + savedOf(g), 0),
    [activeGoals, savedOf]
  );

  const tabCounts = useMemo(() => {
    const counts = { active: 0, completed: 0, archived: 0 };
    goals.forEach((g) => {
      counts[bucketOf(g)] += 1;
    });
    return counts;
  }, [goals, bucketOf]);

  if (!mounted) return null;

  const totalProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const openAdd = () => {
    setEditingId(null);
    setGoalName("");
    setGoalTarget("");
    setGoalDeadline("");
    setGoalPocketId("");
    setGoalColor("#3b82f6");
    setGoalIcon("Trophy");
    setGoalNote("");
    setError("");
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setGoalName(goal.name);
    setGoalTarget(goal.target.toLocaleString("id-ID"));
    setGoalDeadline(goal.deadline ?? "");
    setGoalPocketId(goal.pocketId ?? "");
    setGoalColor(goal.color ?? "#3b82f6");
    setGoalIcon(goal.iconName ?? "Trophy");
    setGoalNote(goal.note ?? "");
    setError("");
    setFormOpen(true);
  };

  const saveGoal = () => {
    const name = goalName.trim();
    const target = parseInt(goalTarget.replace(/\D/g, ""), 10);
    if (!name) { setError("Name is required."); return; }
    if (!target || target <= 0) { setError("Target must be above Rp 0."); return; }
    if (!goalPocketId) { setError("Please select a wallet."); return; }

    const goal: Goal = {
      id: editingId ?? `goal-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name,
      target,
      deadline: goalDeadline || undefined,
      pocketId: goalPocketId,
      color: goalColor,
      iconName: goalIcon,
      note: goalNote.trim() || undefined,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    if (editingId) updateGoal(editingId, goal);
    else addGoal(goal);

    setFormOpen(false);
  };

  const openSavingModal = (goal: Goal, type: "add" | "withdraw") => {
    const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, goal.id));
    const remaining = goalRemaining(goal, saved);
    setSavingModal({ goal, type });
    setSavingAmount(0);
    setSavingNote("");
    setSavingPocketId(goal.pocketId || pockets[0]?.id || "");
    setSavingDate(new Date().toISOString().slice(0, 10));
    setWithdrawDestination("wallet");
    if (type === "add") {
      setSavingAmount(Math.min(remaining, Math.max(50000, Math.round(goal.target * 0.1))));
    } else {
      setSavingAmount(Math.min(saved, Math.max(50000, Math.round(saved * 0.5))));
    }
  };

  const closeSavingModal = () => {
    setSavingModal(null);
    setSavingAmount(0);
    setSavingNote("");
  };

  const handleSavingAmountChange = (val: string) => {
    const n = parseAmount(val);
    setSavingAmount(n);
  };

  const fillRemaining = () => {
    if (!savingModal) return;
    const { goal, type } = savingModal;
    const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, goal.id));
    if (type === "add") {
      const remaining = goalRemaining(goal, saved);
      setSavingAmount(remaining);
    } else {
      setSavingAmount(saved);
    }
  };

  const quickAdd = (amt: number) => {
    if (!savingModal) return;
    const { goal, type } = savingModal;
    const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, goal.id));
    if (type === "add") {
      const remaining = goalRemaining(goal, saved);
      setSavingAmount(prev => Math.min(remaining, prev + amt));
    } else {
      setSavingAmount(prev => Math.min(saved, prev + amt));
    }
  };

  const quickPercent = (pct: number) => {
    if (!savingModal) return;
    const { goal, type } = savingModal;
    const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, goal.id));
    if (type === "add") {
      const remaining = goalRemaining(goal, saved);
      setSavingAmount(Math.round(remaining * pct));
    } else {
      setSavingAmount(Math.round(saved * pct));
    }
  };

  const confirmSaving = () => {
    if (!savingModal || savingBusy) return;
    const { goal, type } = savingModal;
    const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, goal.id));
    const remaining = goalRemaining(goal, saved);

    if (savingAmount <= 0) { setToast("Amount must be greater than zero."); return; }

    if (!goal.pocketId) {
      setToast("Choose where this goal's money is kept first.");
      return;
    }

    if (type === "add") {
      if (savingAmount > remaining) {
        setToast(`Amount exceeds remaining needed (${formatIDR(remaining)}). Capped to remaining.`);
        setSavingAmount(remaining);
        return;
      }
      if (!savingPocketId) { setToast("Select a wallet."); return; }
      if (savingPocketId === goal.pocketId) { setToast("Source wallet must differ from the goal wallet."); return; }
      const sourcePocket = pockets.find(p => p.id === savingPocketId);
      if (!sourcePocket) { setToast("Wallet not found."); return; }
      if (savingAmount > sourcePocket.balance) { setToast("Insufficient wallet balance."); return; }

      setSavingBusy(true);
      // Transfer source → goal wallet, linked to goal
      transfer(
        savingPocketId,
        goal.pocketId,
        savingAmount,
        goal.id,
        savingNote.trim() || `Saved to ${goal.name}`
      );
      addGoalSaving({
        id: `gs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        goalId: goal.id,
        amount: savingAmount,
        pocketId: savingPocketId,
        date: savingDate,
        note: savingNote.trim() || `Saved to ${goal.name}`,
      });
      setToast(`Saved ${formatIDR(savingAmount)} to ${goal.name}`);
    } else {
      // Withdraw
      if (savingAmount > saved) { setToast("Cannot withdraw more than saved."); return; }

      if (withdrawDestination === "wallet") {
        if (!savingPocketId) { setToast("Select a wallet."); return; }
        if (savingPocketId === goal.pocketId) { setToast("Destination wallet must differ from the goal wallet."); return; }
        const destPocket = pockets.find(p => p.id === savingPocketId);
        if (!destPocket) { setToast("Wallet not found."); return; }

        setSavingBusy(true);
        transfer(
          goal.pocketId,
          savingPocketId,
          savingAmount,
          goal.id,
          savingNote.trim() || `Withdrawn from ${goal.name}`
        );
        addGoalSaving({
          id: `gs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          goalId: goal.id,
          amount: -savingAmount,
          pocketId: goal.pocketId,
          date: savingDate,
          note: savingNote.trim() || `Withdrawn from ${goal.name}`,
        });
        setToast(`Withdrew ${formatIDR(savingAmount)} to wallet`);
      } else {
        // Withdraw as expense, paid from the goal wallet
        const cat = ["Food", "Transport", "Shopping", "Rent", "Hobby", "Data Plan", "Salary", "Other"][0];
        const goalWalletBalance = pockets.find(p => p.id === goal.pocketId)?.balance ?? 0;
        if (savingAmount > goalWalletBalance) { setToast("Not enough balance in the goal wallet."); return; }

        setSavingBusy(true);
        addTransaction({
          id: `txn-${Date.now()}`,
          name: savingNote.trim() || "Expense",
          category: cat,
          amount: savingAmount,
          isExpense: true,
          pocketId: goal.pocketId,
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
          date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }),
        });
        updatePocketBalance(goal.pocketId, goalWalletBalance - savingAmount);
        addGoalSaving({
          id: `gs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          goalId: goal.id,
          amount: -savingAmount,
          pocketId: goal.pocketId,
          date: savingDate,
          note: savingNote.trim() || `Expense: ${cat}`,
        });
        setToast(`Withdrew ${formatIDR(savingAmount)} as ${cat} expense`);
      }
    }
    closeSavingModal();
    setSavingBusy(false);
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
          <Link href="/" aria-label="Back home" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/15 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1">Savings targets</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      {/* Summary */}
      <section className="rounded-3xl bg-white/5 border border-white/10 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-blue-500" />
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Overall progress</p>
          <span className="ml-auto text-xs font-bold text-white/70">{totalProgress}%</span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <Money value={totalSaved} className="text-2xl font-bold tracking-tight" />
          <span className="text-sm text-white/40">of <Money value={totalTarget} /></span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mt-3" role="progressbar" aria-valuenow={totalProgress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${totalProgress}%` }} />
        </div>
      </section>

      {/* Overall progress now shows for active goals per the summary above */}

      {/* Tabs & Add */}

      {/* Tabs & Add */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 flex-1 mr-3">
          {(["active", "completed", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition",
                activeTab === tab ? "bg-blue-600 text-white" : "text-white/50 hover:text-white"
              )}
            >
              {tab}
              <span className="ml-1 text-[10px] opacity-60">{tabCounts[tab]}</span>
            </button>
          ))}
        </div>
        <button onClick={openAdd} aria-label="Add goal" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-500 active:scale-90 transition shrink-0">
          <Trophy className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* List */}
      {filteredGoals.length === 0 ? (
        <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
          <Trophy className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-semibold">{activeTab === "active" ? "No active goals yet" : activeTab === "completed" ? "No completed goals yet" : "No archived goals"}</p>
          <p className="text-xs text-white/40 mt-1 mb-4">{activeTab === "active" ? "Set a savings target to get started." : "Goals show up here when their status changes."}</p>
          <button onClick={openAdd} className="px-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition">
            Create goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGoals.map((g) => {
            const savingsForGoal = goalSavingsForGoal(goalSavings, g.id);
            const saved = goalSavingsTotal(savingsForGoal);
            const remaining = goalRemaining(g, saved);
            const progress = g.target ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
            const bucket = goalBucket(g, saved);
            const isDone = bucket === "completed";
            const { text, color } = progressStatus(g, saved);
            const Icon = catIcon(g.iconName);
            const suggestion = suggestedMonthlySaving(g.id, savingsForGoal);

            return (
              <div key={g.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" style={{ color: g.color || "#3b82f6" }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{g.name}</p>
                      <p className="text-xs text-white/40 shrink-0">{progress}%</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                      <Money value={saved} className="text-sm font-bold" />
                      <span className="text-xs text-white/40">of <Money value={g.target} /></span>
                      <span className={cn("ml-auto text-xs font-semibold", color)}>{text}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mt-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>

                {savingsForGoal.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-white/40 cursor-pointer hover:text-white/60 list-none">
                      History ({savingsForGoal.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {savingsForGoal.slice().reverse().map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-white/50 truncate">
                            {s.note?.startsWith("From income") ? "From income" : s.note || (s.amount > 0 ? "Deposit" : "Withdrawal")}
                          </span>
                          <span className={cn("font-semibold shrink-0 ml-2", s.amount > 0 ? "text-green-400" : "text-red-400")}>
                            {s.amount > 0 ? "+" : "−"}<Money value={Math.abs(s.amount)} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex items-center justify-between text-xs mt-2 text-white/40">
                  <span>
                    {isDone ? `Reached on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : deadlineLabel(g.deadline)}
                  </span>
                  <span>
                    {isDone ? (
                      saved > g.target
                        ? <span className="text-amber-400 font-semibold">Over by <Money value={saved - g.target} className="text-amber-400 font-semibold" /></span>
                        : <span>Completed</span>
                    ) : (
                      <>Left: <Money value={remaining} className="font-semibold text-white/80" /></>
                    )}
                  </span>
                </div>

                {!isDone && suggestion && (
                  <p className="text-[11px] text-blue-400 mt-2">💡 Suggested monthly save: Rp {suggestion.toLocaleString("id-ID")}</p>
                )}

                <div className="flex items-stretch gap-2 mt-3 pt-3 border-t border-white/5">
                  {bucket === "active" && (
                    <>
                      <button
                        onClick={() => openSavingModal(g, "add")}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-semibold whitespace-nowrap hover:bg-green-500/20 transition"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" /> Add
                      </button>
                      <button
                        onClick={() => openSavingModal(g, "withdraw")}
                        className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold whitespace-nowrap hover:bg-red-500/20 transition"
                      >
                        <Minus className="w-3.5 h-3.5 shrink-0" /> Withdraw
                      </button>
                    </>
                  )}
                  {bucket === "active" && (
                    <button
                      onClick={() => setConfirmArchive(g.id)}
                      className="min-h-[44px] flex items-center justify-center px-2 text-xs font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Archive
                    </button>
                  )}
                  {bucket === "completed" && (
                    <button
                      onClick={() => setConfirmArchive(g.id)}
                      className="min-h-[44px] flex items-center justify-center px-2 text-xs font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Archive
                    </button>
                  )}
                  {bucket === "archived" && (
                    <button
                      onClick={() => {
                        if (confirm("Restore this goal? It will move back to Active.")) {
                          updateGoal(g.id, { status: "active" });
                        }
                      }}
                      className="min-h-[44px] flex items-center justify-center px-2 text-xs font-semibold text-green-400 hover:text-green-300"
                    >
                      Restore
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(g)}
                    className="min-h-[44px] flex items-center justify-center px-2 text-xs font-semibold text-white/50 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(g.id)}
                    className="min-h-[44px] flex items-center justify-center px-2 text-xs font-semibold text-red-400/80 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet: Create/Edit Goal */}
      <Overlay open={formOpen} onClose={() => setFormOpen(false)} z={Z.sheet} label={editingId ? "Edit goal" : "Add goal"}>
        <GrabHandle />
        <div className="px-5 pb-6 pt-1 overflow-y-auto">
          <h2 className="text-lg font-bold mb-1">{editingId ? "Edit goal" : "New goal"}</h2>
          <p className="text-xs text-white/40 mb-4">Set a savings target</p>

          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="goal-name">Goal name</label>
          <input
            id="goal-name"
            type="text"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder="e.g. New Laptop"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[48px]"
          />

          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="goal-target">Target amount</label>
          <div className="relative mt-1 mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rp</span>
            <input
              id="goal-target"
              type="text"
              inputMode="numeric"
              value={goalTarget}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
                setGoalTarget(digits ? Number(digits).toLocaleString("id-ID") : "");
              }}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white min-h-[48px]"
            />
          </div>

          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="goal-deadline">Deadline (optional)</label>
          <input
            id="goal-deadline"
            type="date"
            value={goalDeadline}
            onChange={(e) => setGoalDeadline(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[48px]"
          />

          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="goal-pocket">Save into wallet</label>
          <p className="text-[10px] text-white/30 leading-tight mb-1">This is where the money for this goal is kept.</p>
          <select
            id="goal-pocket"
            value={goalPocketId}
            onChange={(e) => setGoalPocketId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mb-4 min-h-[48px]"
          >
            <option value="">Select wallet</option>
            {pockets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-white/40 uppercase">Color</label>
              <input
                type="color"
                value={goalColor}
                onChange={(e) => setGoalColor(e.target.value)}
                className="w-full h-12 bg-transparent cursor-pointer rounded-xl mt-1"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-white/40 uppercase">Icon</label>
              <select
                value={goalIcon}
                onChange={(e) => setGoalIcon(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 min-h-[48px]"
              >
                <option value="Trophy">Trophy</option>
                <option value="Wallet">Wallet</option>
                <option value="Home">Home</option>
                <option value="ShoppingBag">Shopping</option>
                <option value="Coffee">Food</option>
              </select>
            </div>
          </div>

          <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="goal-note">Notes (optional)</label>
          <textarea
            id="goal-note"
            value={goalNote}
            onChange={(e) => setGoalNote(e.target.value)}
            placeholder="Add details..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[80px]"
          />

          {error && <p role="alert" className="text-xs text-red-400 mb-3">{error}</p>}

          <button onClick={saveGoal} className="w-full h-12 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 active:scale-[0.98] transition">
            {editingId ? "Save changes" : "Create goal"}
          </button>
        </div>
      </Overlay>

      {/* Sheet: Add Savings / Withdraw */}
      <Overlay open={!!savingModal} onClose={closeSavingModal} z={Z.sheet} label={savingModal?.type === "add" ? "Add savings" : "Withdraw"}>
        <GrabHandle />
        {savingModal && (
          <div className="px-5 pb-6 pt-1 overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">{savingModal.type === "add" ? "Add savings" : "Withdraw"}</h2>
            <p className="text-xs text-white/40 mb-4">{savingModal.goal.name}</p>

            {(() => {
              const saved = goalSavingsTotal(goalSavingsForGoal(goalSavings, savingModal.goal.id));
              const remaining = goalRemaining(savingModal.goal, saved);
              if (savingModal.type === "add") {
                return (
                  <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <div className="flex justify-between mb-1"><span className="text-white/40">Saved</span><span className="font-bold"><Money value={saved} /></span></div>
                    <div className="flex justify-between"><span className="text-white/40">Remaining</span><span className="font-bold"><Money value={remaining} /></span></div>
                  </div>
                );
              } else {
                return (
                  <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <div className="flex justify-between mb-1"><span className="text-white/40">Saved</span><span className="font-bold"><Money value={saved} /></span></div>
                    <div className="flex justify-between"><span className="text-white/40">After withdraw</span><span className="font-bold"><Money value={saved - savingAmount} /></span></div>
                  </div>
                );
              }
            })()}

            <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="saving-amount">Amount</label>
            <div className="relative mt-1 mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rp</span>
              <input
                id="saving-amount"
                type="text"
                inputMode="numeric"
                value={savingAmount ? formatIDR(savingAmount) : ""}
                onChange={(e) => handleSavingAmountChange(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white min-h-[48px]"
              />
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {savingModal.type === "add" ? (
                <>
                  <button type="button" onClick={() => quickAdd(50000)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">+50K</button>
                  <button type="button" onClick={() => quickAdd(100000)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">+100K</button>
                  <button type="button" onClick={() => quickAdd(500000)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">+500K</button>
                  <button type="button" onClick={fillRemaining} className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 text-xs font-semibold hover:bg-blue-600/20">Fill remaining</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => quickPercent(0.25)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">25%</button>
                  <button type="button" onClick={() => quickPercent(0.5)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">50%</button>
                  <button type="button" onClick={() => quickPercent(1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">All</button>
                </>
              )}
            </div>

<label className="text-xs font-semibold text-white/40 uppercase" htmlFor="saving-pocket">From wallet</label>
            <p className="text-[10px] text-white/30 leading-tight mb-1">Money will be moved to: {pockets.find(p => p.id === savingModal.goal.pocketId)?.name}</p>
            <select
              id="saving-pocket"
              value={savingPocketId}
              onChange={(e) => setSavingPocketId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[48px]"
            >
              <option value="">Select wallet</option>
              {pockets.filter(p => p.id !== savingModal.goal.pocketId).map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Balance: {formatIDR(p.balance)})</option>
              ))}
            </select>

            <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="saving-date">Date</label>
            <input
              id="saving-date"
              type="date"
              value={savingDate}
              onChange={(e) => setSavingDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[48px]"
            />

            {savingModal.type === "withdraw" && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-white/40 uppercase mb-2">Destination</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWithdrawDestination("wallet")}
                    className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition", withdrawDestination === "wallet" ? "bg-blue-600 text-white" : "bg-white/5 border border-white/10 text-white/70")}
                  >
                    <Wallet className="w-4 h-4 mr-1 inline" /> Return to wallet
                  </button>
                  <button
                    onClick={() => setWithdrawDestination("expense")}
                    className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold transition", withdrawDestination === "expense" ? "bg-amber-600 text-white" : "bg-white/5 border border-white/10 text-white/70")}
                  >
                    <X className="w-4 h-4 mr-1 inline" /> Use for expense
                  </button>
                </div>
              </div>
            )}

            <label className="text-xs font-semibold text-white/40 uppercase" htmlFor="saving-note">Note (optional)</label>
            <textarea
              id="saving-note"
              value={savingNote}
              onChange={(e) => setSavingNote(e.target.value)}
              placeholder="Add details..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white mt-1 mb-4 min-h-[80px]"
            />

            <div className="flex gap-2">
              <button onClick={closeSavingModal} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm">Cancel</button>
              <button onClick={confirmSaving} className={cn("flex-1 h-11 rounded-xl font-semibold text-sm", savingModal.type === "add" ? "bg-green-600" : "bg-red-600")}>
                {savingModal.type === "add" ? "Add Savings" : "Withdraw"}
              </button>
            </div>
          </div>
        )}
      </Overlay>

      {/* Confirm Delete */}
      <Overlay open={!!confirmDelete} onClose={() => setConfirmDelete(null)} z={Z.confirm} label="Delete goal" variant="modal">
        <div className="p-5">
          <h2 className="text-base font-bold mb-1">Delete this goal?</h2>
          <p className="text-xs text-white/50 mb-4">Saved funds remain in your wallet.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm">Cancel</button>
            <button onClick={() => { if (confirmDelete) deleteGoal(confirmDelete); setConfirmDelete(null); }} className="flex-1 h-11 rounded-xl bg-red-600 font-semibold text-sm">Delete</button>
          </div>
        </div>
      </Overlay>

      {/* Confirm Archive */}
      <Overlay open={!!confirmArchive} onClose={() => setConfirmArchive(null)} z={Z.confirm} label="Archive goal" variant="modal">
        <div className="p-5">
          <h2 className="text-base font-bold mb-1">Archive this goal?</h2>
          <p className="text-xs text-white/50 mb-4">It will be moved to the Archived tab and no longer count toward active progress.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmArchive(null)} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm">Cancel</button>
            <button onClick={() => { if (confirmArchive) updateGoal(confirmArchive, { status: "archived" }); setConfirmArchive(null); }} className="flex-1 h-11 rounded-xl bg-amber-600 font-semibold text-sm">Archive</button>
          </div>
        </div>
      </Overlay>

      {toast && <Toast message={toast} />}
    </motion.main>
  );
}