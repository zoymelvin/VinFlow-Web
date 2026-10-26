"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFinanceStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const date_1 = require("../lib/date");
const INITIAL_POCKETS = [
    { id: "p1", name: "BCA", category: "Bank", balance: 25000000, iconName: "Building" },
    { id: "p2", name: "ShopeePay", category: "E-Wallet", balance: 850000, iconName: "Smartphone" },
    { id: "p3", name: "Uang Tunai", category: "Cash", balance: 450000, iconName: "Coins" },
];
const SEED_BUDGETS = [
    { id: "b-seed-food", categoryId: "Food", baseAmount: 1500000, period: currentPeriod(), startDate: currentDay(), createdAt: currentDay(), topUps: [] },
    { id: "b-seed-transport", categoryId: "Transport", baseAmount: 500000, period: currentPeriod(), startDate: currentDay(), createdAt: currentDay(), topUps: [] },
];
const SEED_GOALS = [
    { id: "g-seed-laptop", name: "New Laptop", target: 12000000, deadline: futurePeriod(6), color: "#3b82f6", iconName: "Trophy", status: "active", createdAt: new Date().toISOString(), pocketId: "p1" },
    { id: "g-seed-vacation", name: "Vacation", target: 5000000, deadline: futurePeriod(4), color: "#10b981", iconName: "Wallet", status: "active", createdAt: new Date().toISOString(), pocketId: "p1" },
];
const SEED_GOAL_SAVINGS = [
    { id: "gs-1", goalId: "g-seed-laptop", amount: 2000000, pocketId: "p1", date: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) },
    { id: "gs-2", goalId: "g-seed-laptop", amount: 1500000, pocketId: "p1", date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) },
    { id: "gs-3", goalId: "g-seed-vacation", amount: 1200000, pocketId: "p1", date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) },
];
const SEED_BILLS = [
    {
        id: "bill-seed-internet",
        name: "Internet",
        category: "Data Plan",
        amount: 350000,
        dueDate: currentDay(),
        pocketId: "p1",
        frequency: "monthly",
        reminderDays: 3,
        startDate: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
        color: "#3b82f6",
        iconName: "Zap",
        payments: [],
    },
    {
        id: "bill-seed-rent",
        name: "Rent",
        category: "Rent",
        amount: 2500000,
        dueDate: daysFromNow(5),
        pocketId: "p1",
        frequency: "monthly",
        reminderDays: 5,
        startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        color: "#a855f7",
        iconName: "Home",
        payments: [],
    },
    {
        id: "bill-seed-spotify",
        name: "Music Streaming",
        category: "Hobby",
        amount: 55000,
        dueDate: daysFromNow(-2),
        pocketId: "p2",
        frequency: "monthly",
        reminderDays: 1,
        startDate: new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10),
        color: "#10b981",
        iconName: "Receipt",
        payments: [],
    },
];
function currentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function futurePeriod(monthsAhead) {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    return d.toISOString().slice(0, 10);
}
function currentDay() {
    return new Date().toISOString().slice(0, 10);
}
function daysFromNow(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
exports.useFinanceStore = (0, zustand_1.create)()((0, middleware_1.persist)((set) => ({
    pockets: INITIAL_POCKETS,
    transactions: [],
    budgets: SEED_BUDGETS,
    goals: SEED_GOALS,
    goalSavings: SEED_GOAL_SAVINGS,
    bills: SEED_BILLS,
    budgetAlerts: [],
    seenBudgetAlerts: [],
    addPocket: (pocket) => set((state) => ({ pockets: [...state.pockets, pocket] })),
    deletePocket: (id) => set((state) => {
        // never delete a wallet that still holds funds for a non-archived goal
        const goalUses = state.goals.some((g) => g.pocketId === id && g.status !== "archived");
        if (goalUses)
            return state;
        return {
            pockets: state.pockets.filter((x) => x.id !== id),
        };
    }),
    updatePocketBalance: (id, newBalance) => set((state) => ({
        pockets: state.pockets.map((p) => p.id === id ? { ...p, balance: newBalance } : p),
    })),
    setPockets: (pockets) => set({ pockets }),
    goalsWalletPrompted: false,
    markGoalsWalletPrompted: () => set({ goalsWalletPrompted: true }),
    transfer: (from, to, amount, goalId, note) => set((state) => {
        const txn = {
            id: `txn-${Date.now()}`,
            name: note || "Transfer",
            category: "Transfer",
            amount: Math.round(amount),
            isExpense: false,
            isTransfer: true,
            pocketId: from,
            transferToPocketId: to,
            time: (0, date_1.getSystemTime)(),
            date: (0, date_1.getSystemDate)(),
            note: note,
            goalAllocation: goalId ? [{ goalId, amount: Math.round(amount) }] : undefined,
        };
        return {
            transactions: [txn, ...state.transactions],
            pockets: state.pockets.map((p) => {
                if (p.id === from)
                    return { ...p, balance: p.balance - txn.amount };
                if (p.id === to)
                    return { ...p, balance: p.balance + txn.amount };
                return p;
            }),
        };
    }),
    addTransaction: (txn) => set((state) => ({ transactions: [txn, ...state.transactions] })),
    addTransactions: (txns) => set((state) => ({ transactions: [...txns, ...state.transactions] })),
    updateTransaction: (id, patch) => set((state) => ({
        transactions: state.transactions.map((t) => t.id === id ? { ...t, ...patch, id: t.id } : t),
    })),
    markViewed: (id) => set((state) => ({
        transactions: state.transactions.map((t) => t.id === id ? { ...t, viewed: true } : t),
    })),
    deleteTransaction: (id) => set((state) => {
        const t = state.transactions.find((x) => x.id === id);
        if (!t)
            return state;
        const transactions = state.transactions.filter((x) => x.id !== id);
        const pockets = state.pockets.map((p) => {
            if (t.isTransfer) {
                if (p.id === t.pocketId)
                    return { ...p, balance: p.balance + t.amount };
                if (p.id === t.transferToPocketId)
                    return { ...p, balance: p.balance - t.amount };
                return p;
            }
            else {
                return p.id === t.pocketId
                    ? { ...p, balance: p.balance + (t.isExpense ? t.amount : -t.amount) }
                    : p;
            }
        });
        return { transactions, pockets };
    }),
    duplicateTransaction: (id) => set((state) => {
        const src = state.transactions.find((t) => t.id === id);
        if (!src)
            return state;
        const copy = {
            ...src,
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        };
        const pockets = state.pockets.map((p) => p.id === copy.pocketId
            ? { ...p, balance: p.balance + (copy.isExpense ? -copy.amount : copy.amount) }
            : p);
        return { transactions: [copy, ...state.transactions], pockets };
    }),
    toggleStar: (id) => set((state) => ({
        transactions: state.transactions.map((t) => t.id === id ? { ...t, starred: !t.starred } : t),
    })),
    setTransactions: (txns) => set({ transactions: txns }),
    clearTransactions: () => set((state) => ({ transactions: [], pockets: state.pockets.map((p) => ({ ...p, balance: 0 })) })),
    resetFinance: () => set({
        pockets: INITIAL_POCKETS,
        transactions: [],
        budgets: SEED_BUDGETS,
        goals: SEED_GOALS,
        goalSavings: SEED_GOAL_SAVINGS,
        bills: SEED_BILLS,
        budgetAlerts: [],
        seenBudgetAlerts: [],
    }),
    /* budgets */
    addBudget: (b) => set((state) => ({ budgets: [...state.budgets, b] })),
    updateBudget: (id, patch) => set((state) => ({ budgets: state.budgets.map((b) => b.id === id ? { ...b, ...patch, id: b.id } : b) })),
    deleteBudget: (id) => set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) })),
    topUpBudget: (id, amount) => set((state) => ({
        budgets: state.budgets.map((b) => b.id === id ? { ...b, topUps: [...(b.topUps ?? []), { id: `topup-${Date.now()}`, amount, date: new Date().toISOString().slice(0, 10) }] } : b),
    })),
    setBudgets: (budgets) => set({ budgets }),
    /* budget alerts */
    addBudgetAlert: (key) => set((state) => ({
        budgetAlerts: state.budgetAlerts.includes(key)
            ? state.budgetAlerts
            : [...state.budgetAlerts, key],
    })),
    markBudgetAlertSeen: (key) => set((state) => ({
        seenBudgetAlerts: [...state.seenBudgetAlerts.filter((k) => k !== key), key],
    })),
    clearBudgetAlerts: () => set({ budgetAlerts: [], seenBudgetAlerts: [] }),
    /* goals */
    addGoal: (g) => set((state) => ({ goals: [...state.goals, g] })),
    updateGoal: (id, patch) => set((state) => ({ goals: state.goals.map((g) => g.id === id ? { ...g, ...patch, id: g.id } : g) })),
    deleteGoal: (id) => set((state) => ({
        goals: state.goals.filter((g) => g.id !== id),
        goalSavings: state.goalSavings.filter((s) => s.goalId !== id),
    })),
    setGoals: (goals) => set({ goals }),
    // Savings Wallet model: money already sits in the savings wallet.
    // A GoalSaving is a *label* on that money — it never moves funds itself.
    addGoalSaving: (s) => set((state) => ({
        goalSavings: [...state.goalSavings, { ...s, amount: Math.round(s.amount) }],
    })),
    updateGoalSaving: (id, patch) => set((state) => {
        const orig = state.goalSavings.find((s) => s.id === id);
        if (!orig)
            return state;
        return { goalSavings: state.goalSavings.map((s) => s.id === id ? { ...orig, ...patch, id: orig.id } : s) };
    }),
    deleteGoalSaving: (id) => set((state) => ({
        goalSavings: state.goalSavings.filter((x) => x.id !== id),
    })),
    setGoalSavings: (goalSavings) => set({ goalSavings }),
    /* bills */
    addBill: (b) => set((state) => ({ bills: [...state.bills, b] })),
    updateBill: (id, patch) => set((state) => ({ bills: state.bills.map((b) => b.id === id ? { ...b, ...patch, id: b.id } : b) })),
    deleteBill: (id) => set((state) => ({ bills: state.bills.filter((b) => b.id !== id) })),
    setBills: (bills) => set({ bills }),
    recordBillPayment: (billId, payment) => set((state) => ({
        bills: state.bills.map((b) => b.id === billId ? { ...b, payments: [...b.payments, payment] } : b),
        transactions: [state.transactions.find((t) => t.id === payment.transactionId),
            ...state.transactions.filter((t) => t.id !== payment.transactionId),].filter(Boolean),
        pockets: state.pockets.map((p) => p.id === payment.pocketId ? { ...p, balance: p.balance - payment.amount } : p),
    })),
    removeBillPayment: (billId, paymentId) => set((state) => {
        const bill = state.bills.find((b) => b.id === billId);
        const payment = bill?.payments.find((p) => p.id === paymentId);
        if (!bill || !payment)
            return state;
        return {
            bills: state.bills.map((b) => b.id === billId ? { ...b, payments: b.payments.filter((p) => p.id !== paymentId) } : b),
            transactions: state.transactions.filter((t) => t.id !== payment.transactionId),
            pockets: state.pockets.map((p) => p.id === payment.pocketId ? { ...p, balance: p.balance + payment.amount } : p),
        };
    }),
}), {
    name: "vinflow-storage",
    version: 5,
    migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object")
            return persisted;
        const p = persisted;
        return {
            pockets: Array.isArray(p.pockets) ? p.pockets : INITIAL_POCKETS,
            transactions: Array.isArray(p.transactions) ? p.transactions : [],
            budgets: Array.isArray(p.budgets)
                ? p.budgets
                    .filter((b) => {
                    const categoryId = typeof b.categoryId === "string" ? b.categoryId :
                        typeof b.category === "string" ? b.category : "";
                    return categoryId !== "__total__";
                })
                    .map((b) => {
                    const period = typeof b.period === "string" ? b.period : currentPeriod();
                    const categoryId = typeof b.categoryId === "string" ? b.categoryId :
                        typeof b.category === "string" ? b.category : "Other";
                    return {
                        id: typeof b.id === "string" ? b.id : `budget-${period}-${categoryId}`,
                        categoryId,
                        baseAmount: typeof b.baseAmount === "number" ? b.baseAmount :
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
            bills: Array.isArray(p.bills) ? p.bills : SEED_BILLS,
            budgetAlerts: Array.isArray(p.budgetAlerts) ? p.budgetAlerts : [],
            seenBudgetAlerts: Array.isArray(p.seenBudgetAlerts) ? p.seenBudgetAlerts : [],
        };
    },
}));
