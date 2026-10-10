"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore } from "@/store/useFinanceStore";
import { parseBudgetAlertKey } from "@/lib/budget";
import CategoryIcon from "@/components/CategoryIcon";
import Money from "@/components/Money";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";

export default function NotifikasiPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const budgetAlerts = useFinanceStore((s) => s.budgetAlerts);
  const seenBudgetAlerts = useFinanceStore((s) => s.seenBudgetAlerts);
  const markBudgetAlertSeen = useFinanceStore((s) => s.markBudgetAlertSeen);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const duplicateTransaction = useFinanceStore((s) => s.duplicateTransaction);
  const toggleStar = useFinanceStore((s) => s.toggleStar);
  const markViewed = useFinanceStore((s) => s.markViewed);
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);

  useEffect(() => { setHasMounted(true); }, []);

  if (!hasMounted) return null;

  const alerts = budgetAlerts
    .filter((k) => !seenBudgetAlerts.includes(k))
    .map((k) => {
      const parsed = parseBudgetAlertKey(k);
      if (!parsed) return null;
      const b = budgets.find((b) => b.category === parsed.category && b.period === parsed.period);
      return { key: k, category: parsed.category, level: parsed.level, budget: b };
    })
    .filter(Boolean);

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >


      {/* Header */}
      <header className="relative flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1 mb-2">Activity</p>
          <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
        </div>
      </header>

      {alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3 px-1">Budget Alerts</h2>
          <div className="relative divide-y divide-white/5 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {alerts.map((a) => (
              <div key={a!.key} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a!.category} Budget {a!.level}%</p>
                  <p className="text-xs text-white/40">Threshold reached for {a!.budget?.period}</p>
                </div>
                <button
                  onClick={() => markBudgetAlertSeen(a!.key)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold hover:bg-white/10"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="relative divide-y divide-white/5 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-white/40">No transactions yet</div>
        ) : (
          transactions.map((t) => {
            const isViewed = !!t.viewed;
            const pocket = pockets.find((p) => p.id === t.pocketId);
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTxn(t.id);
                  markViewed(t.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left transition active:bg-white/10",
                  !isViewed && "bg-blue-500/5"
                )}
              >
                <div className="flex-1 min-w-0 flex items-start gap-3">
                  <CategoryIcon category={t.category} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-white/40">{pocket?.name} • {t.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={cn("text-sm font-bold", t.isExpense ? "text-white" : "text-green-500")}>
                    <Money value={t.amount} prefix={t.isExpense ? "-" : "+"} />
                  </p>
                  {!isViewed && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedTxn && (
        <TransactionDetailSheet
          txn={transactions.find((t) => t.id === selectedTxn) || null}
          pocketName={pockets.find((p) => p.id === transactions.find((t) => t.id === selectedTxn)?.pocketId)?.name || ""}
          onClose={() => setSelectedTxn(null)}
          onDelete={(t) => {
            deleteTransaction(t.id);
            setSelectedTxn(null);
          }}
          onDuplicate={(t) => duplicateTransaction(t.id)}
          onToggleStar={(t) => toggleStar(t.id)}
        />
      )}
    </motion.main>
  );
}
