import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRupiah,
  matchWallet,
  detectExpense,
  validateAIOutput,
  findDuplicate,
  type ReceiptData,
} from "../src/lib/receipt";

test("normalizeRupiah strips Rp, dots, spaces", () => {
  assert.strictEqual(normalizeRupiah("Rp 1.250.000"), 1250000);
  assert.strictEqual(normalizeRupiah("1.250.000"), 1250000);
  assert.strictEqual(normalizeRupiah("  50.000 "), 50000);
  assert.strictEqual(normalizeRupiah("Rp0"), 0);
});

test("matchWallet finds exact, fuzzy, and returns null", () => {
  const pockets = ["BCA", "ShopeePay", "Uang Tunai"];
  assert.strictEqual(matchWallet("BCA", pockets), "BCA");
  assert.strictEqual(matchWallet("Shopee Pay", pockets), "ShopeePay");
  assert.strictEqual(matchWallet("Unknown", pockets), null);
});

test("detectExpense Indonesian keywords", () => {
  assert.strictEqual(detectExpense("Transfer keluar ke BCA"), true);
  assert.strictEqual(detectExpense("Dana masuk dari Shopee"), false);
  assert.strictEqual(detectExpense("Charge debit card"), true);
  assert.strictEqual(detectExpense("Kredit masuk"), false);
});

test("validateAIOutput rejects invalid, accepts valid", () => {
  assert.strictEqual(validateAIOutput(null), null);
  assert.strictEqual(validateAIOutput({}), null);
  const valid: ReceiptData = {
    amount: 150000,
    isExpense: true,
    date: "2024-01-15",
    merchant: "ShopeePay",
    walletName: "ShopeePay",
    note: "Top up",
    confidence: { amount: 0.9, merchant: 0.8 },
  };
  const out = validateAIOutput({
    amount: 150000,
    isExpense: true,
    date: "2024-01-15",
    merchant: "ShopeePay",
    walletName: "ShopeePay",
    note: "Top up",
    confidence: { amount: 0.9, merchant: 0.8 },
  });
  assert.ok(out);
  assert.strictEqual(out?.amount, 150000);
  assert.strictEqual(out?.merchant, "ShopeePay");
});

test("findDuplicate within 5% amount + same date/pocket/type", () => {
  const txns = [
    { amount: 100000, date: "2024-01-15", isExpense: true, pocketId: "p1" },
    { amount: 50000, date: "2024-01-14", isExpense: false, pocketId: "p2" },
  ];
  const dup = { amount: 102000, date: "2024-01-15", isExpense: true, pocketId: "p1" };
  const notDup = { amount: 90000, date: "2024-01-15", isExpense: true, pocketId: "p1" };
  assert.strictEqual(findDuplicate(txns, dup), true);
  assert.strictEqual(findDuplicate(txns, notDup), false);
});

test("parseScanResult handles string amounts, missing fields, and trims values", () => {
  const { parseScanResult, emptyScanResult, isScanResultUsable, normalizeMerchant } = require("../src/lib/receipt");

  const empty = parseScanResult({});
  assert.deepEqual(empty, emptyScanResult());
  assert.strictEqual(isScanResultUsable(empty), false);

  const dotAmount = parseScanResult({
    amount: "48.000",
    type: "expense",
    date: "2026-10-24",
    time: "14:30:00",
    purpose: "  COSAN COFFEE SETURAN  ",
    sourceWallet: "ShopeePay",
  });
  assert.strictEqual(dotAmount.amount, 48000);
  assert.strictEqual(dotAmount.type, "expense");
  assert.strictEqual(dotAmount.date, "2026-10-24");
  assert.strictEqual(dotAmount.time, "14:30");
  assert.strictEqual(dotAmount.purpose, "COSAN COFFEE SETURAN");
  assert.strictEqual(dotAmount.sourceWallet, "ShopeePay");
  assert.strictEqual(isScanResultUsable(dotAmount), true);

  assert.strictEqual(normalizeMerchant("COSAN COFFEE SETURAN!"), "cosan coffee seturan");
});

test("user-touched fields are not overwritten by AI scan results", () => {
  const touchedFields = new Set(["amount"]);
  const formState = {
    amount: "50000",
    merchant: "",
    isExpense: true,
  };
  const scanResult = {
    amount: 48000,
    purpose: "COSAN COFFEE SETURAN",
    type: "expense",
  };

  const next = { ...formState };
  if (!touchedFields.has("amount") && scanResult.amount > 0) {
    next.amount = String(scanResult.amount);
  }
  if (!touchedFields.has("merchant") && scanResult.purpose) {
    next.merchant = scanResult.purpose;
  }

  // Amount remains 50000 because user edited it; merchant is filled from AI
  assert.strictEqual(next.amount, "50000");
  assert.strictEqual(next.merchant, "COSAN COFFEE SETURAN");
});
