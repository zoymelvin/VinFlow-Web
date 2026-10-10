"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const receipt_1 = require("../src/lib/receipt");
(0, node_test_1.default)("normalizeRupiah strips Rp, dots, spaces", () => {
    strict_1.default.strictEqual((0, receipt_1.normalizeRupiah)("Rp 1.250.000"), 1250000);
    strict_1.default.strictEqual((0, receipt_1.normalizeRupiah)("1.250.000"), 1250000);
    strict_1.default.strictEqual((0, receipt_1.normalizeRupiah)("  50.000 "), 50000);
    strict_1.default.strictEqual((0, receipt_1.normalizeRupiah)("Rp0"), 0);
});
(0, node_test_1.default)("matchWallet finds exact, fuzzy, and returns null", () => {
    const pockets = ["BCA", "ShopeePay", "Uang Tunai"];
    strict_1.default.strictEqual((0, receipt_1.matchWallet)("BCA", pockets), "BCA");
    strict_1.default.strictEqual((0, receipt_1.matchWallet)("Shopee Pay", pockets), "ShopeePay");
    strict_1.default.strictEqual((0, receipt_1.matchWallet)("Unknown", pockets), null);
});
(0, node_test_1.default)("detectExpense Indonesian keywords", () => {
    strict_1.default.strictEqual((0, receipt_1.detectExpense)("Transfer keluar ke BCA"), true);
    strict_1.default.strictEqual((0, receipt_1.detectExpense)("Dana masuk dari Shopee"), false);
    strict_1.default.strictEqual((0, receipt_1.detectExpense)("Charge debit card"), true);
    strict_1.default.strictEqual((0, receipt_1.detectExpense)("Kredit masuk"), false);
});
(0, node_test_1.default)("validateAIOutput rejects invalid, accepts valid", () => {
    strict_1.default.strictEqual((0, receipt_1.validateAIOutput)(null), null);
    strict_1.default.strictEqual((0, receipt_1.validateAIOutput)({}), null);
    const valid = {
        amount: 150000,
        isExpense: true,
        date: "2024-01-15",
        merchant: "ShopeePay",
        walletName: "ShopeePay",
        note: "Top up",
        confidence: { amount: 0.9, merchant: 0.8 },
    };
    const out = (0, receipt_1.validateAIOutput)({
        amount: 150000,
        isExpense: true,
        date: "2024-01-15",
        merchant: "ShopeePay",
        walletName: "ShopeePay",
        note: "Top up",
        confidence: { amount: 0.9, merchant: 0.8 },
    });
    strict_1.default.ok(out);
    strict_1.default.strictEqual(out?.amount, 150000);
    strict_1.default.strictEqual(out?.merchant, "ShopeePay");
});
(0, node_test_1.default)("findDuplicate within 5% amount + same date/pocket/type", () => {
    const txns = [
        { amount: 100000, date: "2024-01-15", isExpense: true, pocketId: "p1" },
        { amount: 50000, date: "2024-01-14", isExpense: false, pocketId: "p2" },
    ];
    const dup = { amount: 102000, date: "2024-01-15", isExpense: true, pocketId: "p1" };
    const notDup = { amount: 90000, date: "2024-01-15", isExpense: true, pocketId: "p1" };
    strict_1.default.strictEqual((0, receipt_1.findDuplicate)(txns, dup), true);
    strict_1.default.strictEqual((0, receipt_1.findDuplicate)(txns, notDup), false);
});
