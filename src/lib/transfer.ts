import type { Pocket } from "../store/useFinanceStore";
import { formatIDR } from "./settings";

/* ── Shared limits ──────────────────────────────────── */
export const MAX_AMOUNT = 999_999_999_999;
const MAX_DIGITS = 12; // MAX_AMOUNT has 12 digits

/**
 * Pure helpers for the Transfer form — no store, no DOM. Kept here so the
 * input cleaning, formatting, validation and route-param parsing are unit
 * testable and single-sourced. The store remains the only authority that
 * mutates balances.
 */

/** Digit-only, no leading zeros, capped at 12 digits. Paste is cleaned. */
export function sanitizeAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
  return digits;
}

/** Indonesian thousand grouping for display while typing ("50.000"). */
export function formatAmountGrouped(digits: string): string {
  if (digits === "") return "";
  return Number(digits).toLocaleString("id-ID");
}

/** The integer to send to the store action (0 when empty). */
export function parseAmountToInteger(digits: string): number {
  return digits === "" ? 0 : Number(digits);
}

/**
 * Post-transfer balances. Source drops by amount + admin fee; destination
 * gains the amount. Fee is a normal expense, never part of the move.
 */
export function computeBalancesAfter(opts: {
  fromBalance: number;
  toBalance: number;
  amount: number;
  adminFee: number;
}): { fromAfter: number; toAfter: number } {
  return {
    fromAfter: opts.fromBalance - (opts.amount + opts.adminFee),
    toAfter: opts.toBalance + opts.amount,
  };
}

/**
 * Client-side balance check for live form feedback. The store re-validates
 * on submit — this only shapes the message, it never moves money.
 */
export function validateAmountForBalance(opts: {
  amount: number;
  adminFee: number;
  fromBalance: number;
}): { ok: boolean; available: number } {
  const available = Math.max(0, opts.fromBalance - opts.adminFee);
  return { ok: opts.amount <= available, available };
}

/** Button text mirrors the typed amount ("Transfer" while it is zero). */
export function transferButtonLabel(digits: string): string {
  const n = parseAmountToInteger(digits);
  return n > 0 ? `Transfer ${formatIDR(n)}` : "Transfer";
}

/** Quick-chip allowances: adds are capped by what the source can cover. */
export function clampAddedAmount(current: number, add: number, allowance: number): number {
  return Math.min(current + add, allowance, MAX_AMOUNT);
}

/** Safe parsing of /transfer?from=…&to=…&amount=… — invalid entries ignored. */
export function parseTransferRouteParams(search: string): {
  fromId?: string;
  toId?: string;
  amount?: number;
} {
  const params = new URLSearchParams(search);
  const fromId = params.get("from");
  const toId = params.get("to");
  const amountRaw = params.get("amount");
  const amount =
    amountRaw !== null && /^\d{1,12}$/.test(amountRaw) ? Number(amountRaw) : null;
  return {
    fromId: fromId && fromId.trim() !== "" ? fromId : undefined,
    toId: toId && toId.trim() !== "" ? toId : undefined,
    amount: amount !== null && amount > 0 && amount <= MAX_AMOUNT ? amount : undefined,
  };
}

/**
 * Initial From/To resolution. From: route param (if it exists) else the
 * wallet with the largest balance. To: route param different from From,
 * else the first other wallet — a From==To route pair is auto-repaired to
 * a different To, never silently allowed.
 */
export function resolveInitialSelection(
  pockets: Pocket[],
  params: { fromId?: string; toId?: string }
): { from: string; to: string } | null {
  if (pockets.length < 2) return null;

  const exists = (id: string | undefined) =>
    id !== undefined && pockets.some((p) => p.id === id);

  let fromId = exists(params.fromId) ? params.fromId : undefined;
  if (!fromId) {
    fromId = [...pockets].sort((a, b) => b.balance - a.balance)[0]!.id;
  }

  let toId = exists(params.toId) && params.toId !== fromId ? params.toId : undefined;
  if (!toId) {
    toId = pockets.find((p) => p.id !== fromId)!.id;
  }
  return { from: fromId, to: toId };
}

/* ── Post-transfer handoff (module-level, like Home's entrance flag) ──
 * The Transfer page records what just happened; the Wallets page consumes
 * it on next mount to run the balance count-up and show the toast. Plain
 * module state: it survives client-side navigation, needs no store slot,
 * and is consumed once.
 */
export interface PendingTransferResult {
  fromPocketId: string;
  toPocketId: string;
  fromBefore: number;
  toBefore: number;
  amount: number;
  fromName: string;
  toName: string;
  toast: string;
}

let pending: PendingTransferResult | null = null;

export function setPendingTransferResult(result: PendingTransferResult): void {
  pending = result;
}

export function takePendingTransferResult(): PendingTransferResult | null {
  const result = pending;
  pending = null;
  return result;
}
