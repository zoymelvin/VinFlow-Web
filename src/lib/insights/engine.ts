import { Insight, InsightData, InsightConfig } from "./types";
import { ALL_INSIGHTS } from "./insights";
import { GLOBAL_CONFIG } from "./config";
import { parseDateStr, formatYYYYMMDD } from "./utils";
import type { Budget } from "@/store/useFinanceStore";

type Txn = InsightData["filteredTransactions"][number];
type Pkt = InsightData["pockets"][number];

/** Hitung ringkasan periode sebelumnya yang setara. null bila histori belum cukup (< 3 transaksi). */
function computePrevPeriod(
  allTransactions: Txn[] | undefined,
  startDate: Date,
  endDate: Date
): InsightData["prevPeriod"] {
  if (!allTransactions || allTransactions.length === 0) return null;

  const DAY = 86_400_000;
  // Rentang inklusif: jumlah hari dari start ke end (dua ujung dihitung)
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY) + 1);
  const prevEnd = new Date(startDate.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY);
  prevStart.setHours(0, 0, 0, 0);

  const inPrev = allTransactions.filter((t) => {
    const d = parseDateStr(t.date);
    return d.getTime() >= prevStart.getTime() && d.getTime() <= prevEnd.getTime();
  });

  // Data historis belum cukup → jangan tampilkan perbandingan menyesatkan
  if (inPrev.length < 3) return null;

  const expenseByCat = new Map<string, number>();
  let income = 0;
  let expense = 0;
  inPrev.forEach((t) => {
    if (t.isTransfer) return;
    if (t.isExpense) {
      expense += t.amount;
      const cat = t.category || "Lainnya";
      expenseByCat.set(cat, (expenseByCat.get(cat) || 0) + t.amount);
    } else {
      income += t.amount;
    }
  });

  return { income, expense, count: inPrev.length, expenseByCat };
}

export function generateInsightData(
  filteredTransactions: Txn[],
  pockets: Pkt[],
  startDate: Date,
  endDate: Date,
  allTransactions?: Txn[],
  budgets?: Budget[]
): InsightData {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const periodLengthDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const totalIncome = filteredTransactions
    .filter((t) => !t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.isExpense && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const incomeByCat = new Map<string, number>();
  const expenseByCat = new Map<string, number>();

  filteredTransactions.forEach((t) => {
    if (t.isTransfer) return;
    const cat = t.category || "Lainnya";
    if (t.isExpense) {
      expenseByCat.set(cat, (expenseByCat.get(cat) || 0) + t.amount);
    } else {
      incomeByCat.set(cat, (incomeByCat.get(cat) || 0) + t.amount);
    }
  });

  const transactionsByDay = new Map<string, Txn[]>();
  filteredTransactions.forEach((t) => {
    const dayKey = formatYYYYMMDD(parseDateStr(t.date));
    if (!transactionsByDay.has(dayKey)) transactionsByDay.set(dayKey, []);
    transactionsByDay.get(dayKey)!.push(t);
  });

  const avgDailyExpense = totalExpense / periodLengthDays;
  const avgDailyIncome = totalIncome / periodLengthDays;
  const totalTransactions = filteredTransactions.length;

  let topExpCat = "Lainnya";
  let maxExpVal = 0;
  expenseByCat.forEach((v, k) => {
    if (v > maxExpVal) {
      maxExpVal = v;
      topExpCat = k;
    }
  });

  let topIncCat = "Lainnya";
  let maxIncVal = 0;
  incomeByCat.forEach((v, k) => {
    if (v > maxIncVal) {
      maxIncVal = v;
      topIncCat = k;
    }
  });

  return {
    filteredTransactions,
    pockets,
    budgets,
    prevPeriod: computePrevPeriod(allTransactions, startDate, endDate),
    startDate,
    endDate,
    periodLengthDays,
    totalIncome,
    totalExpense,
    netBalance,
    incomeByCat,
    expenseByCat,
    transactionsByDay,
    avgDailyExpense,
    avgDailyIncome,
    totalTransactions,
    topExpenseCategory: { name: topExpCat, amount: maxExpVal, count: 0 },
    topIncomeCategory: { name: topIncCat, amount: maxIncVal, count: 0 },
  };
}

export function computeFinancialHealthScore(data: InsightData): number {
  if (data.totalTransactions === 0) return 50;

  let score = 70; // baseline

  // 1. Savings rate / cash flow ratio
  if (data.totalIncome > 0) {
    const savingsRate = data.netBalance / data.totalIncome;
    if (savingsRate >= 0.3) score += 20;
    else if (savingsRate >= 0.1) score += 10;
    else if (savingsRate < 0) score -= 25;
  } else if (data.totalExpense > 0) {
    score -= 30; // Expenses without income
  }

  // 2. Category dominance risk
  if (data.totalExpense > 0 && data.topExpenseCategory.amount > 0) {
    const share = data.topExpenseCategory.amount / data.totalExpense;
    if (share > 0.6) score -= 15;
    else if (share > 0.4) score -= 5;
  }

  // Clamp 0 to 100
  return Math.min(100, Math.max(0, score));
}

export function evaluateInsights(data: InsightData, customConfigs?: InsightConfig[]): Insight[] {
  const configs = customConfigs || ALL_INSIGHTS;
  const rawInsights: Insight[] = [];

  configs.forEach((cfg) => {
    if (cfg.trigger(data)) {
      const generated = cfg.generate(data);
      const { sentiment: genSentiment, ...rest } = generated;
      const insight: Insight = {
        ...rest,
        id: `${cfg.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: cfg.id,
        category: cfg.category,
        sentiment: genSentiment || cfg.sentiment,
        priority: cfg.basePriority,
      };

      // Boost critical priority
      if (insight.sentiment === "critical") insight.priority += 20;
      else if (insight.sentiment === "warning") insight.priority += 10;

      rawInsights.push(insight);
    }
  });

  // Sort by priority descending
  rawInsights.sort((a, b) => b.priority - a.priority);

  // Return limited list
  return rawInsights.slice(0, GLOBAL_CONFIG.insightDisplayLimit);
}
