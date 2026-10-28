import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AMOUNT,
  clampAddedAmount,
  computeBalancesAfter,
  formatAmountGrouped,
  parseAmountToInteger,
  parseTransferRouteParams,
  resolveInitialSelection,
  sanitizeAmountInput,
  transferButtonLabel,
  validateAmountForBalance,
} from "../src/lib/transfer";
import { formatIDR } from "../src/lib/settings";

/* ── Input cleaning: digits only, no leading zeros, 12-digit cap ── */
test("sanitizeAmountInput keeps digits, strips paste noise, drops leading zeros", () => {
  assert.equal(sanitizeAmountInput("50.000"), "50000");
  assert.equal(sanitizeAmountInput("Rp 50.000"), "50000");
  assert.equal(sanitizeAmountInput("+50K"), "50");
  assert.equal(sanitizeAmountInput("abc"), "");
  assert.equal(sanitizeAmountInput("007"), "7");
  assert.equal(sanitizeAmountInput("0"), "");
  assert.equal(sanitizeAmountInput("1".repeat(15)), "1".repeat(12));
});

/* ── Display grouping (id-ID thousand separators) ── */
test("formatAmountGrouped renders id-ID grouping", () => {
  assert.equal(formatAmountGrouped(""), "");
  assert.equal(formatAmountGrouped("50000"), "50.000");
  assert.equal(formatAmountGrouped("121940"), "121.940");
  assert.equal(formatAmountGrouped("999999999999"), "999.999.999.999");
});

test("parseAmountToInteger maps empty to 0 and digits to an int", () => {
  assert.equal(parseAmountToInteger(""), 0);
  assert.equal(parseAmountToInteger("50000"), 50_000);
});

/* ── The spec's worked numbers ── */
test("computeBalancesAfter matches the ShopeePay/SeaBank example", () => {
  const res = computeBalancesAfter({
    fromBalance: 3_000_000, toBalance: 121_940, amount: 50_000, adminFee: 0,
  });
  assert.deepEqual(res, { fromAfter: 2_950_000, toAfter: 171_940 });
});

test("computeBalancesAfter deducts the fee from the source only", () => {
  const res = computeBalancesAfter({
    fromBalance: 3_000_000, toBalance: 121_940, amount: 50_000, adminFee: 1_000,
  });
  assert.deepEqual(res, { fromAfter: 2_949_000, toAfter: 171_940 });
});

test("computeBalancesAfter with empty amounts shows the current balances", () => {
  const res = computeBalancesAfter({ fromBalance: 100, toBalance: 200, amount: 0, adminFee: 0 });
  assert.deepEqual(res, { fromAfter: 100, toAfter: 200 });
});

/* ── Live funds validation (the store re-validates on submit) ── */
test("validateAmountForBalance flags over-balance amounts and reports availability", () => {
  const ok = validateAmountForBalance({ amount: 50_000, adminFee: 0, fromBalance: 3_000_000 });
  assert.equal(ok.ok, true);
  assert.equal(ok.available, 3_000_000);

  const bad = validateAmountForBalance({ amount: 50_000, adminFee: 1_000, fromBalance: 50_500 });
  assert.equal(bad.ok, false);
  assert.equal(bad.available, 49_500);

  const zero = validateAmountForBalance({ amount: 50_000, adminFee: 0, fromBalance: 0 });
  assert.equal(zero.ok, false);
  assert.equal(zero.available, 0);
});

/* ── Button label mirrors the typed amount ── */
test("transferButtonLabel shows the amount or plain Transfer", () => {
  assert.equal(transferButtonLabel(""), "Transfer");
  assert.equal(transferButtonLabel("50000"), `Transfer ${formatIDR(50_000)}`);
});

/* ── Quick chips are capped by what the source can cover ── */
test("clampAddedAmount caps at the allowance and MAX_AMOUNT", () => {
  assert.equal(clampAddedAmount(10_000, 50_000, 100_000), 60_000);
  assert.equal(clampAddedAmount(60_000, 100_000, 100_000), 100_000);
  assert.equal(clampAddedAmount(0, 500_000, 100_000), 100_000);
  assert.equal(clampAddedAmount(MAX_AMOUNT, 1, 2 * MAX_AMOUNT), MAX_AMOUNT);
});

/* ── Route params: unknown ids and garbage amounts are ignored silently ── */
test("parseTransferRouteParams reads safe values only", () => {
  const ok = parseTransferRouteParams("?from=sp&to=sb&amount=50000");
  assert.equal(ok.fromId, "sp");
  assert.equal(ok.toId, "sb");
  assert.equal(ok.amount, 50_000);

  const blanks = parseTransferRouteParams("?from=&to=sb&amount=abc");
  assert.equal(blanks.fromId, undefined);
  assert.equal(blanks.toId, "sb");
  assert.equal(blanks.amount, undefined);

  const overflow = parseTransferRouteParams("?amount=1234567890123");
  assert.equal(overflow.amount, undefined);

  const zero = parseTransferRouteParams("?amount=0");
  assert.equal(zero.amount, undefined);

  const none = parseTransferRouteParams("");
  assert.equal(none.fromId, undefined);
  assert.equal(none.toId, undefined);
  assert.equal(none.amount, undefined);
});

/* ── Initial selection resolution ── */
const POCKETS = [
  { id: "sp", name: "ShopeePay", category: "E-Wallet", balance: 3_000_000, iconName: "Smartphone" },
  { id: "sb", name: "SeaBank", category: "Bank", balance: 121_940, iconName: "Building" },
  { id: "cash", name: "Cash", category: "Cash", balance: 0, iconName: "Coins" },
] as Parameters<typeof resolveInitialSelection>[0];

test("resolveInitialSelection prefers route params, then largest balance", () => {
  const byParam = resolveInitialSelection(POCKETS, { fromId: "sb", toId: "sp" });
  assert.deepEqual(byParam, { from: "sb", to: "sp" });

  const fallback = resolveInitialSelection(POCKETS, {});
  assert.deepEqual(fallback, { from: "sp", to: "sb" }); // largest balance, first other
});

test("resolveInitialSelection repairs a From == To route pair", () => {
  const repaired = resolveInitialSelection(POCKETS, { fromId: "sp", toId: "sp" });
  assert.equal(repaired?.from, "sp");
  assert.notEqual(repaired?.to, "sp");
});

test("resolveInitialSelection tolerates unknown ids and too few wallets", () => {
  assert.deepEqual(resolveInitialSelection(POCKETS, { fromId: "ghost", toId: "phantom" }), {
    from: "sp", to: "sb",
  });
  assert.equal(resolveInitialSelection(POCKETS.slice(0, 1), {}), null);
});

test("resolveInitialSelection still picks a real wallet when only a zero wallet remains", () => {
  const only = [POCKETS[0], POCKETS[2]]; // sp + zero-balance cash
  const res = resolveInitialSelection(only, {});
  assert.deepEqual(res, { from: "sp", to: "cash" });
});
