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
  /** Idempotency key: unique per send attempt, stored to block double submits. */
  transferKey?: string;
  /** Expense txn id of the admin fee charged for this transfer (fee > 0 only). */
  adminFeeTransactionId?: string;
  /** Set on an "Admin fee" expense: id of the transfer it belongs to. */
  transferFeeOf?: string;
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

export type TransferInput = {
  fromPocketId: string;
  toPocketId: string;
  amount: number;
  adminFee?: number;
  note?: string;
  date?: string; // YYYY-MM-DD, defaults to today
  goalId?: string;
  key: string; // idempotency key, unique per send attempt
};

export type TransferResult =
  | { ok: true; txnId: string; feeTxnId?: string; duplicate: boolean }
  | { ok: false; error: string };

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
  addTransfer: (input: TransferInput) => TransferResult;
  deleteTransfer: (id: string) => void;
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

const MAX_TRANSFER_AMOUNT = 999_999_999_999;

/** Atomic removal of a transfer: restores both pocket balances (including
 *  any admin fee), deletes the fee expense, and unlinks goal savings rows
 *  created from this transfer. Returns null when no transfer matches. */
function transferRemoval(
  state: Pick<FinanceState, "transactions" | "pockets" | "goalSavings">,
  id: string
): Pick<FinanceState, "transactions" | "pockets" | "goalSavings"> | null {
  const t = state.transactions.find((x) => x.id === id && x.isTransfer);
  if (!t) return null;
  const feeTxn = t.adminFeeTransactionId
    ? state.transactions.find((x) => x.id === t.adminFeeTransactionId)
    : undefined;
  const feeAmount = feeTxn?.isExpense ? feeTxn.amount : 0;
  return {
    transactions: state.transactions.filter((x) => x.id !== id && x.id !== t.adminFeeTransactionId),
    pockets: state.pockets.map((p) => {
      if (p.id === t.pocketId) return { ...p, balance: p.balance + t.amount + feeAmount };
      if (p.id === t.transferToPocketId) return { ...p, balance: p.balance - t.amount };
      return p;
    }),
    goalSavings: state.goalSavings.filter((s) => s.transferTransactionId !== t.id),
  };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
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
      addTransfer: (input) => {
        const { fromPocketId, toPocketId, amount, adminFee = 0, note, date, goalId, key } = input;

        if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TRANSFER_AMOUNT) {
          return { ok: false, error: "Amount must be a whole number between 1 and 999,999,999,999." };
        }
        if (fromPocketId === toPocketId) {
          return { ok: false, error: "Source and destination wallets must be different." };
        }
        if (!Number.isInteger(adminFee) || adminFee < 0) {
          return { ok: false, error: "Admin fee must be a whole number of 0 or more." };
        }
        if (typeof key !== "string" || key.trim() === "") {
          return { ok: false, error: "An idempotency key is required." };
        }
        if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return { ok: false, error: "Date must be YYYY-MM-DD." };
        }

        const state = get();
        const from = state.pockets.find((p) => p.id === fromPocketId);
        const to = state.pockets.find((p) => p.id === toPocketId);
        if (!from || !to) {
          return { ok: false, error: "Source or destination wallet not found." };
        }
        if (from.balance < 0 || amount + adminFee > from.balance) {
          return { ok: false, error: "Amount plus admin fee exceeds the source wallet balance." };
        }
        // Idempotency: a second attempt with the same key returns the first result.
        const existing = state.transactions.find((t) => t.transferKey === key);
        if (existing) {
          return { ok: true, txnId: existing.id, feeTxnId: existing.adminFeeTransactionId, duplicate: true };
        }

        const txnDate = date ?? getSystemDate();
        const txnTime = getSystemTime();
        const txn: Transaction = {
          id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: "Transfer",
          category: "Transfer",
          amount,
          isExpense: false,
          isTransfer: true,
          transferKey: key,
          pocketId: fromPocketId,
          transferToPocketId: toPocketId,
          time: txnTime,
          date: txnDate,
          note: note?.trim() || undefined,
          goalAllocation: goalId ? [{ goalId, amount }] : undefined,
        };
        let feeTxn: Transaction | undefined;
        if (adminFee > 0) {
          feeTxn = {
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}-fee`,
            name: "Admin fee",
            category: "Other",
            amount: adminFee,
            isExpense: true,
            transferFeeOf: txn.id,
            pocketId: fromPocketId,
            time: txnTime,
            date: txnDate,
          };
          txn.adminFeeTransactionId = feeTxn.id;
        }
        set((s) => ({
          transactions: feeTxn ? [txn, feeTxn, ...s.transactions] : [txn, ...s.transactions],
          pockets: s.pockets.map((p) => {
            if (p.id === fromPocketId) return { ...p, balance: p.balance - (amount + adminFee) };
            if (p.id === toPocketId) return { ...p, balance: p.balance + amount };
            return p;
          }),
        }));
        return { ok: true, txnId: txn.id, feeTxnId: feeTxn?.id, duplicate: false };
      },

      deleteTransfer: (id) =>
        set((state) => transferRemoval(state, id) ?? state),

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
          // Transfers fold fee restoration + goal unlink into one atomic update.
          if (t.isTransfer) return transferRemoval(state, id) ?? state;
          const transactions = state.transactions.filter((x) => x.id !== id);
          const pockets = state.pockets.map((p) =>
            p.id === t.pocketId ? { ...p, balance: p.balance + (t.isExpense ? t.amount : -t.amount) } : p
          );
          return { transactions, pockets };
        }),
      duplicateTransaction: (id) =>
        set((state) => {
          const src = state.transactions.find((t) => t.id === id);
          if (!src) return state;
          const copy: Transaction = {
            ...src,
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            transferKey: undefined, // a duplicate is a new send attempt
          };
          const pockets = state.pockets.map((p) => {
            if (src.isTransfer) {
              if (p.id === copy.pocketId) return { ...p, balance: p.balance - copy.amount };
              if (p.id === copy.transferToPocketId) return { ...p, balance: p.balance + copy.amount };
              return p;
            }
            return p.id === copy.pocketId
              ? { ...p, balance: p.balance + (copy.isExpense ? -copy.amount : copy.amount) }
              : p;
          });
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
