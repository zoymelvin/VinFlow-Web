import type { Transaction, Budget } from "@/store/useFinanceStore";

export const BUDGET_CONFIG = {
  WARNING_PCT: 80,
  EXCEEDED_PCT: 100,
} as const;

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodFromDate(date: string): string {
  if (!date) return currentPeriod();
  const d = new Date(date);
  if (!isNaN(d.getTime())) {
    let year = d.getFullYear();
    // If year is 2001 (Node default for missing year) or small, use current year
    if (year <= 2001) year = new Date().getFullYear();
    return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const iso = date.slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(iso)) return iso;
  return currentPeriod();
}

export function spentByCategory(
  transactions: Transaction[],
  category: string,
  period: string
): number {
  return transactions
    .filter((t) => t.isExpense && periodFromDate(t.date) === period)
    .filter((t) => (category === "__total__" ? true : t.category === category))
    .reduce((s, t) => s + t.amount, 0);
}

export function spentTotal(
  transactions: Transaction[],
  period: string
): number {
  return spentByCategory(transactions, "__total__", period);
}

export function statusPct(spent: number, budget: number): "ok" | "warning" | "exceeded" {
  if (!budget || budget <= 0) return "ok";
  const pct = (spent / budget) * 100;
  if (pct >= BUDGET_CONFIG.EXCEEDED_PCT) return "exceeded";
  if (pct >= BUDGET_CONFIG.WARNING_PCT) return "warning";
  return "ok";
}

export function safeToSpend(
  spent: number,
  budget: number,
  period: string
): number {
  if (!budget || budget <= 0) return 0;
  const d = new Date();
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysTotal = end.getDate();
  const daysPassed = Math.max(1, Math.min(daysTotal, today >= start && today <= end ? today.getDate() : daysTotal));
  const daysLeft = Math.max(0, daysTotal - daysPassed);
  const remaining = Math.max(0, budget - spent);
  return Math.max(0, Math.floor(remaining / Math.max(1, daysLeft)));
}

export function categoryBudgets(
  budgets: Budget[],
  period: string
): Budget[] {
  return budgets.filter((b) => b.period === period);
}

export function totalBudget(budgets: Budget[], period: string): Budget | undefined {
  return budgets.find((b) => b.period === period && b.category === "__total__");
}

/** Budgets for a period, keyed by category, including the total. */
export function budgetByCategory(budgets: Budget[], period: string): Record<string, Budget> {
  const m: Record<string, Budget> = {};
  for (const b of budgets) {
    if (b.period === period) m[b.category] = b;
  }
  return m;
}

/** Projected spending by period end, given current pace; null if not current period. */
export function paceProjection(
  spent: number,
  budget: number,
  period: string
): { projected: number; overBy: number; willExceed: boolean } | null {
  const now = new Date();
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1;
  if (now.getFullYear() !== year || now.getMonth() !== month) return null;
  const daysTotal = new Date(year, month + 1, 0).getDate();
  const daysPassed = now.getDate();
  if (budget <= 0 || daysPassed <= 0) return null;
  const dailyRate = spent / daysPassed;
  const projected = Math.round(dailyRate * daysTotal);
  const overBy = Math.max(0, projected - budget);
  return { projected, overBy, willExceed: projected > budget };
}

/** Alert keys for thresholds crossed in the given period. */
export function budgetAlertKeys(budgets: Budget[], transactions: Transaction[], period: string): string[] {
  const keys: string[] = [];
  for (const b of budgets) {
    if (b.period !== period || !b.amount || b.amount <= 0) continue;
    const spent = spentByCategory(transactions, b.category, period);
    const pct = (spent / b.amount) * 100;
    if (pct >= 100) keys.push(`${period}|${b.category}|100`);
    else if (pct >= 80) keys.push(`${period}|${b.category}|80`);
  }
  return keys;
}

export type BudgetAlertKey = `${string}|${string}|${number}`;

/** Parse a budget alert key into parts. */
export function parseBudgetAlertKey(key: string): { period: string; category: string; level: number } | null {
  const [period, category, level] = key.split("|");
  if (!period || !category || !level) return null;
  const lvl = Number(level);
  if (lvl !== 80 && lvl !== 100) return null;
  return { period, category, level: lvl as 80 | 100 };
}

/** Message triggered by saving a transaction that crosses a threshold. */
export function overshootMessage(
  budgets: Budget[],
  before: Transaction[],
  after: Transaction[],
  category: string,
  period: string
): string | null {
  if (category === "__total__") return null;
  const b = budgets.find((x) => x.period === period && x.category === category);
  if (!b || b.amount <= 0) return null;
  const pct = (txns: Transaction[]) => (spentByCategory(txns, category, period) / b.amount) * 100;
  const pre = pct(before);
  const post = pct(after);
  if (post >= 100 && pre < 100) {
    return `${category} budget exceeded: ${formatIDR(spentByCategory(after, category, period))} of ${formatIDR(b.amount)}.`;
  }
  if (post >= 80 && pre < 80) {
    return `${category} budget at ${Math.round(post)}%.`;
  }
  return null;
}

/** Cumulative spend by day of the period (day of month → cumulative amount). */
export function cumulativeSeries(
  transactions: Transaction[],
  category: string | "__total__",
  period: string
): { day: number; spent: number }[] {
  const days = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
  const byDay = new Array(days + 1).fill(0);
  for (const t of transactions) {
    if (t.isExpense && periodFromDate(t.date) === period && (category === "__total__" || t.category === category)) {
      byDay[new Date(t.date).getDate()] += t.amount;
    }
  }
  const cum: { day: number; spent: number }[] = [];
  let sum = 0;
  for (let d = 1; d <= days; d++) {
    sum += byDay[d];
    cum.push({ day: d, spent: sum });
  }
  return cum;
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
