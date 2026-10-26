"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Eye,
  EyeOff,
  PieChart,
  Trophy,
  History,
  LayoutGrid,
  ArrowUp,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore, type Transaction } from "@/store/useFinanceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getGreeting } from "@/lib/settings";
import { parseDateStr } from "@/lib/insights/utils";
import Money from "@/components/Money";
import { categoryIcon } from "@/components/CategoryIcon";
import PageHeader from "@/components/PageHeader";
import Avatar from "@/components/Avatar";

let hasAnimated = false;

export default function DashboardPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const profile = useSettingsStore((s) => s.profile);
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const setHideBalance = useSettingsStore((s) => s.setHideBalance);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (!hasAnimated) {
        hasAnimated = true;
    }
  }, []);

  const totalBalance = useMemo(() => pockets.reduce((sum, p) => sum + p.balance, 0), [pockets]);

  const { monthIncome, monthExpense, monthNet } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txns = transactions.filter((t) => parseDateStr(t.date) >= start);
    const income = txns.filter((t) => !t.isExpense && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.isExpense && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
    return { monthIncome: income, monthExpense: expense, monthNet: income - expense };
  }, [transactions]);

  const recentActivity = useMemo(() => {
    const recent = transactions.slice(0, 5);
    const groups: { label: string; items: Transaction[] }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    recent.forEach(t => {
      let label = "";
      if (t.date === todayStr) label = "TODAY";
      else if (t.date === yesterdayStr) label = "YESTERDAY";
      else {
        const d = parseDateStr(t.date);
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
      }
      const group = groups.find(g => g.label === label);
      if (group) group.items.push(t);
      else groups.push({ label, items: [t] });
    });
    return groups;
  }, [transactions]);

  if (!hasMounted) return null;

  const anim = (delay: number) => ({
      animationName: 'entrance',
      animationDuration: '260ms',
      animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
      animationDelay: `${delay}ms`,
      animationFillMode: 'backwards' as const
  });

  return (
    <main className="relative min-h-screen bg-[#0b0d12] text-white pb-32 font-space overflow-x-hidden">
      <PageHeader 
        className="animate-entrance"
        title={profile.name} 
        label={getGreeting(new Date().getHours()).toUpperCase()}
        left={
          <Link href="/profile" aria-label="Open profile" className="transition active:scale-95">
            <Avatar name={profile.name} photo={profile.photo} size="md" />
          </Link>
        }
        right={
            <Link href="/notifikasi" className="relative w-11 h-11 rounded-full bg-[#151922] border border-[#232938] flex items-center justify-center transition active:scale-95">
                <Bell className="w-5 h-5 text-white" strokeWidth={1.8} />
                {transactions.some(t => !t.viewed) && <span className="absolute top-3 right-3 w-2 h-2 bg-[#ff6b7a] rounded-full border-2 border-[#151922]" />}
            </Link>
        }
      />

      <div className="px-4 pt-3 space-y-3">
        <section style={anim(60)} className="relative rounded-[24px] p-5 border border-[#2c4a8a] bg-gradient-to-br from-[#21468f] from-0% via-[#16295a] via-55% to-[#111829] to-100% overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#c4d4f5]">TOTAL BALANCE</p>
                <button onClick={() => setHideBalance(!hideBalance)} className="w-11 h-11 -my-2.5 -mr-2 rounded-full bg-white/12 flex items-center justify-center transition active:scale-95">
                    {hideBalance ? <EyeOff className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-white" />}
                </button>
            </div>
            <div className="flex items-end justify-between">
                <div className="text-[34px] font-bold tracking-[-0.01em] leading-tight tabular-nums">
                    <Money value={totalBalance} />
                </div>
            </div>
        </section>

        <section style={anim(120)} className="bg-[#151922] border border-[#232938] rounded-[20px] py-4 px-[18px]">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9aa3b2]">THIS MONTH</p>
                {!hideBalance && <p className={cn("text-[13px] font-semibold", monthNet >= 0 ? "text-[#3ddc97]" : "text-[#ff6b7a]")}>Net {monthNet >= 0 ? "+" : ""}<Money value={monthNet} /></p>}
            </div>
            <div className="h-2 w-full flex rounded-full overflow-hidden bg-[#232938] gap-[3px] mb-3">
                <div className="h-full bg-[#3ddc97] origin-left transition-transform duration-500 delay-[200ms]" style={{ flex: Math.max(0.05, monthIncome / (monthIncome + monthExpense || 1)), transform: 'scaleX(1)' }} />
                <div className="h-full bg-[#ff6b7a] origin-left transition-transform duration-500 delay-[280ms]" style={{ flex: Math.max(0.05, monthExpense / (monthIncome + monthExpense || 1)), transform: 'scaleX(1)' }} />
            </div>
            <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#9aa3b2] mb-0.5">Income</p><p className="text-base font-semibold text-[#3ddc97]"><Money value={monthIncome} /></p></div>
                <div className="text-right"><p className="text-xs text-[#9aa3b2] mb-0.5">Expense</p><p className="text-base font-semibold text-[#ff6b7a]"><Money value={monthExpense} /></p></div>
            </div>
        </section>

        <section style={anim(180)} className="flex gap-2">
            {[
                { label: "Budgets", href: "/budgets", icon: PieChart, color: "#6ea4ff" },
                { label: "Goals", href: "/goals", icon: Trophy, color: "#ffa94d" },
                { label: "History", href: "/riwayat", icon: History, color: "#a78bfa" },
                { label: "Others", href: "/others", icon: LayoutGrid, color: "#ffffff", alpha: 0.08 },
            ].map((item) => (
                <Link key={item.label} href={item.href} className="flex-1 min-h-[76px] bg-[#151922] border border-[#232938] rounded-2xl flex flex-col items-center justify-center gap-2 transition active:scale-[0.97] duration-90">
                    <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${item.color}${item.alpha ? '14' : '29'}` }}>
                        <item.icon className="w-[18px] h-[18px]" style={{ color: item.color }} strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-medium text-white">{item.label}</span>
                </Link>
            ))}
        </section>

        <section>
            <div style={anim(240)} className="flex items-center justify-between px-0.5 mb-2.5 pt-4">
                <h2 className="text-base font-semibold">Recent activity</h2>
                <Link href="/riwayat" className="text-[13px] font-medium text-[#6ea4ff] min-h-[44px] flex items-center transition active:scale-95">View all</Link>
            </div>
            <div style={anim(300)} className="bg-[#151922] border border-[#232938] rounded-[20px] overflow-hidden">
                {recentActivity.map((group, gIdx) => (
                    <div key={group.label} className="border-t border-[#232938] first:border-0" style={anim(300 + gIdx * 40)}>
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9aa3b2] pt-3 px-[14px] pb-1">{group.label}</p>
                        {group.items.map(t => {
                            const Icon = t.isTransfer ? ArrowLeftRight : (t.isExpense ? categoryIcon(t.category) : ArrowUp);
                            const color = t.isTransfer ? "#6ea4ff" : (t.isExpense ? "#ffa94d" : "#3ddc97");
                            const isGeneric = !t.name || t.name.toLowerCase() === 'transaction';
                            return (
                                <div key={t.id} className="flex items-center gap-3 py-3 px-[14px] transition active:bg-white/5 active:scale-[0.97] duration-90">
                                    <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}29` }}>
                                        <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.8} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{isGeneric ? t.category : t.name}</p>
                                        <p className="text-xs text-[#9aa3b2] truncate">{t.isTransfer ? `${pockets.find(p => p.id === t.pocketId)?.name} → ${pockets.find(p => p.id === t.transferToPocketId)?.name}` : `${pockets.find(p => p.id === t.pocketId)?.name} · ${t.time}`}</p>
                                    </div>
                                    <p className="text-base font-semibold text-right shrink-0">
                                        <Money value={t.amount} prefix={t.isTransfer ? "" : (t.isExpense ? "-" : "+")} />
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </section>
      </div>
    </main>
  );
}
