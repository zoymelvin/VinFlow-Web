"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HISTORY_FILTERS = void 0;
exports.isValidDateRange = isValidDateRange;
exports.filterTransactions = filterTransactions;
exports.sortTransactions = sortTransactions;
exports.friendlyDayLabel = friendlyDayLabel;
exports.fullDateLabel = fullDateLabel;
exports.displayName = displayName;
exports.groupByDay = groupByDay;
exports.activeChips = activeChips;
exports.toCSV = toCSV;
exports.monthGrid = monthGrid;
exports.isoDay = isoDay;
exports.monthYearLabel = monthYearLabel;
const utils_1 = require("./insights/utils");
exports.DEFAULT_HISTORY_FILTERS = {
    type: "all",
    pocketId: "",
    onlyStarred: false,
};
/** Reversed range (end < start) is invalid. */
function isValidDateRange(range) {
    if (!range)
        return true;
    if (!range.start || !range.end)
        return false;
    return range.start <= range.end;
}
/** Apply every filter at once. Invalid custom range → safe empty list. */
function filterTransactions(transactions, filters, range) {
    if (!isValidDateRange(range))
        return [];
    let start = null;
    let end = null;
    if (range?.start && range?.end) {
        start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(range.end);
        end.setHours(23, 59, 59, 999);
    }
    return transactions.filter((t) => {
        if (filters.type === "income" && (t.isExpense || t.isTransfer))
            return false;
        if (filters.type === "expense" && (!t.isExpense || t.isTransfer))
            return false;
        if (filters.type === "transfer" && !t.isTransfer)
            return false;
        if (filters.pocketId && t.pocketId !== filters.pocketId)
            return false;
        if (filters.onlyStarred && !t.starred)
            return false;
        if (start && end) {
            const d = (0, utils_1.parseDateStr)(t.date);
            if (Number.isNaN(d.getTime()) || d < start || d > end)
                return false;
        }
        return true;
    });
}
function txnTime(t) {
    const d = (0, utils_1.parseDateStr)(t.date);
    const base = Number.isNaN(d.getTime()) ? 0 : d.getTime();
    const hm = t.time.match(/(\d{1,2}):(\d{2})/);
    if (hm)
        return base + parseInt(hm[1], 10) * 3600000 + parseInt(hm[2], 10) * 60000;
    return base;
}
/** Sort + id tie-breaker so equal keys stay stable. */
function sortTransactions(transactions, sort) {
    const arr = transactions.slice();
    const tie = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    switch (sort) {
        case "newest":
            return arr.sort((a, b) => txnTime(b) - txnTime(a) || tie(a, b));
        case "oldest":
            return arr.sort((a, b) => txnTime(a) - txnTime(b) || tie(a, b));
        case "amount-desc":
            return arr.sort((a, b) => b.amount - a.amount || tie(a, b));
        case "amount-asc":
            return arr.sort((a, b) => a.amount - b.amount || tie(a, b));
    }
}
function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function friendlyDayLabel(d, now = new Date()) {
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (diff === 0)
        return "Today";
    if (diff === 1)
        return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function fullDateLabel(d) {
    return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}
/**
 * Pretty transaction title: fall back to category when the stored name is
 * empty or just a generic type word (Expense/Income/Pengeluaran/Pemasukan).
 * Never rewrites real user content.
 */
const GENERIC_NAMES = new Set(["expense", "income", "pengeluaran", "pemasukan", ""]);
function displayName(t) {
    const n = (t.name ?? "").trim();
    if (GENERIC_NAMES.has(n.toLowerCase()))
        return t.category || "Transaction";
    if (t.isTransfer) {
        return t.name || "Transfer";
    }
    return n;
}
/** Group per day, groups ordered by `sort` (newest first unless oldest). */
function groupByDay(transactions, sort, now = new Date()) {
    const sorted = sortTransactions(transactions, sort);
    const keys = [];
    const map = {};
    sorted.forEach((t) => {
        const d = (0, utils_1.parseDateStr)(t.date);
        const valid = !Number.isNaN(d.getTime());
        const key = valid ? dayKey(d) : "unknown-date";
        let g = map[key];
        if (!g) {
            g = {
                key,
                label: valid ? friendlyDayLabel(d, now) : "Unknown date",
                dateLabel: valid ? fullDateLabel(d) : "",
                total: 0,
                count: 0,
                items: [],
            };
            map[key] = g;
            keys.push(key);
        }
        g.items.push(t);
        g.total += t.isExpense ? -t.amount : t.amount;
        g.count += 1;
    });
    const groups = keys.map((k) => map[k]);
    if (sort === "oldest")
        return groups.sort((a, b) => (a.key < b.key ? -1 : 1));
    return groups.sort((a, b) => (a.key > b.key ? -1 : 1));
}
/** Active filters for removable chips. Defaults never count. */
function activeChips(filters, range, sort, pocketLabel) {
    const chips = [];
    if (filters.type !== "all")
        chips.push({
            key: "type",
            label: filters.type === "income"
                ? "Income"
                : filters.type === "expense"
                    ? "Expense"
                    : "Transfer",
        });
    if (range)
        chips.push({ key: "range", label: "Date range" });
    if (filters.pocketId)
        chips.push({ key: "pocket", label: pocketLabel(filters.pocketId) });
    if (filters.onlyStarred)
        chips.push({ key: "starred", label: "Starred" });
    if (sort !== "newest")
        chips.push({ key: "sort", label: "Sort" });
    return chips;
}
/** Escape CSV values (commas, quotes, newlines). */
function csvCell(v) {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Export the actively filtered transactions to CSV (opens in spreadsheets). */
function toCSV(transactions, pocketName) {
    const header = ["Date", "Time", "Type", "Category", "Name", "Note", "Wallet", "Amount (Rp)"];
    const lines = [header.map(csvCell).join(",")];
    transactions.forEach((t) => {
        lines.push([
            t.date,
            t.time,
            t.isExpense ? "Expense" : "Income",
            t.category,
            t.name,
            t.note ?? "",
            pocketName(t.pocketId),
            Math.round(t.amount),
        ]
            .map(csvCell)
            .join(","));
    });
    return lines.join("\r\n");
}
/** Month grid for the custom date picker (en-US, Monday-first). */
function monthGrid(year, month) {
    // Monday-first offset
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
        days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
}
function isoDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const EN_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
function monthYearLabel(year, month) {
    return `${EN_MONTHS[month]} ${year}`;
}
