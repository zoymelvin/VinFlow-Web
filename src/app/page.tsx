"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Wallet, Bell, PieChart, Trophy, CalendarClock, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getGreeting } from "@/lib/settings";
import { parseDateStr } from "@/lib/insights/utils";
import { budgetAlertKeys, currentPeriod } from "@/lib/budget";
import CategoryIcon from "@/components/CategoryIcon";
import Money from "@/components/Money";

export default function DashboardPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const profile = useSettingsStore((s) => s.profile);
  const budgetAlerts = useFinanceStore((s) => s.budgetAlerts);
  const seenBudgetAlerts = useFinanceStore((s) => s.seenBudgetAlerts);
  const addBudgetAlert = useFinanceStore((s) => s.addBudgetAlert);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    if (!hasMounted) return;
    const keys = budgetAlertKeys(budgets, transactions, currentPeriod());
    keys.forEach((k) => addBudgetAlert(k));
  }, [budgets, transactions, hasMounted, addBudgetAlert]);

  if (!hasMounted) return null;

  const name = profile.name;
  const greeting = getGreeting(new Date().getHours());

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthTxns = transactions.filter((t) => parseDateStr(t.date) >= monthStart);

  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0);
  const monthExpense = monthTxns
    .filter((t) => t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const monthIncome = monthTxns
    .filter((t) => !t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);
  const recent = transactions.slice(0, 4);
  const unviewedCount = transactions.filter((t) => !t.viewed).length;
  const unseenBudgetAlerts = budgetAlerts.filter((k) => !seenBudgetAlerts.includes(k)).length;
  const totalUnseen = unviewedCount + unseenBudgetAlerts;

  return (
<motion.main
       className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.3 }}
     >


      {/* Header — minimal: greeting + name, bell only action */}
      <header className="relative mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white truncate">{name}</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1">{greeting}</p>
          </div>
          <Link
            href="/notifikasi"
            className="relative w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {totalUnseen > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </Link>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      {/* Balance */}
      <section className="relative mb-6 bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-blue-500" />
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Total Balance</p>
        </div>
        <Money value={totalBalance} className="text-3xl font-bold tracking-tight text-white" />
      </section>

      {/* Income / Expense */}
      <section className="relative grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Income</p>
            <span className="w-6 h-6 rounded-lg bg-green-500/12 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-green-500" strokeWidth={2.5} />
            </span>
          </div>
          <Money value={monthIncome} className="text-lg font-bold tracking-tight text-white" />
          <p className="text-[11px] text-white/40 mt-0.5">This month</p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Expense</p>
            <span className="w-6 h-6 rounded-lg bg-red-500/12 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-red-500" strokeWidth={2.5} />
            </span>
          </div>
          <Money value={monthExpense} className="text-lg font-bold tracking-tight text-white" />
          <p className="text-[11px] text-white/40 mt-0.5">This month</p>
        </div>
      </section>

      {/* Actions */}
      <section className="relative grid grid-cols-4 gap-3 mb-8">
        <Link
          href="/budgets"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <PieChart className="w-6 h-6 text-blue-400" />
          <span className="text-xs text-white/70 font-medium mt-2">Budgets</span>
        </Link>
        <Link
          href="/goals"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="text-xs text-white/70 font-medium mt-2">Goals</span>
        </Link>
        <Link
          href="/bills"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <CalendarClock className="w-6 h-6 text-blue-400" />
          <span className="text-xs text-white/70 font-medium mt-2">Bills</span>
        </Link>
        <Link
          href="/riwayat"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <History className="w-6 h-6 text-blue-400" />
          <span className="text-xs text-white/70 font-medium mt-2">History</span>
        </Link>
      </section>

      {/* Transactions */}
      <section className="relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <Link href="/riwayat" className="text-blue-500 text-xs font-semibold">View All</Link>
        </div>
        <ul className="rounded-3xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-4">
              <CategoryIcon category={t.category} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <p className="text-xs text-white/40">{t.category} • {t.time}</p>
              </div>
              <p className={cn("text-sm font-bold", t.isExpense ? "text-white" : "text-green-500")}>
                <Money value={t.amount} prefix={t.isExpense ? "-" : "+"} />
              </p>
            </li>
          ))}
        </ul>
      </section>
    </motion.main>
  );
}