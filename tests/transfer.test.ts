import test from "node:test";
import assert from "node:assert/strict";
import "./window-shim";
import { useFinanceStore } from "../src/store/useFinanceStore";
import { storageEntries } from "./window-shim";
import { goalSavingsTotal, goalSavingsForGoal } from "../src/lib/goal";
import { calculateBudget } from "../src/lib/budget";

function reset(pockets: { id: string; name: string; balance: number }[] = [
  { id: "sp", name: "ShopeePay", balance: 3_000_000 },
  { id: "sb", name: "SeaBank", balance: 121_940 },
]) {
  useFinanceStore.getState().resetFinance();
  useFinanceStore.getState().setPockets(
    pockets.map((p) => ({ category: "E-Wallet", iconName: "Smartphone", ...p }))
  );
  return useFinanceStore.getState().pockets;
}

function snapshot() {
  const s = useFinanceStore.getState();
  return {
    pockets: s.pockets,
    transactions: s.transactions,
    budgets: s.budgets,
    goals: s.goals,
    goalSavings: s.goalSavings,
  };
}

/* ── Success: balances, total unchanged (the spec's worked example) ── */
test("transfer moves both balances and leaves total unchanged", () => {
  reset();
  const totalBefore = useFinanceStore.getState().pockets.reduce((s, p) => s + p.balance, 0);

  const res = useFinanceStore.getState().addTransfer({
    fromPocketId: "sp", toPocketId: "sb", amount: 50_000, key: "k1",
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.duplicate, false);

  const pockets = useFinanceStore.getState().pockets;
  assert.equal(pockets.find((p) => p.id === "sp")!.balance, 2_950_000);
  assert.equal(pockets.find((p) => p.id === "sb")!.balance, 171_940);
  assert.equal(
    pockets.reduce((s, p) => s + p.balance, 0),
    totalBefore
  );
  assert.equal(totalBefore, 3_121_940);

  const txn = useFinanceStore.getState().transactions.find((t) => t.id === res.txnId)!;
  assert.equal(txn.isTransfer, true);
  assert.equal(txn.isExpense, false);
  assert.equal(txn.amount, 50_000);
  assert.equal(txn.pocketId, "sp");
  assert.equal(txn.transferToPocketId, "sb");
  assert.equal(txn.category, "Transfer");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(txn.date), "date must be YYYY-MM-DD");
  assert.ok(/^\d{2}:\d{2}$/.test(txn.time), "local HH:MM time");
});

/* ── Admin fee ── */
test("admin fee creates a separate Other expense; total drops exactly by the fee", () => {
  reset([
    { id: "a", name: "A", balance: 100_000 },
    { id: "b", name: "B", balance: 0 },
  ]);
  const before = useFinanceStore.getState().pockets.reduce((s, p) => s + p.balance, 0);

  const res = useFinanceStore.getState().addTransfer({
    fromPocketId: "a", toPocketId: "b", amount: 50_000, adminFee: 1_000, key: "k2",
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.ok(res.feeTxnId);

  const s = useFinanceStore.getState();
  assert.equal(s.pockets.find((p) => p.id === "a")!.balance, 49_000);
  assert.equal(s.pockets.find((p) => p.id === "b")!.balance, 50_000);
  assert.equal(s.pockets.reduce((sum, p) => sum + p.balance, 0), before - 1_000);

  const fee = s.transactions.find((t) => t.id === res.feeTxnId!)!;
  assert.equal(fee.name, "Admin fee");
  assert.equal(fee.category, "Other");
  assert.equal(fee.isExpense, true);
  assert.equal(fee.amount, 1_000);
  assert.equal(fee.pocketId, "a");
  assert.equal(fee.transferFeeOf, res.txnId);
  const txn = s.transactions.find((t) => t.id === res.txnId)!;
  assert.equal(txn.adminFeeTransactionId, fee.id);

  // Fee counts as a normal Other expense in budgets
  const b = { id: "b-other", categoryId: "Other", baseAmount: 1_000_000, period: "2026-10", topUps: [] };
  assert.equal(calculateBudget(b, s.transactions, "2026-10").spent, 1_000);
});

/* ── Rejections leave state untouched ── */
const REJECT_CASES: { label: string; input: Parameters<ReturnType<typeof useFinanceStore.getState>["addTransfer"]>[0]; errorMatch?: string }[] = [
  { label: "zero amount", input: { fromPocketId: "sp", toPocketId: "sb", amount: 0, key: "k" } },
  { label: "negative amount", input: { fromPocketId: "sp", toPocketId: "sb", amount: -100, key: "k" } },
  { label: "decimal amount", input: { fromPocketId: "sp", toPocketId: "sb", amount: 50_000.5, key: "k" } },
  { label: "NaN amount", input: { fromPocketId: "sp", toPocketId: "sb", amount: NaN, key: "k" } },
  { label: "amount over cap", input: { fromPocketId: "sp", toPocketId: "sb", amount: 1_000_000_000_000, key: "k" } },
  { label: "same wallet", input: { fromPocketId: "sp", toPocketId: "sp", amount: 1_000, key: "k" } },
  { label: "source wallet missing", input: { fromPocketId: "nope", toPocketId: "sb", amount: 1_000, key: "k" } },
  { label: "destination wallet missing", input: { fromPocketId: "sp", toPocketId: "nope", amount: 1_000, key: "k" } },
  { label: "amount exceeds balance", input: { fromPocketId: "sp", toPocketId: "sb", amount: 3_000_001, key: "k" } },
  { label: "amount + fee exceeds balance", input: { fromPocketId: "sp", toPocketId: "sb", amount: 3_000_000, adminFee: 1, key: "k" } },
  { label: "negative fee", input: { fromPocketId: "sp", toPocketId: "sb", amount: 1_000, adminFee: -1, key: "k" } },
  { label: "decimal fee", input: { fromPocketId: "sp", toPocketId: "sb", amount: 1_000, adminFee: 0.5, key: "k" } },
  { label: "empty idempotency key", input: { fromPocketId: "sp", toPocketId: "sb", amount: 1_000, key: "  " } },
  { label: "bad date format", input: { fromPocketId: "sp", toPocketId: "sb", amount: 1_000, key: "k", date: "28/10/2026" } },
];
for (const c of REJECT_CASES) {
  test(`rejects: ${c.label} — no state change`, () => {
    reset();
    const before = snapshot();
    const res = useFinanceStore.getState().addTransfer(c.input);
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.ok(res.error.length > 5);
    assert.ok(!res.error.includes("undefined"));
    assert.deepEqual(snapshot(), before);
  });
}

/* ── Idempotency ── */
test("same idempotency key returns the first result and never duplicates", () => {
  reset();
  const input = { fromPocketId: "sp", toPocketId: "sb", amount: 50_000, key: "same-key" };

  const first = useFinanceStore.getState().addTransfer(input);
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = useFinanceStore.getState().addTransfer(input);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.duplicate, true);
  assert.equal(second.txnId, first.txnId);

  const s = useFinanceStore.getState();
  assert.equal(s.transactions.filter((t) => t.transferKey === "same-key").length, 1);
  assert.equal(s.pockets.find((p) => p.id === "sp")!.balance, 2_950_000);
  assert.equal(s.pockets.find((p) => p.id === "sb")!.balance, 171_940);
});

/* ── Deletion restores everything ── */
test("deleteTransfer restores both balances and removes the record", () => {
  reset();
  const res = useFinanceStore.getState().addTransfer({ fromPocketId: "sp", toPocketId: "sb", amount: 50_000, key: "del1" });
  assert.equal(res.ok, true);
  if (!res.ok) return;

  useFinanceStore.getState().deleteTransfer(res.txnId);
  const s = useFinanceStore.getState();
  assert.equal(s.pockets.find((p) => p.id === "sp")!.balance, 3_000_000);
  assert.equal(s.pockets.find((p) => p.id === "sb")!.balance, 121_940);
  assert.equal(s.transactions.length, 0);
});

test("deleteTransfer removes the admin fee expense and restores source by amount + fee", () => {
  reset([
    { id: "a", name: "A", balance: 100_000 },
    { id: "b", name: "B", balance: 0 },
  ]);
  const res = useFinanceStore.getState().addTransfer({ fromPocketId: "a", toPocketId: "b", amount: 50_000, adminFee: 1_000, key: "del2" });
  assert.equal(res.ok, true);
  if (!res.ok) return;

  useFinanceStore.getState().deleteTransfer(res.txnId);
  const s = useFinanceStore.getState();
  assert.equal(s.pockets.find((p) => p.id === "a")!.balance, 100_000);
  assert.equal(s.pockets.find((p) => p.id === "b")!.balance, 0);
  assert.equal(s.transactions.length, 0);
});

test("deleteTransfer of unknown or non-transfer id is a no-op", () => {
  reset();
  const before = snapshot();
  useFinanceStore.getState().deleteTransfer("does-not-exist");
  useFinanceStore.getState().deleteTransfer(useFinanceStore.getState().transactions[0]?.id ?? "x");
  assert.deepEqual(snapshot(), before);
});

/* ── Persistence: reload state from storage yields the same numbers ── */
test("persisted state rehydrates with identical transfer numbers", async () => {
  const mem = storageEntries();
  reset([
    { id: "p1", name: "ShopeePay", balance: 3_000_000 },
    { id: "p2", name: "SeaBank", balance: 121_940 },
  ]);
  const res = useFinanceStore.getState().addTransfer({ fromPocketId: "p1", toPocketId: "p2", amount: 50_000, key: "persist-key" });
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const saved = mem.get("vinflow-storage");
  assert.ok(saved, "store must have written to storage");

  // Simulate app restart: in-memory state back to seed, user's file still on disk.
  useFinanceStore.getState().resetFinance();
  mem.set("vinflow-storage", saved);
  await useFinanceStore.persist.rehydrate();

  const s = useFinanceStore.getState();
  assert.equal(s.pockets.find((p) => p.id === "p1")!.balance, 2_950_000);
  assert.equal(s.pockets.find((p) => p.id === "p2")!.balance, 171_940);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].isTransfer, true);
  assert.equal(s.transactions[0].transferKey, "persist-key");
});

/* ── Goals integration: Add Savings moved onto addTransfer ── */
test("goals Add Savings via addTransfer keeps progress, balances, and delete unlinks the saving", () => {
  reset([
    { id: "src", name: "BCA", balance: 3_000_000 },
    { id: "goalw", name: "SeaBank", balance: 121_940 },
  ]);
  const st = useFinanceStore.getState();
  st.addGoal({
    id: "g1", name: "New Laptop", target: 1_000_000, iconName: "Trophy",
    pocketId: "goalw", status: "active", createdAt: new Date().toISOString(),
  });

  const res = st.addTransfer({
    fromPocketId: "src", toPocketId: "goalw", amount: 500_000,
    goalId: "g1", note: "Saved to New Laptop", key: "goal-save-1",
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  st.addGoalSaving({
    id: "gs-1", goalId: "g1", amount: 500_000, pocketId: "src",
    date: new Date().toISOString().slice(0, 10),
    note: "Saved to New Laptop", transferTransactionId: res.txnId,
  });

  let s = useFinanceStore.getState();
  assert.equal(goalSavingsTotal(goalSavingsForGoal(s.goalSavings, "g1")), 500_000);
  assert.equal(s.pockets.find((p) => p.id === "src")!.balance, 2_500_000);
  assert.equal(s.pockets.find((p) => p.id === "goalw")!.balance, 621_940);
  const txn = s.transactions.find((t) => t.id === res.txnId)!;
  assert.deepEqual(txn.goalAllocation, [{ goalId: "g1", amount: 500_000 }]);

  // Deleting the transfer rolls back wallets AND removes the linked saving row.
  s.deleteTransfer(res.txnId);
  s = useFinanceStore.getState();
  assert.equal(goalSavingsTotal(goalSavingsForGoal(s.goalSavings, "g1")), 0);
  assert.equal(s.pockets.find((p) => p.id === "src")!.balance, 3_000_000);
  assert.equal(s.pockets.find((p) => p.id === "goalw")!.balance, 121_940);
});
