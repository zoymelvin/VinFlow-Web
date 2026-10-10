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
function budget(category, amount) {
    return { id: `b-${category}`, category, amount, period: PERIOD };
}
/* ── periodFromDate / currentPeriod ── */
(0, node_test_1.default)("periodFromDate extracts YYYY-MM", () => {
    strict_1.default.equal((0, budget_1.periodFromDate)("2026-10-15"), "2026-10");
    strict_1.default.equal((0, budget_1.periodFromDate)(""), (0, budget_1.currentPeriod)());
});
/* ── spentByCategory / spentTotal ── */
(0, node_test_1.default)("spentByCategory sums only matching category+period expenses", () => {
    const txns = [
        txn({ category: "Food", amount: 30000, date: "2026-10-01" }),
        txn({ category: "Food", amount: 20000, date: "2026-10-10" }),
        txn({ category: "Rent", amount: 100000, date: "2026-10-05" }),
        txn({ category: "Food", amount: 10000, date: "2026-09-30" }),
        txn({ category: "Food", amount: 5000, isExpense: false }),
    ];
    strict_1.default.equal((0, budget_1.spentByCategory)(txns, "Food", PERIOD), 50000);
    strict_1.default.equal((0, budget_1.spentTotal)(txns, PERIOD), 150000);
});
/* ── statusPct ── */
(0, node_test_1.default)("statusPct thresholds", () => {
    strict_1.default.equal((0, budget_1.statusPct)(0, 100), "ok");
    strict_1.default.equal((0, budget_1.statusPct)(79, 100), "ok");
    strict_1.default.equal((0, budget_1.statusPct)(80, 100), "warning");
    strict_1.default.equal((0, budget_1.statusPct)(99, 100), "warning");
    strict_1.default.equal((0, budget_1.statusPct)(100, 100), "exceeded");
    strict_1.default.equal((0, budget_1.statusPct)(150, 100), "exceeded");
    strict_1.default.equal((0, budget_1.statusPct)(50, 0), "ok");
});
/* ── budgetAlertKeys ── */
(0, node_test_1.default)("budgetAlertKeys emits 80 then 100 when crossed", () => {
    const b = budget("Food", 100000);
    const txns80 = [txn({ amount: 80000 })];
    strict_1.default.deepEqual((0, budget_1.budgetAlertKeys)([b], txns80, PERIOD), ["2026-10|Food|80"]);
    const txns100 = [txn({ amount: 100000 })];
    strict_1.default.deepEqual((0, budget_1.budgetAlertKeys)([b], txns100, PERIOD), ["2026-10|Food|100"]);
    const txnsBelow = [txn({ amount: 79999 })];
    strict_1.default.deepEqual((0, budget_1.budgetAlertKeys)([b], txnsBelow, PERIOD), []);
});
/* ── parseBudgetAlertKey ── */
(0, node_test_1.default)("parseBudgetAlertKey round-trips", () => {
    const parsed = (0, budget_1.parseBudgetAlertKey)("2026-10|Food|80");
    strict_1.default.deepEqual(parsed, { period: "2026-10", category: "Food", level: 80 });
    strict_1.default.equal((0, budget_1.parseBudgetAlertKey)("bad|key"), null);
    strict_1.default.equal((0, budget_1.parseBudgetAlertKey)("p|c|77"), null);
});
/* ── overshootMessage ── */
(0, node_test_1.default)("overshootMessage fires on threshold cross only", () => {
    const b = budget("Food", 100000);
    const before = [txn({ amount: 70000 })];
    const after80 = [...before, txn({ amount: 15000 })];
    strict_1.default.match((0, budget_1.overshootMessage)([b], before, after80, "Food", PERIOD), /85%/);
    const after100 = [...before, txn({ amount: 40000 })];
    strict_1.default.match((0, budget_1.overshootMessage)([b], before, after100, "Food", PERIOD), /exceeded/);
    strict_1.default.equal((0, budget_1.overshootMessage)([b], before, before, "Food", PERIOD), null);
});
/* ── cumulativeSeries ── */
(0, node_test_1.default)("cumulativeSeries accumulates by day", () => {
    const txns = [
        txn({ amount: 10000, date: "2026-10-01" }),
        txn({ amount: 20000, date: "2026-10-03" }),
        txn({ amount: 5000, date: "2026-09-30" }),
    ];
    const series = (0, budget_1.cumulativeSeries)(txns, "Food", PERIOD);
    strict_1.default.equal(series.length, 31);
    strict_1.default.equal(series[0].spent, 10000);
    strict_1.default.equal(series[2].spent, 30000);
    strict_1.default.equal(series[30].spent, 30000);
});
/* ── formatIDR ── */
(0, node_test_1.default)("formatIDR formats currency", () => {
    strict_1.default.match((0, budget_1.formatIDR)(50000), /50\.?000/);
    strict_1.default.match((0, budget_1.formatIDR)(0), /0/);
});
