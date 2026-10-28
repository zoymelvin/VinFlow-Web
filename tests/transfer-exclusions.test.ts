import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HISTORY_FILTERS, filterTransactions, groupByDay, toCSV } from "../src/lib/history";
import { generateInsightData } from "../src/lib/insights/engine";
import { calculateBudget } from "../src/lib/budget";
import type { Transaction } from "../src/store/useFinanceStore";

let seq = 0;
function txn(partial: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `x${seq}`,
    name: "X",
    category: "Food",
    amount: 50_000,
    isExpense: true,
    pocketId: "p1",
    time: "12:00",
    date: "2026-10-05",
    ...partial,
  };
}

const transfer = (partial: Partial<Transaction> = {}): Transaction =>
  txn({
    name: "Transfer",
    category: "Transfer",
    amount: 50_000,
    isExpense: false,
    isTransfer: true,
    pocketId: "sp",
    transferToPocketId: "sb",
    ...partial,
  });

/* ── History filters: type + wallet (source OR destination) ── */
test("type=transfer keeps only transfers; income/expense drop them", () => {
  const txns = [txn({ id: "e" }), txn({ id: "i", isExpense: false, category: "Salary" }), transfer({ id: "t" })];
  assert.deepEqual(
    filterTransactions(txns, { ...DEFAULT_HISTORY_FILTERS, type: "transfer" }, null).map((t) => t.id),
    ["t"]
  );
  assert.deepEqual(
    filterTransactions(txns, { ...DEFAULT_HISTORY_FILTERS, type: "expense" }, null).map((t) => t.id),
    ["e"]
  );
  assert.deepEqual(
    filterTransactions(txns, { ...DEFAULT_HISTORY_FILTERS, type: "income" }, null).map((t) => t.id),
    ["i"]
  );
});

test("wallet filter matches a transfer when the wallet is source or destination", () => {
  const txns = [
    transfer({ id: "out" }), // sp → sb
    txn({ id: "plain", pocketId: "sb" }), // plain expense on sb
    txn({ id: "other", pocketId: "p3" }),
  ];
  const ids = (filter: string) =>
    filterTransactions(txns, { ...DEFAULT_HISTORY_FILTERS, pocketId: filter }, null)
      .map((t) => t.id).sort();
  assert.deepEqual(ids("sp"), ["out"]);
  assert.deepEqual(ids("sb"), ["out", "plain"]);
});

/* ── Daily group total excludes transfers ── */
test("groupByDay total ignores transfer amounts", () => {
  const txns = [
    txn({ id: "e", amount: 30_000, date: "2026-10-05" }),
    txn({ id: "i", amount: 100_000, isExpense: false, date: "2026-10-05" }),
    transfer({ id: "t", amount: 50_000, date: "2026-10-05" }),
  ];
  const groups = groupByDay(txns, "newest");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 3, "transfer still visible in the list");
  assert.equal(groups[0].total, 70_000);
});

/* ── CSV export labels transfers correctly ── */
test("toCSV exports transfers as Type=Transfer with From → To wallet", () => {
  const csv = toCSV([transfer({ date: "2026-10-05", time: "09:30" })], (id) => (id === "sp" ? "ShopeePay" : id === "sb" ? "SeaBank" : id));
  const [header, row] = csv.split("\r\n");
  assert.equal(header, "Date,Time,Type,Category,Name,Note,Wallet,Amount (Rp)");
  const cells = row.split(",");
  assert.equal(cells[2], "Transfer");
  assert.equal(cells[6], "ShopeePay → SeaBank", `wallet cell: ${row}`);
});

/* ── Smart Insights engine ignores transfers everywhere ── */
test("generateInsightData excludes transfers from income, expense, net, and categories", () => {
  const txns = [
    txn({ id: "e", amount: 30_000, date: "2026-10-05" }),
    txn({ id: "i", amount: 100_000, isExpense: false, category: "Salary", date: "2026-10-05" }),
    transfer({ id: "t", amount: 50_000, date: "2026-10-05", category: "Transfer" }),
    transfer({ id: "t2", amount: 20_000, isExpense: true, date: "2026-10-05" }), // safety: even a mis-flagged one
  ];
  const now = new Date(2026, 9, 5, 12, 0, 0);
  const data = generateInsightData(txns, [], new Date(2026, 9, 1), now, txns);
  assert.equal(data.totalIncome, 100_000);
  assert.equal(data.totalExpense, 30_000);
  assert.equal(data.netBalance, 70_000);
  assert.ok(!data.expenseByCat.has("Transfer"), "transfer must never feed expense donut");
  assert.ok(!data.incomeByCat.has("Transfer"), "transfer must never feed income");
});

/* ── Budgets ignore transfers; admin fee (Other) still counts ── */
test("calculateBudget ignores transfers but counts an Other admin fee", () => {
  const period = "2026-10";
  const foodBudget = { id: "b-food", categoryId: "Food", baseAmount: 1_000_000, period, topUps: [] };
  const otherBudget = { id: "b-other", categoryId: "Other", baseAmount: 1_000_000, period, topUps: [] };
  const txns = [
    transfer({ id: "t", amount: 500_000, date: "2026-10-05" }),
    txn({ id: "fee", name: "Admin fee", category: "Other", amount: 1_000, date: "2026-10-05" }),
    txn({ id: "food", amount: 100_000, date: "2026-10-05" }),
  ];
  assert.equal(calculateBudget(foodBudget, txns, period).spent, 100_000);
  assert.equal(calculateBudget(otherBudget, txns, period).spent, 1_000);
});
