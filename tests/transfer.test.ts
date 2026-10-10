import test from "node:test";
import assert from "node:assert/strict";
import { useFinanceStore } from "../src/store/useFinanceStore";

test("Transfer between wallets updates balances and records transaction without changing Total Balance", () => {
  const store = useFinanceStore.getState();
  store.resetFinance();

  const p1 = store.pockets[0]; // BCA
  const p2 = store.pockets[1]; // ShopeePay
  const initialTotal = store.pockets.reduce((sum, p) => sum + p.balance, 0);

  const transferAmount = 50_000;
  store.transfer(p1.id, p2.id, transferAmount, undefined, "Test transfer");

  const updatedP1 = useFinanceStore.getState().pockets.find((p) => p.id === p1.id)!;
  const updatedP2 = useFinanceStore.getState().pockets.find((p) => p.id === p2.id)!;
  const updatedTotal = useFinanceStore.getState().pockets.reduce((sum, p) => sum + p.balance, 0);

  assert.equal(updatedP1.balance, p1.balance - transferAmount);
  assert.equal(updatedP2.balance, p2.balance + transferAmount);
  assert.equal(updatedTotal, initialTotal);

  const txns = useFinanceStore.getState().transactions;
  const transferTxn = txns.find((t) => t.isTransfer);
  assert.ok(transferTxn);
  assert.equal(transferTxn.amount, transferAmount);
  assert.equal(transferTxn.pocketId, p1.id);
  assert.equal(transferTxn.transferToPocketId, p2.id);
});
