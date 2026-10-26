/**
 * Shared data contract for receipt scanning.
 * Used by: route.ts (server), page.tsx (client), tests.
 */

/* ── Scan result: the shape returned by /api/scan ─────────── */
export interface ScanResult {
  amount: number;          // integer rupiah (0 = not read)
  type: "expense" | "income" | "";
  date: string;            // YYYY-MM-DD or ""
  time: string;            // HH:mm or ""
  purpose: string;         // merchant / recipient / sender
  sourceWallet: string;    // e.g. "ShopeePay", "BCA"
  reference: string;       // transaction ref if visible
  confidence?: Record<string, number>;
}

/** Empty scan result — every field at its zero value. */
export function emptyScanResult(): ScanResult {
  return { amount: 0, type: "", date: "", time: "", purpose: "", sourceWallet: "", reference: "" };
}

/** Validate raw parsed JSON from the API and return a clean ScanResult.
 *  Invalid fields are left at their zero value (never throws). */
export function parseScanResult(raw: unknown): ScanResult {
  const r = emptyScanResult();
  if (!raw || typeof raw !== "object") return r;
  const d = raw as Record<string, unknown>;

  // amount — accept number or string with dots/commas (e.g. "48.000")
  if (typeof d.amount === "number" && d.amount > 0) {
    r.amount = Math.round(d.amount);
  } else if (typeof d.amount === "string") {
    const n = normalizeRupiah(d.amount);
    if (n > 0) r.amount = n;
  }

  if (typeof d.type === "string") {
    const t = d.type.toLowerCase().trim();
    if (t === "expense" || t === "income") r.type = t;
  }

  if (typeof d.date === "string" && d.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    r.date = d.date;
  }

  if (typeof d.time === "string" && d.time.match(/^\d{2}:\d{2}/)) {
    r.time = d.time.slice(0, 5);
  }

  if (typeof d.purpose === "string" && d.purpose.trim()) {
    r.purpose = d.purpose.trim();
  }

  if (typeof d.sourceWallet === "string" && d.sourceWallet.trim()) {
    r.sourceWallet = d.sourceWallet.trim();
  }

  if (typeof d.reference === "string" && d.reference.trim()) {
    r.reference = d.reference.trim();
  }

  return r;
}

/** True when at least amount OR purpose were read. */
export function isScanResultUsable(r: ScanResult): boolean {
  return r.amount > 0 || r.purpose.trim().length > 0;
}

/* ── Client-side form data (used by page.tsx) ────────────── */
export interface ReceiptData {
  amount: number;
  isExpense: boolean;
  date: string;
  merchant: string;      // purpose
  walletName: string;     // sourceWallet
  note: string;
  confidence: Record<string, number>;
}

/* ── Helpers ─────────────────────────────────────────────── */

export function normalizeRupiah(s: string): number {
  const clean = s.replace(/[^\d]/g, "");
  return parseInt(clean, 10) || 0;
}

/**
 * Match a sourceWallet string (from AI) against known wallet names.
 * Uses substring and Levenshtein distance.
 */
export function matchWallet(sourceWallet: string, pocketNames: string[]): string | null {
  if (!sourceWallet.trim()) return null;
  const sw = sourceWallet.toLowerCase();
  // Exact or substring match
  for (const name of pocketNames) {
    const n = name.toLowerCase();
    if (n === sw || n.includes(sw) || sw.includes(n)) return name;
  }
  // Fuzzy match
  for (const name of pocketNames) {
    if (levenshtein(sw, name.toLowerCase()) < 3) return name;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

export function detectExpense(text: string): boolean {
  const lower = text.toLowerCase();
  const expense = ["transfer", "bayar", "charge", "debit", "keluar"];
  const income = ["terima", "masuk", "kredit", "income"];
  const expenseMatch = expense.some((w) => lower.includes(w));
  const incomeMatch = income.some((w) => lower.includes(w));
  return expenseMatch && !incomeMatch;
}

export function validateAIOutput(data: unknown): ReceiptData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const amount = typeof d.amount === "number" && d.amount > 0 ? d.amount : null;
  const date = typeof d.date === "string" && d.date.match(/^\d{4}-\d{2}-\d{2}$/) ? d.date : null;
  const merchant =
    (typeof d.merchant === "string" && d.merchant.trim()) ||
    (typeof d.purpose === "string" && d.purpose.trim()) ||
    null;
  const walletName =
    (typeof d.walletName === "string" && d.walletName.trim()) ||
    (typeof d.sourceWallet === "string" && d.sourceWallet.trim()) ||
    null;
  if (!amount || !date || !merchant || !walletName) return null;
  const isExpense =
    typeof d.isExpense === "boolean"
      ? d.isExpense
      : typeof d.type === "string"
      ? d.type.toLowerCase() === "expense"
      : detectExpense(merchant);
  return {
    amount,
    isExpense,
    date,
    merchant,
    walletName,
    note: typeof d.note === "string" ? d.note : "",
    confidence: typeof d.confidence === "object" && d.confidence ? (d.confidence as Record<string, number>) : {},
  };
}

export function findDuplicate(
  txns: Array<{ amount: number; date: string; isExpense: boolean; pocketId: string }>,
  candidate: { amount: number; date: string; isExpense: boolean; pocketId: string }
): boolean {
  const threshold = Math.max(1, candidate.amount * 0.05);
  return txns.some(
    (t) =>
      Math.abs(t.amount - candidate.amount) <= threshold &&
      t.date === candidate.date &&
      t.isExpense === candidate.isExpense &&
      t.pocketId === candidate.pocketId
  );
}

/* ── Merchant → Category learning (localStorage) ────────── */
const MERCHANT_CAT_KEY = "vinflow-merchant-categories";
const MERCHANT_CAT_LIMIT = 100;

export type MerchantCategoryMap = Record<string, string>; // normalizedMerchant → categoryId

/** Normalize merchant name for lookup (lowercase, stripped punctuation, collapsed spaces). */
export function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Load the merchant→category map from localStorage. */
export function loadMerchantCategories(): MerchantCategoryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MERCHANT_CAT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as MerchantCategoryMap;
  } catch { /* ignore */ }
  return {};
}

/** Save a merchant→category mapping. Limits to ~100 entries (FIFO). */
export function saveMerchantCategory(merchant: string, categoryId: string): void {
  if (typeof window === "undefined") return;
  const key = normalizeMerchant(merchant);
  if (!key) return;
  const map = loadMerchantCategories();
  map[key] = categoryId;
  // Enforce limit — remove oldest entries
  const keys = Object.keys(map);
  if (keys.length > MERCHANT_CAT_LIMIT) {
    const excess = keys.length - MERCHANT_CAT_LIMIT;
    for (let i = 0; i < excess; i++) {
      delete map[keys[i]];
    }
  }
  try {
    localStorage.setItem(MERCHANT_CAT_KEY, JSON.stringify(map));
  } catch { /* ignore quota errors */ }
}

/** Look up a learned category for a merchant. Returns categoryId or null. */
export function lookupMerchantCategory(merchant: string): string | null {
  const key = normalizeMerchant(merchant);
  if (!key) return null;
  const map = loadMerchantCategories();
  return map[key] ?? null;
}

/* ── Image hash for caching ──────────────────────────────── */

/** Simple fast hash for a Blob/ArrayBuffer for cache keys. */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/* ── Scan result cache (sessionStorage) ──────────────────── */
const SCAN_CACHE_KEY = "vinflow-scan-cache";
const SCAN_CACHE_LIMIT = 30;

type CacheEntry = { hash: string; result: ScanResult };

function loadCache(): CacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SCAN_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCache(entries: CacheEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(entries.slice(-SCAN_CACHE_LIMIT)));
  } catch { /* ignore */ }
}

/** Get a cached scan result by image hash. Returns null if not found or result was empty/unusable. */
export function getCachedScan(hash: string): ScanResult | null {
  const entries = loadCache();
  const entry = entries.find((e) => e.hash === hash);
  if (!entry) return null;
  // Never serve cached empty/unusable results
  if (!isScanResultUsable(entry.result)) return null;
  return entry.result;
}

/** Cache a scan result. Only caches usable results. */
export function setCachedScan(hash: string, result: ScanResult): void {
  if (!isScanResultUsable(result)) return;
  const entries = loadCache().filter((e) => e.hash !== hash);
  entries.push({ hash, result });
  saveCache(entries);
}
