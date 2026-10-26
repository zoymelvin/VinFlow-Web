/** Pure settings helpers — no browser APIs at load, fully testable. */

import type { Pocket, Transaction, Budget, Goal, GoalSaving } from "../store/useFinanceStore";

export interface ProfileSettings {
  name: string;
  /** Compressed data-URL, empty when no photo. */
  photo: string;
}

export interface AppSettingsState {
  profile: ProfileSettings;
  hideBalance: boolean;
}

export const DEFAULT_SETTINGS: AppSettingsState = {
  profile: { name: "Joy Melvin", photo: "" },
  hideBalance: false,
};

/** "Joy Melvin" → "JM". Empty → "?". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Enforce 1..30 chars after trim. */
export function validateName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Name cannot be empty.";
  if (t.length > 30) return "Name must be 30 characters or fewer.";
  return null;
}

/** IDR, no decimals. */
export function formatIDR(value: number): string {
  const digits = value < 1000 ? 2 : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Money display honoring Hide Balance. Masked value never leaks digits. */
export function formatMoneyDisplay(
  value: number,
  opts?: { hide?: boolean; revealed?: boolean }
): string {
  if (opts?.hide && !opts?.revealed) return "Rp ••••••";
  return formatIDR(value);
}

export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
}

/* ── Backup export / import (pure shape handling) ── */

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: "vinflow";
  version: number;
  exportedAt: string;
  finance: { pockets: Pocket[]; transactions: Transaction[]; budgets: Budget[]; goals?: Goal[]; goalSavings?: GoalSaving[] };
  settings: unknown;
}

export function buildBackup(
  pockets: Pocket[],
  transactions: Transaction[],
  settings: AppSettingsState,
  budgets: Budget[] = [],
  goals: Goal[] = [],
  goalSavings: GoalSaving[] = [],
  now: Date = new Date()
): string {
  const payload: BackupPayload = {
    app: "vinflow",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    finance: { pockets, transactions, budgets, goals, goalSavings },
    settings,
  };
  return JSON.stringify(payload);
}

function isPocket(v: unknown): v is Pocket {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.balance === "number" &&
    typeof p.iconName === "string"
  );
}

function isTransaction(v: unknown): v is Transaction {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.category === "string" &&
    typeof t.amount === "number" &&
    typeof t.isExpense === "boolean" &&
    typeof t.pocketId === "string" &&
    typeof t.time === "string" &&
    typeof t.date === "string"
  );
}

function isBudget(v: unknown): v is Budget {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.category === "string" &&
    typeof b.amount === "number" &&
    typeof b.period === "string"
  );
}

function isGoal(v: unknown): v is Goal {
  if (!v || typeof v !== "object") return false;
  const g = v as Record<string, unknown>;
  return typeof g.id === "string" && typeof g.name === "string" && typeof g.target === "number" && typeof g.status === "string" && typeof g.createdAt === "string";
}
function isGoalSaving(v: unknown): v is GoalSaving {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.goalId === "string" && typeof s.amount === "number" && typeof s.pocketId === "string" && typeof s.date === "string";
}

export type ImportResult =
  | { ok: true; pockets: Pocket[]; transactions: Transaction[]; budgets: Budget[]; goals: Goal[]; goalSavings: GoalSaving[]; settings: unknown }
  | { ok: false; error: string };

/** Strict top level, lenient rows: drops malformed entries, rejects empty files. */
export function importBackupPayload(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "Backup file could not be read." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "Backup file is not valid." };
  const root = data as Record<string, unknown>;
  if (root.app !== "vinflow" || typeof root.version !== "number") {
    return { ok: false, error: "This file is not a VinFlow backup." };
  }
  const finance = root.finance as Record<string, unknown> | undefined;
  if (!finance || !Array.isArray(finance.pockets) || !Array.isArray(finance.transactions)) {
    return { ok: false, error: "Backup has no wallet or transaction data." };
  }
  const pockets = (finance.pockets as unknown[]).filter(isPocket);
  const transactions = (finance.transactions as unknown[]).filter(isTransaction);
  const budgets = Array.isArray(finance.budgets) ? (finance.budgets as unknown[]).filter(isBudget) : [];
  const goals = Array.isArray(finance.goals) ? (finance.goals as unknown[]).filter(isGoal) : [];
  const goalSavings = Array.isArray(finance.goalSavings)
    ? (finance.goalSavings as unknown[]).filter(isGoalSaving).filter((s) => goals.some((g) => g.id === (s as GoalSaving).goalId))
    : [];
  if (pockets.length === 0 && transactions.length === 0) {
    return { ok: false, error: "Backup contains no usable data." };
  }
  return { ok: true, pockets, transactions, budgets, goals, goalSavings, settings: root.settings ?? {} };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Migrate any persisted settings shape (legacy v0 with profile.tagline/
 * general/appearance, or anything garbage) to the current shape. Always
 * returns a safe, complete object.
 */
export function migrateSettings(persisted: unknown): AppSettingsState {
  if (!isRecord(persisted)) return { ...DEFAULT_SETTINGS };
  const profileRaw = isRecord(persisted.profile) ? persisted.profile : {};
  const appearanceRaw = isRecord(persisted.appearance) ? persisted.appearance : {};

  const name =
    typeof profileRaw.name === "string" && profileRaw.name.trim()
      ? profileRaw.name.trim().slice(0, 30)
      : DEFAULT_SETTINGS.profile.name;
  const photo =
    typeof profileRaw.photo === "string" && profileRaw.photo.startsWith("data:image/")
      ? profileRaw.photo
      : "";

  // New key wins; fall back to legacy appearance.hideBalance.
  const hideBalance =
    typeof persisted.hideBalance === "boolean"
      ? persisted.hideBalance
      : typeof appearanceRaw.hideBalance === "boolean"
        ? appearanceRaw.hideBalance
        : false;

  return { profile: { name, photo }, hideBalance };
}
