"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const history_1 = require("../src/lib/history");
let seq = 0;
function txn(partial = {}) {
    seq += 1;
    return {
        id: `h${seq}`,
        name: "Lunch",
        category: "Food",
        amount: 50000,
        isExpense: true,
        pocketId: "p1",
        time: "12:00",
        date: "2026-10-05",
        ...partial,
    };
}
const BASE = { ...history_1.DEFAULT_HISTORY_FILTERS };
/* ── Date range validation ── */
(0, node_test_1.default)("null range is valid, empty edges invalid, reversed invalid", () => {
    strict_1.default.equal((0, history_1.isValidDateRange)(null), true);
    strict_1.default.equal((0, history_1.isValidDateRange)({ start: "", end: "" }), false);
    strict_1.default.equal((0, history_1.isValidDateRange)({ start: "2026-10-07", end: "2026-10-01" }), false);
    strict_1.default.equal((0, history_1.isValidDateRange)({ start: "2026-10-01", end: "2026-10-07" }), true);
});
(0, node_test_1.default)("invalid custom range filters to safe empty list", () => {
    const txns = [txn()];
    const out = (0, history_1.filterTransactions)(txns, BASE, { start: "2026-10-07", end: "2026-10-01" });
    strict_1.default.deepEqual(out, []);
});
/* ── Type / wallet / starred filters ── */
(0, node_test_1.default)("type filter separates income and expense", () => {
    const txns = [
        txn({ id: "e1", isExpense: true }),
        txn({ id: "i1", isExpense: false, category: "Salary" }),
    ];
    strict_1.default.deepEqual((0, history_1.filterTransactions)(txns, { ...BASE, type: "expense" }, null).map((t) => t.id), ["e1"]);
    strict_1.default.deepEqual((0, history_1.filterTransactions)(txns, { ...BASE, type: "income" }, null).map((t) => t.id), ["i1"]);
});
(0, node_test_1.default)("wallet and starred filters combine", () => {
    const txns = [
        txn({ id: "a", pocketId: "p1", starred: true }),
        txn({ id: "b", pocketId: "p2", starred: true }),
        txn({ id: "c", pocketId: "p1" }),
    ];
    const out = (0, history_1.filterTransactions)(txns, { ...BASE, pocketId: "p1", onlyStarred: true }, null);
    strict_1.default.deepEqual(out.map((t) => t.id), ["a"]);
});
(0, node_test_1.default)("date range is inclusive on both edges", () => {
    const txns = [
        txn({ id: "s", date: "2026-10-01" }),
        txn({ id: "m", date: "2026-10-04" }),
        txn({ id: "e", date: "2026-10-07" }),
        txn({ id: "out", date: "2026-10-08" }),
    ];
    const out = (0, history_1.filterTransactions)(txns, BASE, { start: "2026-10-01", end: "2026-10-07" });
    strict_1.default.deepEqual(out.map((t) => t.id).sort(), ["e", "m", "s"]);
});
/* ── Sorting ── */
(0, node_test_1.default)("sort orders by date and amount with stable id tie-break", () => {
    const txns = [
        txn({ id: "b", date: "2026-10-03", amount: 20000 }),
        txn({ id: "a", date: "2026-10-03", amount: 20000 }),
        txn({ id: "c", date: "2026-10-01", amount: 99000 }),
    ];
    strict_1.default.deepEqual((0, history_1.sortTransactions)(txns, "newest").map((t) => t.id), ["a", "b", "c"]);
    strict_1.default.deepEqual((0, history_1.sortTransactions)(txns, "oldest").map((t) => t.id), ["c", "a", "b"]);
    strict_1.default.deepEqual((0, history_1.sortTransactions)(txns, "amount-desc").map((t) => t.id), ["c", "a", "b"]);
    strict_1.default.deepEqual((0, history_1.sortTransactions)(txns, "amount-asc").map((t) => t.id), ["a", "b", "c"]);
});
/* ── Grouping ── */
(0, node_test_1.default)("groupByDay totals income minus expense and counts items", () => {
    const txns = [
        txn({ id: "e", date: "2026-10-05", amount: 30000, isExpense: true }),
        txn({ id: "i", date: "2026-10-05", amount: 100000, isExpense: false }),
    ];
    const groups = (0, history_1.groupByDay)(txns, "newest", new Date(2026, 9, 7));
    strict_1.default.equal(groups.length, 1);
    strict_1.default.equal(groups[0].count, 2);
    strict_1.default.equal(groups[0].total, 70000);
    strict_1.default.equal(groups[0].key, "2026-10-05");
});
(0, node_test_1.default)("groups order newest-first unless oldest sort", () => {
    const txns = [txn({ id: "old", date: "2026-10-01" }), txn({ id: "new", date: "2026-10-06" })];
    strict_1.default.deepEqual((0, history_1.groupByDay)(txns, "newest").map((g) => g.key), ["2026-10-06", "2026-10-01"]);
    strict_1.default.deepEqual((0, history_1.groupByDay)(txns, "oldest").map((g) => g.key), ["2026-10-01", "2026-10-06"]);
});
(0, node_test_1.default)("day labels use English Today/Yesterday then full date", () => {
    const now = new Date(2026, 9, 7, 12, 0, 0);
    strict_1.default.equal((0, history_1.friendlyDayLabel)(new Date(2026, 9, 7), now), "Today");
    strict_1.default.equal((0, history_1.friendlyDayLabel)(new Date(2026, 9, 6), now), "Yesterday");
    const older = (0, history_1.friendlyDayLabel)(new Date(2026, 9, 1), now);
    strict_1.default.ok(older.includes("October"), `expected English month, got: ${older}`);
    strict_1.default.ok((0, history_1.fullDateLabel)(new Date(2026, 9, 7)).includes("Wednesday"));
});
/* ── Display names ── */
(0, node_test_1.default)("generic stored names fall back to category, real names kept", () => {
    strict_1.default.equal((0, history_1.displayName)(txn({ name: "Expense", category: "Food" })), "Food");
    strict_1.default.equal((0, history_1.displayName)(txn({ name: "  PEMASUKAN ", category: "Salary" })), "Salary");
    strict_1.default.equal((0, history_1.displayName)(txn({ name: "  ", category: "Food" })), "Food");
    strict_1.default.equal((0, history_1.displayName)(txn({ name: "Bakso Pak Kumis", category: "Food" })), "Bakso Pak Kumis");
});
/* ── Chips ── */
(0, node_test_1.default)("defaults produce no chips; each active filter adds one", () => {
    strict_1.default.deepEqual((0, history_1.activeChips)(BASE, null, "newest", (id) => id), []);
    const chips = (0, history_1.activeChips)({ type: "expense", pocketId: "p1", onlyStarred: true }, { start: "2026-10-01", end: "2026-10-07" }, "amount-desc", (id) => (id === "p1" ? "BCA" : id));
    strict_1.default.equal(chips.length, 5);
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c.label]));
    strict_1.default.equal(byKey.type, "Expense");
    strict_1.default.equal(byKey.pocket, "BCA");
    strict_1.default.equal(byKey.starred, "Starred");
    strict_1.default.equal(byKey.range, "Date range");
    strict_1.default.equal(byKey.sort, "Sort");
});
/* ── CSV ── */
(0, node_test_1.default)("CSV has English header and escapes commas/quotes/newlines", () => {
    const txns = [
        txn({
            date: "2026-10-05",
            time: "12:00",
            isExpense: true,
            category: "Food",
            name: 'Lunch, "special"',
            note: "line1\nline2",
            pocketId: "p1",
            amount: 49999.6,
        }),
    ];
    const csv = (0, history_1.toCSV)(txns, () => "BCA, Main");
    const lines = csv.split("\r\n");
    strict_1.default.equal(lines[0], "Date,Time,Type,Category,Name,Note,Wallet,Amount (Rp)");
    strict_1.default.ok(lines[1].includes('"Lunch, ""special"""'), `escaping broken: ${lines[1]}`);
    strict_1.default.ok(lines[1].includes('"line1\nline2"'), `newline escaping broken: ${lines[1]}`);
    strict_1.default.ok(lines[1].includes('"BCA, Main"'), `wallet escaping broken: ${lines[1]}`);
    strict_1.default.ok(lines[1].endsWith(",50000"), `amount must round: ${lines[1]}`);
    strict_1.default.ok(!csv.includes("undefined") && !csv.includes("NaN"));
});
/* ── Calendar grid ── */
(0, node_test_1.default)("month grid always 42 Monday-first days containing the month", () => {
    const days = (0, history_1.monthGrid)(2026, 9); // October 2026
    strict_1.default.equal(days.length, 42);
    strict_1.default.equal(days[0].getDay(), 1, "grid must start on Monday");
    strict_1.default.ok(days.some((d) => d.getMonth() === 9 && d.getDate() === 7));
    for (let i = 1; i < days.length; i++) {
        strict_1.default.equal(days[i].getTime() - days[i - 1].getTime(), 86400000);
    }
});
(0, node_test_1.default)("isoDay pads month/day and monthYearLabel is English", () => {
    strict_1.default.equal((0, history_1.isoDay)(new Date(2026, 0, 5)), "2026-01-05");
    strict_1.default.equal((0, history_1.isoDay)(new Date(2026, 9, 7)), "2026-10-07");
    strict_1.default.equal((0, history_1.monthYearLabel)(2026, 9), "October 2026");
    strict_1.default.equal((0, history_1.monthYearLabel)(2026, 0), "January 2026");
});
