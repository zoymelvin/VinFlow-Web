import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HISTORY_FILTERS,
  activeChips,
  displayName,
  filterTransactions,
  friendlyDayLabel,
  fullDateLabel,
  groupByDay,
  isValidDateRange,
  isoDay,
  monthGrid,
  monthYearLabel,
  sortTransactions,
  toCSV,
  type HistoryFilters,
} from "../src/lib/history";
import type { Transaction } from "../src/store/useFinanceStore";

let seq = 0;
function txn(partial: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `h${seq}`,
    name: "Lunch",
    category: "Food",
    amount: 50_000,
    isExpense: true,
    pocketId: "p1",
    time: "12:00",
    date: "2026-10-05",
    ...partial,
  };
}

const BASE: HistoryFilters = { ...DEFAULT_HISTORY_FILTERS };

/* ── Date range validation ── */
test("null range is valid, empty edges invalid, reversed invalid", () => {
  assert.equal(isValidDateRange(null), true);
  assert.equal(isValidDateRange({ start: "", end: "" }), false);
  assert.equal(isValidDateRange({ start: "2026-10-07", end: "2026-10-01" }), false);
  assert.equal(isValidDateRange({ start: "2026-10-01", end: "2026-10-07" }), true);
});

test("invalid custom range filters to safe empty list", () => {
  const txns = [txn()];
  const out = filterTransactions(txns, BASE, { start: "2026-10-07", end: "2026-10-01" });
  assert.deepEqual(out, []);
});

/* ── Type / wallet / starred filters ── */
test("type filter separates income and expense", () => {
  const txns = [
    txn({ id: "e1", isExpense: true }),
    txn({ id: "i1", isExpense: false, category: "Salary" }),
  ];
  assert.deepEqual(
    filterTransactions(txns, { ...BASE, type: "expense" }, null).map((t) => t.id),
    ["e1"]
  );
  assert.deepEqual(
    filterTransactions(txns, { ...BASE, type: "income" }, null).map((t) => t.id),
    ["i1"]
  );
});

test("wallet and starred filters combine", () => {
  const txns = [
    txn({ id: "a", pocketId: "p1", starred: true }),
    txn({ id: "b", pocketId: "p2", starred: true }),
    txn({ id: "c", pocketId: "p1" }),
  ];
  const out = filterTransactions(
    txns,
    { ...BASE, pocketId: "p1", onlyStarred: true },
    null
  );
  assert.deepEqual(out.map((t) => t.id), ["a"]);
});

test("date range is inclusive on both edges", () => {
  const txns = [
    txn({ id: "s", date: "2026-10-01" }),
    txn({ id: "m", date: "2026-10-04" }),
    txn({ id: "e", date: "2026-10-07" }),
    txn({ id: "out", date: "2026-10-08" }),
  ];
  const out = filterTransactions(txns, BASE, { start: "2026-10-01", end: "2026-10-07" });
  assert.deepEqual(out.map((t) => t.id).sort(), ["e", "m", "s"]);
});

/* ── Sorting ── */
test("sort orders by date and amount with stable id tie-break", () => {
  const txns = [
    txn({ id: "b", date: "2026-10-03", amount: 20_000 }),
    txn({ id: "a", date: "2026-10-03", amount: 20_000 }),
    txn({ id: "c", date: "2026-10-01", amount: 99_000 }),
  ];
  assert.deepEqual(
    sortTransactions(txns, "newest").map((t) => t.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    sortTransactions(txns, "oldest").map((t) => t.id),
    ["c", "a", "b"]
  );
  assert.deepEqual(
    sortTransactions(txns, "amount-desc").map((t) => t.id),
    ["c", "a", "b"]
  );
  assert.deepEqual(
    sortTransactions(txns, "amount-asc").map((t) => t.id),
    ["a", "b", "c"]
  );
});

/* ── Grouping ── */
test("groupByDay totals income minus expense and counts items", () => {
  const txns = [
    txn({ id: "e", date: "2026-10-05", amount: 30_000, isExpense: true }),
    txn({ id: "i", date: "2026-10-05", amount: 100_000, isExpense: false }),
  ];
  const groups = groupByDay(txns, "newest", new Date(2026, 9, 7));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].total, 70_000);
  assert.equal(groups[0].key, "2026-10-05");
});

test("groups order newest-first unless oldest sort", () => {
  const txns = [txn({ id: "old", date: "2026-10-01" }), txn({ id: "new", date: "2026-10-06" })];
  assert.deepEqual(
    groupByDay(txns, "newest").map((g) => g.key),
    ["2026-10-06", "2026-10-01"]
  );
  assert.deepEqual(
    groupByDay(txns, "oldest").map((g) => g.key),
    ["2026-10-01", "2026-10-06"]
  );
});

test("day labels use English Today/Yesterday then full date", () => {
  const now = new Date(2026, 9, 7, 12, 0, 0);
  assert.equal(friendlyDayLabel(new Date(2026, 9, 7), now), "Today");
  assert.equal(friendlyDayLabel(new Date(2026, 9, 6), now), "Yesterday");
  const older = friendlyDayLabel(new Date(2026, 9, 1), now);
  assert.ok(older.includes("October"), `expected English month, got: ${older}`);
  assert.ok(fullDateLabel(new Date(2026, 9, 7)).includes("Wednesday"));
});

/* ── Display names ── */
test("generic stored names fall back to category, real names kept", () => {
  assert.equal(displayName(txn({ name: "Expense", category: "Food" })), "Food");
  assert.equal(displayName(txn({ name: "  PEMASUKAN ", category: "Salary" })), "Salary");
  assert.equal(displayName(txn({ name: "  ", category: "Food" })), "Food");
  assert.equal(displayName(txn({ name: "Bakso Pak Kumis", category: "Food" })), "Bakso Pak Kumis");
});

/* ── Chips ── */
test("defaults produce no chips; each active filter adds one", () => {
  assert.deepEqual(activeChips(BASE, null, "newest", (id) => id), []);
  const chips = activeChips(
    { type: "expense", pocketId: "p1", onlyStarred: true },
    { start: "2026-10-01", end: "2026-10-07" },
    "amount-desc",
    (id) => (id === "p1" ? "BCA" : id)
  );
  assert.equal(chips.length, 5);
  const byKey = Object.fromEntries(chips.map((c) => [c.key, c.label]));
  assert.equal(byKey.type, "Expense");
  assert.equal(byKey.pocket, "BCA");
  assert.equal(byKey.starred, "Starred");
  assert.equal(byKey.range, "Date range");
  assert.equal(byKey.sort, "Sort");
});

/* ── CSV ── */
test("CSV has English header and escapes commas/quotes/newlines", () => {
  const txns = [
    txn({
      date: "2026-10-05",
      time: "12:00",
      isExpense: true,
      category: "Food",
      name: 'Lunch, "special"',
      note: "line1\nline2",
      pocketId: "p1",
      amount: 49_999.6,
    }),
  ];
  const csv = toCSV(txns, () => "BCA, Main");
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Date,Time,Type,Category,Name,Note,Wallet,Amount (Rp)");
  assert.ok(lines[1].includes('"Lunch, ""special"""'), `escaping broken: ${lines[1]}`);
  assert.ok(lines[1].includes('"line1\nline2"'), `newline escaping broken: ${lines[1]}`);
  assert.ok(lines[1].includes('"BCA, Main"'), `wallet escaping broken: ${lines[1]}`);
  assert.ok(lines[1].endsWith(",50000"), `amount must round: ${lines[1]}`);
  assert.ok(!csv.includes("undefined") && !csv.includes("NaN"));
});

/* ── Calendar grid ── */
test("month grid always 42 Monday-first days containing the month", () => {
  const days = monthGrid(2026, 9); // October 2026
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1, "grid must start on Monday");
  assert.ok(days.some((d) => d.getMonth() === 9 && d.getDate() === 7));
  for (let i = 1; i < days.length; i++) {
    assert.equal(days[i].getTime() - days[i - 1].getTime(), 86_400_000);
  }
});

test("isoDay pads month/day and monthYearLabel is English", () => {
  assert.equal(isoDay(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(isoDay(new Date(2026, 9, 7)), "2026-10-07");
  assert.equal(monthYearLabel(2026, 9), "October 2026");
  assert.equal(monthYearLabel(2026, 0), "January 2026");
});
