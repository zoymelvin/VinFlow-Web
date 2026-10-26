import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPeriod,
  periodFromDate,
  calculateBudget,
  budgetAlertKeys,
  parseBudgetAlertKey,
  overshootMessage,
  formatIDR,
} from "../src/lib/budget";
import type { Transaction, Budget } from "../src/store/useFinanceStore";

const PERIOD = "2026-10";

function txn(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: `t${Math.random().toString(36).slice(2, 8)}`,
    name: "X",
    category: "Food",
    amount: 50_000,
    isExpense: true,
    pocketId: "p1",
    time: "12:00",
    date: "2026-10-07",
    ...partial,
  };
}

function budget(categoryId: string, amount: number, period = PERIOD, startDate?: string): Budget {
  return { id: `b-${categoryId}`, categoryId, baseAmount: amount, period, startDate, topUps: [] };
}

/* ── periodFromDate / currentPeriod ── */
test("periodFromDate extracts YYYY-MM", () => {
  assert.equal(periodFromDate("2026-10-15"), "2026-10");
  assert.equal(periodFromDate(""), currentPeriod());
});

/* ── calculateBudget: 100% fresh ── */
test("calculateBudget: 100% when no spending", () => {
  const b = budget("Food", 500_000);
  const res = calculateBudget(b, [], PERIOD);
  assert.equal(res.spent, 0);
  assert.equal(res.remaining, 500_000);
  assert.equal(res.pct, 0);
});

/* ── calculateBudget: 50% ── */
test("calculateBudget: 50% after half spent", () => {
  const b = budget("Food", 500_000);
  const txns = [txn({ category: "Food", amount: 250_000, date: "2026-10-07" })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.spent, 250_000);
  assert.equal(res.remaining, 250_000);
  assert.equal(res.pct, 50);
});

/* ── calculateBudget: over budget ── */
test("calculateBudget: over budget", () => {
  const b = budget("Food", 500_000);
  const txns = [txn({ category: "Food", amount: 600_000, date: "2026-10-07" })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.spent, 600_000);
  assert.equal(res.remaining, -100_000);
  assert.equal(res.overBy, 100_000);
  assert.equal(res.status, "over_budget");
});

/* ── calculateBudget: startDate filter ── */
test("calculateBudget: txns before startDate excluded", () => {
  const b = budget("Food", 500_000, PERIOD, "2026-10-15");
  const txns = [
    txn({ category: "Food", amount: 100_000, date: "2026-10-10" }),
    txn({ category: "Food", amount: 200_000, date: "2026-10-20" }),
  ];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.spent, 200_000);
  assert.equal(res.remaining, 300_000);
  assert.equal(res.pct, 40);
});

/* ── calculateBudget: other categories/income/transfer ignored ── */
test("calculateBudget: only category + expense, not transfer/income", () => {
  const b = budget("Food", 500_000);
  const txns = [
    txn({ category: "Food", amount: 100_000 }),
    txn({ category: "Transport", amount: 50_000 }),
    txn({ category: "Food", isExpense: false, amount: 200_000 }),
    txn({ category: "Food", isTransfer: true, amount: 75_000 }),
  ];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.spent, 100_000);
});

/* ── calculateBudget: topUps added to limit ── */
test("calculateBudget: topUps increase limit", () => {
  const b = budget("Food", 500_000, PERIOD);
  b.topUps = [
    { id: "t1", amount: 200_000, date: "2026-10-10" },
    { id: "t2", amount: 100_000, date: "2026-10-15" },
  ];
  const txns = [txn({ category: "Food", amount: 600_000, date: "2026-10-20" })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.spent, 600_000);
  assert.equal(res.remaining, 200_000);
  assert.equal(res.pct, 75);
});

/* ── calculateBudget: status thresholds ── */
test("calculateBudget: status on_track < 50%", () => {
  const b = budget("Food", 100_000);
  const txns = [txn({ category: "Food", amount: 40_000 })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.status, "on_track");
});

test("calculateBudget: status watch_out 50-79%", () => {
  const b = budget("Food", 100_000);
  const txns = [txn({ category: "Food", amount: 60_000 })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.status, "watch_out");
});

test("calculateBudget: status almost_out 80-99%", () => {
  const b = budget("Food", 100_000);
  const txns = [txn({ category: "Food", amount: 85_000 })];
  const res = calculateBudget(b, txns, PERIOD);
  assert.equal(res.status, "almost_out");
});

/* ── budgetAlertKeys: 80% and 100% ── */
test("budgetAlertKeys emits 80 threshold", () => {
  const b = budget("Food", 100_000);
  const txns = [txn({ category: "Food", amount: 80_000 })];
  const keys = budgetAlertKeys([b], txns, PERIOD);
  assert(keys.includes("2026-10|Food|80"));
});

test("budgetAlertKeys emits 100 threshold", () => {
  const b = budget("Food", 100_000);
  const txns = [txn({ category: "Food", amount: 100_000 })];
  const keys = budgetAlertKeys([b], txns, PERIOD);
  assert(keys.includes("2026-10|Food|100"));
});

/* ── parseBudgetAlertKey ── */
test("parseBudgetAlertKey round-trips", () => {
  const parsed = parseBudgetAlertKey("2026-10|Food|80");
  assert.deepEqual(parsed, { period: "2026-10", category: "Food", level: 80 });
  assert.equal(parseBudgetAlertKey("bad|key"), null);
  assert.equal(parseBudgetAlertKey("p|c|77"), null);
});

/* ── overshootMessage ── */
test("overshootMessage fires on 80% cross", () => {
  const b = budget("Food", 100_000);
  const before = [txn({ category: "Food", amount: 70_000 })];
  const after = [...before, txn({ category: "Food", amount: 15_000 })];
  const msg = overshootMessage([b], before, after, "Food", PERIOD);
  assert(msg && msg.includes("85"));
});

test("overshootMessage fires on 100% cross", () => {
  const b = budget("Food", 100_000);
  const before = [txn({ category: "Food", amount: 70_000 })];
  const after = [...before, txn({ category: "Food", amount: 40_000 })];
  const msg = overshootMessage([b], before, after, "Food", PERIOD);
  assert(msg && msg.includes("exceeded"));
});

/* ── formatIDR ── */
test("formatIDR formats currency", () => {
  assert.match(formatIDR(50000), /50\.?000/);
  assert.match(formatIDR(0), /0/);
});
