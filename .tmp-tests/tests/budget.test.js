"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const budget_1 = require("../src/lib/budget");
const PERIOD = "2026-10";
function txn(partial = {}) {
    return {
        id: `t${Math.random().toString(36).slice(2, 8)}`,
        name: "X",
        category: "Food",
        amount: 50000,
        isExpense: true,
        pocketId: "p1",
        time: "12:00",
        date: "2026-10-07",
        ...partial,
    };
}
function budget(categoryId, amount, period = PERIOD, startDate) {
    return { id: `b-${categoryId}`, categoryId, baseAmount: amount, period, startDate, topUps: [] };
}
/* ── periodFromDate / currentPeriod ── */
(0, node_test_1.default)("periodFromDate extracts YYYY-MM", () => {
    strict_1.default.equal((0, budget_1.periodFromDate)("2026-10-15"), "2026-10");
    strict_1.default.equal((0, budget_1.periodFromDate)(""), (0, budget_1.currentPeriod)());
});
/* ── calculateBudget: 100% fresh ── */
(0, node_test_1.default)("calculateBudget: 100% when no spending", () => {
    const b = budget("Food", 500000);
    const res = (0, budget_1.calculateBudget)(b, [], PERIOD);
    strict_1.default.equal(res.spent, 0);
    strict_1.default.equal(res.remaining, 500000);
    strict_1.default.equal(res.pct, 0);
});
/* ── calculateBudget: 50% ── */
(0, node_test_1.default)("calculateBudget: 50% after half spent", () => {
    const b = budget("Food", 500000);
    const txns = [txn({ category: "Food", amount: 250000, date: "2026-10-07" })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.spent, 250000);
    strict_1.default.equal(res.remaining, 250000);
    strict_1.default.equal(res.pct, 50);
});
/* ── calculateBudget: over budget ── */
(0, node_test_1.default)("calculateBudget: over budget", () => {
    const b = budget("Food", 500000);
    const txns = [txn({ category: "Food", amount: 600000, date: "2026-10-07" })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.spent, 600000);
    strict_1.default.equal(res.remaining, -100000);
    strict_1.default.equal(res.overBy, 100000);
    strict_1.default.equal(res.status, "over_budget");
});
/* ── calculateBudget: startDate filter ── */
(0, node_test_1.default)("calculateBudget: txns before startDate excluded", () => {
    const b = budget("Food", 500000, PERIOD, "2026-10-15");
    const txns = [
        txn({ category: "Food", amount: 100000, date: "2026-10-10" }),
        txn({ category: "Food", amount: 200000, date: "2026-10-20" }),
    ];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.spent, 200000);
    strict_1.default.equal(res.remaining, 300000);
    strict_1.default.equal(res.pct, 40);
});
/* ── calculateBudget: other categories/income/transfer ignored ── */
(0, node_test_1.default)("calculateBudget: only category + expense, not transfer/income", () => {
    const b = budget("Food", 500000);
    const txns = [
        txn({ category: "Food", amount: 100000 }),
        txn({ category: "Transport", amount: 50000 }),
        txn({ category: "Food", isExpense: false, amount: 200000 }),
        txn({ category: "Food", isTransfer: true, amount: 75000 }),
    ];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.spent, 100000);
});
/* ── calculateBudget: topUps added to limit ── */
(0, node_test_1.default)("calculateBudget: topUps increase limit", () => {
    const b = budget("Food", 500000, PERIOD);
    b.topUps = [
        { id: "t1", amount: 200000, date: "2026-10-10" },
        { id: "t2", amount: 100000, date: "2026-10-15" },
    ];
    const txns = [txn({ category: "Food", amount: 600000, date: "2026-10-20" })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.spent, 600000);
    strict_1.default.equal(res.remaining, 200000);
    strict_1.default.equal(res.pct, 75);
});
/* ── calculateBudget: status thresholds ── */
(0, node_test_1.default)("calculateBudget: status on_track < 50%", () => {
    const b = budget("Food", 100000);
    const txns = [txn({ category: "Food", amount: 40000 })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.status, "on_track");
});
(0, node_test_1.default)("calculateBudget: status watch_out 50-79%", () => {
    const b = budget("Food", 100000);
    const txns = [txn({ category: "Food", amount: 60000 })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.status, "watch_out");
});
(0, node_test_1.default)("calculateBudget: status almost_out 80-99%", () => {
    const b = budget("Food", 100000);
    const txns = [txn({ category: "Food", amount: 85000 })];
    const res = (0, budget_1.calculateBudget)(b, txns, PERIOD);
    strict_1.default.equal(res.status, "almost_out");
});
/* ── budgetAlertKeys: 80% and 100% ── */
(0, node_test_1.default)("budgetAlertKeys emits 80 threshold", () => {
    const b = budget("Food", 100000);
    const txns = [txn({ category: "Food", amount: 80000 })];
    const keys = (0, budget_1.budgetAlertKeys)([b], txns, PERIOD);
    (0, strict_1.default)(keys.includes("2026-10|Food|80"));
});
(0, node_test_1.default)("budgetAlertKeys emits 100 threshold", () => {
    const b = budget("Food", 100000);
    const txns = [txn({ category: "Food", amount: 100000 })];
    const keys = (0, budget_1.budgetAlertKeys)([b], txns, PERIOD);
    (0, strict_1.default)(keys.includes("2026-10|Food|100"));
});
/* ── parseBudgetAlertKey ── */
(0, node_test_1.default)("parseBudgetAlertKey round-trips", () => {
    const parsed = (0, budget_1.parseBudgetAlertKey)("2026-10|Food|80");
    strict_1.default.deepEqual(parsed, { period: "2026-10", category: "Food", level: 80 });
    strict_1.default.equal((0, budget_1.parseBudgetAlertKey)("bad|key"), null);
    strict_1.default.equal((0, budget_1.parseBudgetAlertKey)("p|c|77"), null);
});
/* ── overshootMessage ── */
(0, node_test_1.default)("overshootMessage fires on 80% cross", () => {
    const b = budget("Food", 100000);
    const before = [txn({ category: "Food", amount: 70000 })];
    const after = [...before, txn({ category: "Food", amount: 15000 })];
    const msg = (0, budget_1.overshootMessage)([b], before, after, "Food", PERIOD);
    (0, strict_1.default)(msg && msg.includes("85"));
});
(0, node_test_1.default)("overshootMessage fires on 100% cross", () => {
    const b = budget("Food", 100000);
    const before = [txn({ category: "Food", amount: 70000 })];
    const after = [...before, txn({ category: "Food", amount: 40000 })];
    const msg = (0, budget_1.overshootMessage)([b], before, after, "Food", PERIOD);
    (0, strict_1.default)(msg && msg.includes("exceeded"));
});
/* ── formatIDR ── */
(0, node_test_1.default)("formatIDR formats currency", () => {
    strict_1.default.match((0, budget_1.formatIDR)(50000), /50\.?000/);
    strict_1.default.match((0, budget_1.formatIDR)(0), /0/);
});
