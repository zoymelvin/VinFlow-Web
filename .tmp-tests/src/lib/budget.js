"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUDGET_CONFIG = void 0;
exports.currentPeriod = currentPeriod;
exports.periodFromDate = periodFromDate;
exports.formatIDR = formatIDR;
exports.splitBudgets = splitBudgets;
exports.calculateBudget = calculateBudget;
exports.budgetAlertKeys = budgetAlertKeys;
exports.parseBudgetAlertKey = parseBudgetAlertKey;
exports.overshootMessage = overshootMessage;
const parseAmount_1 = require("./parseAmount");
exports.BUDGET_CONFIG = {
    WARNING_PCT: 80,
    EXCEEDED_PCT: 100,
};
function currentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodFromDate(date) {
    if (!date)
        return currentPeriod();
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    const iso = date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(iso))
        return iso;
    return currentPeriod();
}
function formatIDR(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function periodStartEnd(period) {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7)) - 1;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
}
function parseDateSafe(dateStr) {
    if (!dateStr)
        return null;
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        // If it's ISO date string with time or local representation, zero out time for fair day-level comparison
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length >= 2) {
        const monthName = parts[0];
        const dayStr = parts[1].replace(/\D/g, "");
        const month = new Date(`${monthName} 1, 2000`).getMonth();
        const day = parseInt(dayStr, 10);
        if (!isNaN(month) && !isNaN(day)) {
            const year = new Date().getFullYear();
            return new Date(year, month, day, 0, 0, 0, 0);
        }
    }
    return null;
}
function txnInPeriod(txn, period) {
    const txnDate = parseDateSafe(txn.date);
    if (!txnDate)
        return false;
    const [y, m] = period.split("-").map(Number);
    return txnDate.getFullYear() === y && txnDate.getMonth() === m - 1;
}
function splitBudgets(budgets) {
    const valid = [];
    const invalid = [];
    for (const raw of budgets) {
        if (typeof raw !== "object" || raw === null) {
            invalid.push(raw);
            continue;
        }
        const b = raw;
        const id = typeof b.id === "string" ? b.id : "";
        const categoryId = typeof b.categoryId === "string" ? b.categoryId : "";
        const period = typeof b.period === "string" ? b.period : "";
        const rawAmt = b.baseAmount ?? b.amount;
        const amt = typeof rawAmt === "number" ? rawAmt : typeof rawAmt === "string" ? (0, parseAmount_1.parseRupiahAmount)(rawAmt) : null;
        const baseAmount = typeof amt === "number" && Number.isInteger(amt) && amt > 0 ? amt : null;
        const startDate = typeof b.startDate === "string" ? b.startDate : `${period}-01`;
        const topUps = Array.isArray(b.topUps) ? b.topUps : [];
        const createdAt = typeof b.createdAt === "string" ? b.createdAt : `${period}-01`;
        if (id && categoryId && period && baseAmount !== null) {
            valid.push({ id, categoryId, baseAmount, period, startDate, topUps, createdAt });
        }
        else {
            invalid.push({ id, categoryId, baseAmount: baseAmount ?? 0, period, startDate, topUps, createdAt });
        }
    }
    return { valid, invalid };
}
function calculateBudget(budget, transactions, period) {
    const limit = budget.baseAmount + (budget.topUps?.reduce((s, u) => s + u.amount, 0) ?? 0);
    const contributing = transactions.filter((t) => {
        if (!t.isExpense)
            return false;
        if (t.isTransfer)
            return false;
        if (t.category.trim().toLowerCase() !== budget.categoryId.trim().toLowerCase() &&
            t.category.trim().toLowerCase() !== budget.categoryId.replace(/\s+/g, "").toLowerCase())
            return false;
        if (!txnInPeriod(t, period))
            return false;
        const startDate = budget.startDate;
        if (startDate) {
            const txnDate = parseDateSafe(t.date);
            if (!txnDate)
                return false;
            const start = parseDateSafe(startDate);
            if (!start)
                return false;
            if (txnDate < start)
                return false;
        }
        return true;
    });
    const spent = contributing.reduce((s, t) => s + t.amount, 0);
    const remaining = limit - spent;
    const percentRemaining = limit > 0 ? Math.max(0, Math.floor((remaining / limit) * 100)) : 0;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    let status = "on_track";
    if (remaining <= 0)
        status = "over_budget";
    else if (pct >= 80)
        status = "almost_out";
    else if (pct >= 50)
        status = "watch_out";
    const overBy = Math.max(0, -remaining);
    return { limit, spent, remaining, percentRemaining, pct, status, overBy, contributingTxns: contributing };
}
function budgetAlertKeys(budgets, transactions, period) {
    const keys = [];
    for (const b of budgets) {
        if (b.period !== period)
            continue;
        const limit = b.baseAmount + (b.topUps?.reduce((s, u) => s + u.amount, 0) ?? 0);
        if (limit <= 0)
            continue;
        const { spent } = calculateBudget(b, transactions, period);
        const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        if (pct >= 100)
            keys.push(`${period}|${b.categoryId}|100`);
        else if (pct >= 80)
            keys.push(`${period}|${b.categoryId}|80`);
    }
    return keys;
}
function parseBudgetAlertKey(key) {
    const [period, categoryId, levelStr] = key.split("|");
    if (!period || !categoryId || !levelStr)
        return null;
    const level = Number(levelStr);
    if (level !== 80 && level !== 100)
        return null;
    const res = { period, category: categoryId, level };
    Object.defineProperty(res, "categoryId", { value: categoryId, enumerable: false, writable: true, configurable: true });
    return res;
}
function overshootMessage(budgets, before, after, categoryId, period) {
    const b = budgets.find((x) => x.period === period && x.categoryId === categoryId);
    if (!b)
        return null;
    const limit = b.baseAmount + (b.topUps?.reduce((s, u) => s + u.amount, 0) ?? 0);
    if (limit <= 0)
        return null;
    const spent = (txns) => calculateBudget(b, txns, period).spent;
    const pre = spent(before);
    const post = spent(after);
    const prePct = Math.round((pre / limit) * 100);
    const postPct = Math.round((post / limit) * 100);
    if (postPct >= 100 && prePct < 100) {
        return `${categoryId} budget exceeded: ${formatIDR(post)} of ${formatIDR(limit)}.`;
    }
    if (postPct >= 80 && prePct < 80) {
        return `${categoryId} budget at ${postPct}%.`;
    }
    return null;
}
