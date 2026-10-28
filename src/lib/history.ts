import type { Transaction } from "../store/useFinanceStore";
import { parseDateStr } from "./insights/utils";

export type TypeFilter = "all" | "income" | "expense" | "transfer";
export type SortKey = "newest" | "oldest" | "amount-desc" | "amount-asc";

export interface HistoryFilters {
  type: TypeFilter;
  pocketId: string; // "" = all wallets
  onlyStarred: boolean;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  type: "all",
  pocketId: "",
  onlyStarred: false,
};

export interface DateRangeISO {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** Reversed range (end < start) is invalid. */
export function isValidDateRange(range: DateRangeISO | null): boolean {
  if (!range) return true;
  if (!range.start || !range.end) return false;
  return range.start <= range.end;
}

/** Apply every filter at once. Invalid custom range → safe empty list. */
export function filterTransactions(
  transactions: Transaction[],
  filters: HistoryFilters,
  range: DateRangeISO | null
): Transaction[] {
  if (!isValidDateRange(range)) return [];

  let start: Date | null = null;
  let end: Date | null = null;
  if (range?.start && range?.end) {
    start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    end = new Date(range.end);
    end.setHours(23, 59, 59, 999);
  }

  return transactions.filter((t) => {
    if (filters.type === "income" && (t.isExpense || t.isTransfer)) return false;
    if (filters.type === "expense" && (!t.isExpense || t.isTransfer)) return false;
    if (filters.type === "transfer" && !t.isTransfer) return false;
    // A wallet filter keeps transfers where that wallet is source OR destination.
    if (filters.pocketId && t.pocketId !== filters.pocketId && t.transferToPocketId !== filters.pocketId) return false;
    if (filters.onlyStarred && !t.starred) return false;
    if (start && end) {
      const d = parseDateStr(t.date);
      if (Number.isNaN(d.getTime()) || d < start || d > end) return false;
    }
    return true;
  });
}

function txnTime(t: Transaction): number {
  const d = parseDateStr(t.date);
  const base = Number.isNaN(d.getTime()) ? 0 : d.getTime();
  const hm = t.time.match(/(\d{1,2}):(\d{2})/);
  if (hm) return base + parseInt(hm[1], 10) * 3600000 + parseInt(hm[2], 10) * 60000;
  return base;
}

/** Sort + id tie-breaker so equal keys stay stable. */
export function sortTransactions(transactions: Transaction[], sort: SortKey): Transaction[] {
  const arr = transactions.slice();
  const tie = (a: Transaction, b: Transaction) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
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

export interface DayGroup {
  key: string; // YYYY-MM-DD
  label: string; // "Today" | "Yesterday" | "October 7, 2026"
  dateLabel: string; // full date for aria
  total: number; // income − expense
  count: number;
  items: Transaction[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function friendlyDayLabel(d: Date, now: Date = new Date()): string {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fullDateLabel(d: Date): string {
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

export function displayName(t: Transaction): string {
  const n = (t.name ?? "").trim();
  if (GENERIC_NAMES.has(n.toLowerCase())) return t.category || "Transaction";
  if (t.isTransfer) {
    return t.name || "Transfer";
  }
  return n;
}

/** Group per day, groups ordered by `sort` (newest first unless oldest). */
export function groupByDay(
  transactions: Transaction[],
  sort: SortKey,
  now: Date = new Date()
): DayGroup[] {
  const sorted = sortTransactions(transactions, sort);
  const keys: string[] = [];
  const map: Record<string, DayGroup> = {};
  sorted.forEach((t) => {
    const d = parseDateStr(t.date);
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
    // Transfers move money between wallets — never part of a day's income/expense.
    if (!t.isTransfer) g.total += t.isExpense ? -t.amount : t.amount;
    g.count += 1;
  });
  const groups = keys.map((k) => map[k]);
  if (sort === "oldest") return groups.sort((a, b) => (a.key < b.key ? -1 : 1));
  return groups.sort((a, b) => (a.key > b.key ? -1 : 1));
}

export interface ActiveChip {
  key: string;
  label: string;
}

/** Active filters for removable chips. Defaults never count. */
export function activeChips(
  filters: HistoryFilters,
  range: DateRangeISO | null,
  sort: SortKey,
  pocketLabel: (id: string) => string
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.type !== "all")
    chips.push({
      key: "type",
      label:
        filters.type === "income"
          ? "Income"
          : filters.type === "expense"
          ? "Expense"
          : "Transfer",
    });
  if (range) chips.push({ key: "range", label: "Date range" });
  if (filters.pocketId) chips.push({ key: "pocket", label: pocketLabel(filters.pocketId) });
  if (filters.onlyStarred) chips.push({ key: "starred", label: "Starred" });
  if (sort !== "newest") chips.push({ key: "sort", label: "Sort" });
  return chips;
}

/** Escape CSV values (commas, quotes, newlines). */
function csvCell(v: string | number | boolean): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export the actively filtered transactions to CSV (opens in spreadsheets). */
export function toCSV(transactions: Transaction[], pocketName: (id: string) => string): string {
  const header = ["Date", "Time", "Type", "Category", "Name", "Note", "Wallet", "Amount (Rp)"];
  const lines = [header.map(csvCell).join(",")];
  transactions.forEach((t) => {
    lines.push(
      [
        t.date,
        t.time,
        t.isTransfer ? "Transfer" : t.isExpense ? "Expense" : "Income",
        t.category,
        t.name,
        t.note ?? "",
        t.isTransfer && t.transferToPocketId
          ? `${pocketName(t.pocketId)} → ${pocketName(t.transferToPocketId)}`
          : pocketName(t.pocketId),
        Math.round(t.amount),
      ]
        .map(csvCell)
        .join(",")
    );
  });
  return lines.join("\r\n");
}

/** Month grid for the custom date picker (en-US, Monday-first). */
export function monthGrid(year: number, month: number): Date[] {
  // Monday-first offset
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthYearLabel(year: number, month: number): string {
  return `${EN_MONTHS[month]} ${year}`;
}
