"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUDGET_CONFIG = void 0;
exports.currentPeriod = currentPeriod;
exports.periodFromDate = periodFromDate;
exports.spentByCategory = spentByCategory;
exports.spentTotal = spentTotal;
exports.statusPct = statusPct;
exports.safeToSpend = safeToSpend;
exports.categoryBudgets = categoryBudgets;
exports.totalBudget = totalBudget;
exports.budgetByCategory = budgetByCategory;
exports.paceProjection = paceProjection;
exports.budgetAlertKeys = budgetAlertKeys;
exports.parseBudgetAlertKey = parseBudgetAlertKey;
exports.overshootMessage = overshootMessage;
exports.cumulativeSeries = cumulativeSeries;
exports.formatIDR = formatIDR;
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
        let year = d.getFullYear();
        // If year is 2001 (Node default for missing year) or small, use current year
        if (year <= 2001)
            year = new Date().getFullYear();
        return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    const iso = date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(iso))
        return iso;
    return currentPeriod();
}
function spentByCategory(transactions, category, period) {
    return transactions
        .filter((t) => t.isExpense && periodFromDate(t.date) === period)
        .filter((t) => (category === "__total__" ? true : t.category === category))
        .reduce((s, t) => s + t.amount, 0);
}
function spentTotal(transactions, period) {
    return spentByCategory(transactions, "__total__", period);
}
function statusPct(spent, budget) {
    if (!budget || budget <= 0)
        return "ok";
    const pct = (spent / budget) * 100;
    if (pct >= exports.BUDGET_CONFIG.EXCEEDED_PCT)
        return "exceeded";
    if (pct >= exports.BUDGET_CONFIG.WARNING_PCT)
        return "warning";
    return "ok";
}
function safeToSpend(spent, budget, period) {
    if (!budget || budget <= 0)
        return 0;
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
function categoryBudgets(budgets, period) {
    return budgets.filter((b) => b.period === period);
}
function totalBudget(budgets, period) {
    return budgets.find((b) => b.period === period && b.category === "__total__");
}
/** Budgets for a period, keyed by category, including the total. */
function budgetByCategory(budgets, period) {
    const m = {};
    for (const b of budgets) {
        if (b.period === period)
            m[b.category] = b;
    }
    return m;
}
/** Projected spending by period end, given current pace; null if not current period. */
function paceProjection(spent, budget, period) {
    const now = new Date();
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7)) - 1;
    if (now.getFullYear() !== year || now.getMonth() !== month)
        return null;
    const daysTotal = new Date(year, month + 1, 0).getDate();
    const daysPassed = now.getDate();
    if (budget <= 0 || daysPassed <= 0)
        return null;
    const dailyRate = spent / daysPassed;
    const projected = Math.round(dailyRate * daysTotal);
    const overBy = Math.max(0, projected - budget);
    return { projected, overBy, willExceed: projected > budget };
}
/** Alert keys for thresholds crossed in the given period. */
function budgetAlertKeys(budgets, transactions, period) {
    const keys = [];
    for (const b of budgets) {
        if (b.period !== period || !b.amount || b.amount <= 0)
            continue;
        const spent = spentByCategory(transactions, b.category, period);
        const pct = (spent / b.amount) * 100;
        if (pct >= 100)
            keys.push(`${period}|${b.category}|100`);
        else if (pct >= 80)
            keys.push(`${period}|${b.category}|80`);
    }
    return keys;
}
/** Parse a budget alert key into parts. */
function parseBudgetAlertKey(key) {
    const [period, category, level] = key.split("|");
    if (!period || !category || !level)
        return null;
    const lvl = Number(level);
    if (lvl !== 80 && lvl !== 100)
        return null;
    return { period, category, level: lvl };
}
/** Message triggered by saving a transaction that crosses a threshold. */
function overshootMessage(budgets, before, after, category, period) {
    if (category === "__total__")
        return null;
    const b = budgets.find((x) => x.period === period && x.category === category);
    if (!b || b.amount <= 0)
        return null;
    const pct = (txns) => (spentByCategory(txns, category, period) / b.amount) * 100;
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
function cumulativeSeries(transactions, category, period) {
    const days = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
    const byDay = new Array(days + 1).fill(0);
    for (const t of transactions) {
        if (t.isExpense && periodFromDate(t.date) === period && (category === "__total__" || t.category === category)) {
            byDay[new Date(t.date).getDate()] += t.amount;
        }
    }
    const cum = [];
    let sum = 0;
    for (let d = 1; d <= days; d++) {
        sum += byDay[d];
        cum.push({ day: d, spent: sum });
    }
    return cum;
}
function formatIDR(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
