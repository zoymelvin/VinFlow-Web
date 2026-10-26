import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Pocket = {
  id: string;
  name: string;
  category: string;
  balance: number;
  iconName: string;
};

export type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  isExpense: boolean;
  isTransfer?: boolean;
  transferToPocketId?: string;
  pocketId: string;
  time: string;
  date: string;
  note?: string;
  image?: string;
  starred?: boolean;
  viewed?: boolean;
  goalAllocation?: { goalId: string; amount: number }[];
};

/* ── Budgets ─────────────────────────────────────────── */
export type BudgetCategory = string;

export type BudgetTopUp = {
  id: string;
  amount: number;
  date: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  baseAmount: number;
  period: string;
  startDate?: string;
  topUps?: BudgetTopUp[];
  createdAt?: string;
};

/* ── Goals ──────────────────────────────────────────── */
export type GoalStatus = "active" | "paused" | "completed" | "archived";

export type GoalSaving = {
  id: string;
  goalId: string;
  amount: number;
  pocketId: string;
  date: string;
  note?: string;
  transactionId?: string;
  transferTransactionId?: string;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  deadline?: string;
  color?: string;
  iconName: string;
  note?: string;
  pocketId: string;
  status: GoalStatus;
  createdAt: string;
};

import { getSystemDate, getSystemTime } from "../lib/date";

type FinanceState = {
  pockets: Pocket[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  goalSavings: GoalSaving[];
  budgetAlerts: string[];
  seenBudgetAlerts: string[];

  addPocket: (pocket: Pocket) => void;
  deletePocket: (id: string) => void;
  updatePocketBalance: (id: string, newBalance: number) => void;
  setPockets: (pockets: Pocket[]) => void;
  goalsWalletPrompted: boolean;
  markGoalsWalletPrompted: () => void;
  transfer: (from: string, to: string, amount: number, goalId?: string, note?: string) => void;
  addTransaction: (txn: Transaction) => void;
  addTransactions: (txns: Transaction[]) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  markViewed: (id: string) => void;
  deleteTransaction: (id: string) => void;
  duplicateTransaction: (id: string) => void;
  toggleStar: (id: string) => void;
  setTransactions: (txns: Transaction[]) => void;
  clearTransactions: () => void;
  resetFinance: () => void;

  addBudget: (b: Budget) => void;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  setBudgets: (b: Budget[]) => void;
  addBudgetAlert: (key: string) => void;
  markBudgetAlertSeen: (key: string) => void;
  clearBudgetAlerts: () => void;

  addGoal: (g: Goal) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  setGoals: (g: Goal[]) => void;
  addGoalSaving: (s: GoalSaving) => void;
  updateGoalSaving: (id: string, patch: Partial<GoalSaving>) => void;
  deleteGoalSaving: (id: string) => void;
  setGoalSavings: (s: GoalSaving[]) => void;
};

const INITIAL_POCKETS: Pocket[] = [
  { id: "p1", name: "BCA", category: "Bank", balance: 25000000, iconName: "Building" },
  { id: "p2", name: "ShopeePay", category: "E-Wallet", balance: 850000, iconName: "Smartphone" },
  { id: "p3", name: "Uang Tunai", category: "Cash", balance: 450000, iconName: "Coins" },
];

const SEED_BUDGETS: Budget[] = [
  { id: "b-seed-food", categoryId: "Food", baseAmount: 1500000, period: currentPeriod(), startDate: currentDay(), createdAt: currentDay(), topUps: [] },
  { id: "b-seed-transport", categoryId: "Transport", baseAmount: 500000, period: currentPeriod(), startDate: currentDay(), createdAt: currentDay(), topUps: [] },
];

const SEED_GOALS: Goal[] = [
  { id: "g-seed-laptop", name: "New Laptop", target: 12000000, deadline: futurePeriod(6), color: "#3b82f6", iconName: "Trophy", status: "active", createdAt: new Date().toISOString(), pocketId: "p1" },
  { id: "g-seed-vacation", name: "Vacation", target: 5000000, deadline: futurePeriod(4), color: "#10b981", iconName: "Wallet", status: "active", createdAt: new Date().toISOString(), pocketId: "p1" },
];

const SEED_GOAL_SAVINGS: GoalSaving[] = [
  { id: "gs-1", goalId: "g-seed-laptop", amount: 2000000, pocketId: "p1", date: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) },
  { id: "gs-2", goalId: "g-seed-laptop", amount: 1500000, pocketId: "p1", date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) },
  { id: "gs-3", goalId: "g-seed-vacation", amount: 1200000, pocketId: "p1", date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) },
];

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function futurePeriod(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}
function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      pockets: INITIAL_POCKETS,
      transactions: [],
      budgets: SEED_BUDGETS,
      goals: SEED_GOALS,
      goalSavings: SEED_GOAL_SAVINGS,
      budgetAlerts: [],
      seenBudgetAlerts: [],

      addPocket: (pocket) => set((state) => ({ pockets: [...state.pockets, pocket] })),
      deletePocket: (id) =>
        set((state) => {
          const goalUses = state.goals.some((g) => g.pocketId === id && g.status !== "archived");
          if (goalUses) return state;
          return {
            pockets: state.pockets.filter((x) => x.id !== id),
          };
        }),
      updatePocketBalance: (id, newBalance) =>
        set((state) => ({
          pockets: state.pockets.map((p) => p.id === id ? { ...p, balance: newBalance } : p),
        })),
      setPockets: (pockets) => set({ pockets }),
      goalsWalletPrompted: false,
      markGoalsWalletPrompted: () => set({ goalsWalletPrompted: true }),
      transfer: (from, to, amount, goalId, note) =>
        set((state) => {
          const txn: Transaction = {
            id: `txn-${Date.now()}`,
            name: note || "Transfer",
            category: "Transfer",
            amount: Math.round(amount),
            isExpense: false,
            isTransfer: true,
            pocketId: from,
            transferToPocketId: to,
            time: getSystemTime(),
            date: getSystemDate(),
            note: note,
            goalAllocation: goalId ? [{ goalId, amount: Math.round(amount) }] : undefined,
          };
          return {
            transactions: [txn, ...state.transactions],
            pockets: state.pockets.map((p) => {
              if (p.id === from) return { ...p, balance: p.balance - txn.amount };
              if (p.id === to) return { ...p, balance: p.balance + txn.amount };
              return p;
            }),
          };
        }),

      addTransaction: (txn) => set((state) => ({ transactions: [txn, ...state.transactions] })),
      addTransactions: (txns) => set((state) => ({ transactions: [...txns, ...state.transactions] })),
      updateTransaction: (id, patch) =>
        set((state) => ({
          transactions: state.transactions.map((t) => t.id === id ? { ...t, ...patch, id: t.id } : t),
        })),
      markViewed: (id) =>
        set((state) => ({
          transactions: state.transactions.map((t) => t.id === id ? { ...t, viewed: true } : t),
        })),
      deleteTransaction: (id) =>
        set((state) => {
          const t = state.transactions.find((x) => x.id === id);
          if (!t) return state;
          const transactions = state.transactions.filter((x) => x.id !== id);
          const pockets = state.pockets.map((p) => {
            if (t.isTransfer) {
              if (p.id === t.pocketId) return { ...p, balance: p.balance + t.amount };
              if (p.id === t.transferToPocketId) return { ...p, balance: p.balance - t.amount };
              return p;
            } else {
              return p.id === t.pocketId
                ? { ...p, balance: p.balance + (t.isExpense ? t.amount : -t.amount) }
                : p;
            }
          });
          return { transactions, pockets };
        }),
      duplicateTransaction: (id) =>
        set((state) => {
          const src = state.transactions.find((t) => t.id === id);
          if (!src) return state;
          const copy: Transaction = {
            ...src,
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          };
          const pockets = state.pockets.map((p) =>
            p.id === copy.pocketId
              ? { ...p, balance: p.balance + (copy.isExpense ? -copy.amount : copy.amount) }
              : p
          );
          return { transactions: [copy, ...state.transactions], pockets };
        }),
      toggleStar: (id) =>
        set((state) => ({
          transactions: state.transactions.map((t) => t.id === id ? { ...t, starred: !t.starred } : t),
        })),
      setTransactions: (txns) => set({ transactions: txns }),
      clearTransactions: () =>
        set((state) => ({ transactions: [], pockets: state.pockets.map((p) => ({ ...p, balance: 0 })) })),

      resetFinance: () =>
        set({
          pockets: INITIAL_POCKETS,
          transactions: [],
          budgets: SEED_BUDGETS,
          goals: SEED_GOALS,
          goalSavings: SEED_GOAL_SAVINGS,
          budgetAlerts: [],
          seenBudgetAlerts: [],
        }),

      addBudget: (b: Budget) => set((state) => ({ budgets: [...state.budgets, b] })),
      updateBudget: (id: string, patch: Partial<Budget>) =>
        set((state) => ({ budgets: state.budgets.map((b) => b.id === id ? { ...b, ...patch, id: b.id } : b) })),
      deleteBudget: (id: string) => set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) })),
      topUpBudget: (id: string, amount: number) =>
        set((state) => ({
          budgets: state.budgets.map((b) =>
            b.id === id ? { ...b, topUps: [...(b.topUps ?? []), { id: `topup-${Date.now()}`, amount, date: new Date().toISOString().slice(0, 10) }] } : b
          ),
        })),
      setBudgets: (budgets) => set({ budgets }),

      addBudgetAlert: (key: string) => set((state) => ({
        budgetAlerts: state.budgetAlerts.includes(key)
          ? state.budgetAlerts
          : [...state.budgetAlerts, key],
      })),
      markBudgetAlertSeen: (key: string) => set((state) => ({
        seenBudgetAlerts: [...state.seenBudgetAlerts.filter((k) => k !== key), key],
      })),
      clearBudgetAlerts: () => set({ budgetAlerts: [], seenBudgetAlerts: [] }),

      addGoal: (g) => set((state) => ({ goals: [...state.goals, g] })),
      updateGoal: (id, patch) =>
        set((state) => ({ goals: state.goals.map((g) => g.id === id ? { ...g, ...patch, id: g.id } : g) })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          goalSavings: state.goalSavings.filter((s) => s.goalId !== id),
        })),
      setGoals: (goals) => set({ goals }),
      addGoalSaving: (s) =>
        set((state) => ({
          goalSavings: [...state.goalSavings, { ...s, amount: Math.round(s.amount) }],
        })),
      updateGoalSaving: (id, patch) =>
        set((state) => {
          const orig = state.goalSavings.find((s) => s.id === id);
          if (!orig) return state;
          return { goalSavings: state.goalSavings.map((s) => s.id === id ? { ...orig, ...patch, id: orig.id } : s) };
        }),
      deleteGoalSaving: (id) =>
        set((state) => ({
          goalSavings: state.goalSavings.filter((x) => x.id !== id),
        })),
      setGoalSavings: (goalSavings) => set({ goalSavings }),
    }),
    {
      name: "vinflow-storage",
      version: 5,
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== "object") return persisted as never;
        const p = persisted as Record<string, unknown>;
        return {
          pockets: Array.isArray(p.pockets) ? p.pockets : INITIAL_POCKETS,
          transactions: Array.isArray(p.transactions) ? p.transactions : [],
          budgets: Array.isArray(p.budgets)
            ? (p.budgets as Array<Record<string, unknown>>)
                .filter((b) => {
                  const categoryId =
                    typeof b.categoryId === "string" ? b.categoryId :
                    typeof b.category === "string" ? b.category : "";
                  return categoryId !== "__total__";
                })
                .map((b) => {
                  const period = typeof b.period === "string" ? b.period : currentPeriod();
                  const categoryId =
                    typeof b.categoryId === "string" ? b.categoryId :
                    typeof b.category === "string" ? b.category : "Other";
                  return {
                    id: typeof b.id === "string" ? b.id : `budget-${period}-${categoryId}`,
                    categoryId,
                    baseAmount:
                      typeof b.baseAmount === "number" ? b.baseAmount :
                      typeof b.amount === "number" ? b.amount : 0,
                    period,
                    startDate: typeof b.startDate === "string" ? b.startDate : `${period}-01`,
                    topUps: Array.isArray(b.topUps) ? b.topUps : [],
                    createdAt: typeof b.createdAt === "string" ? b.createdAt : `${period}-01`,
                  };
                })
            : SEED_BUDGETS,
          goals: Array.isArray(p.goals) ? p.goals : SEED_GOALS,
          goalSavings: Array.isArray(p.goalSavings) ? p.goalSavings : SEED_GOAL_SAVINGS,
          budgetAlerts: Array.isArray(p.budgetAlerts) ? p.budgetAlerts : [],
          seenBudgetAlerts: Array.isArray(p.seenBudgetAlerts) ? p.seenBudgetAlerts : [],
        } as never;
      },
    }
  )
);
