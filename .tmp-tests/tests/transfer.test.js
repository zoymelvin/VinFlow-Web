"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const useFinanceStore_1 = require("../src/store/useFinanceStore");
(0, node_test_1.default)("Transfer between wallets updates balances and records transaction without changing Total Balance", () => {
    const store = useFinanceStore_1.useFinanceStore.getState();
    store.resetFinance();
    const p1 = store.pockets[0]; // BCA
    const p2 = store.pockets[1]; // ShopeePay
    const initialTotal = store.pockets.reduce((sum, p) => sum + p.balance, 0);
    const transferAmount = 50000;
    store.transfer(p1.id, p2.id, transferAmount, undefined, "Test transfer");
    const updatedP1 = useFinanceStore_1.useFinanceStore.getState().pockets.find((p) => p.id === p1.id);
    const updatedP2 = useFinanceStore_1.useFinanceStore.getState().pockets.find((p) => p.id === p2.id);
    const updatedTotal = useFinanceStore_1.useFinanceStore.getState().pockets.reduce((sum, p) => sum + p.balance, 0);
    strict_1.default.equal(updatedP1.balance, p1.balance - transferAmount);
    strict_1.default.equal(updatedP2.balance, p2.balance + transferAmount);
    strict_1.default.equal(updatedTotal, initialTotal);
    const txns = useFinanceStore_1.useFinanceStore.getState().transactions;
    const transferTxn = txns.find((t) => t.isTransfer);
    strict_1.default.ok(transferTxn);
    strict_1.default.equal(transferTxn.amount, transferAmount);
    strict_1.default.equal(transferTxn.pocketId, p1.id);
    strict_1.default.equal(transferTxn.transferToPocketId, p2.id);
});
