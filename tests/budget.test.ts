import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPeriod,
  periodFromDate,
  spentByCategory,
  spentTotal,
  statusPct,
  budgetAlertKeys,
  parseBudgetAlertKey,
  overshootMessage,
  cumulativeSeries,
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

function budget(category: string, amount: number): Budget {
  return { id: `b-${category}`, category, amount, period: PERIOD };
}

/* ── periodFromDate / currentPeriod ── */
test("periodFromDate extracts YYYY-MM", () => {
  assert.equal(periodFromDate("2026-10-15"), "2026-10");
  assert.equal(periodFromDate(""), currentPeriod());
});

/* ── spentByCategory / spentTotal ── */
test("spentByCategory sums only matching category+period expenses", () => {
  const txns = [
    txn({ category: "Food", amount: 30_000, date: "2026-10-01" }),
    txn({ category: "Food", amount: 20_000, date: "2026-10-10" }),
    txn({ category: "Rent", amount: 100_000, date: "2026-10-05" }),
    txn({ category: "Food", amount: 10_000, date: "2026-09-30" }),
    txn({ category: "Food", amount: 5_000, isExpense: false }),
  ];
  assert.equal(spentByCategory(txns, "Food", PERIOD), 50_000);
  assert.equal(spentTotal(txns, PERIOD), 150_000);
});

/* ── statusPct ── */
test("statusPct thresholds", () => {
  assert.equal(statusPct(0, 100), "ok");
  assert.equal(statusPct(79, 100), "ok");
  assert.equal(statusPct(80, 100), "warning");
  assert.equal(statusPct(99, 100), "warning");
  assert.equal(statusPct(100, 100), "exceeded");
  assert.equal(statusPct(150, 100), "exceeded");
  assert.equal(statusPct(50, 0), "ok");
});

/* ── budgetAlertKeys ── */
test("budgetAlertKeys emits 80 then 100 when crossed", () => {
  const b = budget("Food", 100_000);
  const txns80 = [txn({ amount: 80_000 })];
  assert.deepEqual(budgetAlertKeys([b], txns80, PERIOD), ["2026-10|Food|80"]);

  const txns100 = [txn({ amount: 100_000 })];
  assert.deepEqual(budgetAlertKeys([b], txns100, PERIOD), ["2026-10|Food|100"]);

  const txnsBelow = [txn({ amount: 79_999 })];
  assert.deepEqual(budgetAlertKeys([b], txnsBelow, PERIOD), []);
});

/* ── parseBudgetAlertKey ── */
test("parseBudgetAlertKey round-trips", () => {
  const parsed = parseBudgetAlertKey("2026-10|Food|80");
  assert.deepEqual(parsed, { period: "2026-10", category: "Food", level: 80 });
  assert.equal(parseBudgetAlertKey("bad|key"), null);
  assert.equal(parseBudgetAlertKey("p|c|77"), null);
});

/* ── overshootMessage ── */
test("overshootMessage fires on threshold cross only", () => {
  const b = budget("Food", 100_000);
  const before = [txn({ amount: 70_000 })];
  const after80 = [...before, txn({ amount: 15_000 })];
  assert.match(overshootMessage([b], before, after80, "Food", PERIOD)!, /85%/);

  const after100 = [...before, txn({ amount: 40_000 })];
  assert.match(overshootMessage([b], before, after100, "Food", PERIOD)!, /exceeded/);

  assert.equal(overshootMessage([b], before, before, "Food", PERIOD), null);
});

/* ── cumulativeSeries ── */
test("cumulativeSeries accumulates by day", () => {
  const txns = [
    txn({ amount: 10_000, date: "2026-10-01" }),
    txn({ amount: 20_000, date: "2026-10-03" }),
    txn({ amount: 5_000, date: "2026-09-30" }),
  ];
  const series = cumulativeSeries(txns, "Food", PERIOD);
  assert.equal(series.length, 31);
  assert.equal(series[0].spent, 10_000);
  assert.equal(series[2].spent, 30_000);
  assert.equal(series[30].spent, 30_000);
});

/* ── formatIDR ── */
test("formatIDR formats currency", () => {
  assert.match(formatIDR(50000), /50\.?000/);
  assert.match(formatIDR(0), /0/);
});
