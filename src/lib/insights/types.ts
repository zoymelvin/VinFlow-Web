import type { Transaction, Pocket, Budget } from "@/store/useFinanceStore";

export type InsightCategory = "health" | "spending" | "anomaly" | "projection" | "positive" | "data_quality";
export type InsightSentiment = "positive" | "neutral" | "warning" | "critical";

export type Insight = {
  id: string;
  type: string;
  category: InsightCategory;
  sentiment: InsightSentiment;
  priority: number;
  title: string;
  message: string;
  details?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
  displayProps?: { variantIndex: number };
};

export type InsightConfig = {
  id: string;
  category: InsightCategory;
  sentiment: InsightSentiment;
  basePriority: number;
  trigger: (data: InsightData) => boolean;
  generate: (
    data: InsightData
  ) => Omit<Insight, "id" | "category" | "sentiment" | "priority" | "type"> & {
    sentiment?: InsightSentiment;
  };
  thresholds?: Record<string, number>;
  messageVariants: Array<{
    title: string;
    message: string;
    details?: string;
    icon?: string;
  }>;
};

export type InsightData = {
  filteredTransactions: Transaction[];
  pockets: Pocket[];
  budgets?: Budget[];
  /** Ringkasan periode sebelumnya (rentang sama, tepat sebelum startDate). null bila histori kurang. */
  prevPeriod: {
    income: number;
    expense: number;
    count: number;
    expenseByCat: Map<string, number>;
  } | null;
  startDate: Date;
  endDate: Date;
  periodLengthDays: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  incomeByCat: Map<string, number>;
  expenseByCat: Map<string, number>;
  transactionsByDay: Map<string, Transaction[]>;
  avgDailyExpense: number;
  avgDailyIncome: number;
  totalTransactions: number;
  topExpenseCategory: { name: string; amount: number; count: number };
  topIncomeCategory: { name: string; amount: number; count: number };
};

export type GlobalConfig = {
  insightDisplayLimit: number;
  staleInsightDecay: number;
  thresholds: {
    cashFlowWarningRatio: number;
    cashFlowCriticalRatio: number;
    significantCategoryShare: number;
    unusualExpenseMultiplier: number;
    lowDataThreshold: number;
    recurringExpenseRatio: number;
    projectionWarningDays: number;
  };
};