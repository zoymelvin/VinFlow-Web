import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  buildBackup,
  formatIDR,
  formatMoneyDisplay,
  getGreeting,
  importBackupPayload,
  initials,
  migrateSettings,
  validateName,
} from "../src/lib/settings";
import type { Pocket, Transaction } from "../src/store/useFinanceStore";

let seq = 0;
function txn(partial: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `s${seq}`,
    name: "Lunch",
    category: "Food",
    amount: 50_000,
    isExpense: true,
    pocketId: "p1",
    time: "12:00",
    date: "2026-10-07",
    ...partial,
  };
}

const POCKETS: Pocket[] = [
  { id: "p1", name: "BCA", category: "Bank", balance: 1_000_000, iconName: "Building" },
  { id: "p2", name: "Cash", category: "Cash", balance: 250_000, iconName: "Coins" },
];

/* ── Identity ── */
test("initials handles multi/single/empty names", () => {
  assert.equal(initials("Joy Melvin"), "JM");
  assert.equal(initials("  joy   melvin  "), "JM");
  assert.equal(initials("Madonna"), "MA");
  assert.equal(initials("   "), "?");
});

test("name validation enforces limits", () => {
  assert.equal(validateName("  "), "Name cannot be empty.");
  assert.equal(validateName("x".repeat(31)), "Name must be 30 characters or fewer.");
  assert.equal(validateName(" Joy "), null);
});

/* ── Money ── */
test("formatIDR matches id-ID currency, no decimals", () => {
  assert.equal(formatIDR(1_250_000).replace(/\s/g, " "), "Rp 1.250.000");
  assert.ok(formatIDR(0).includes("Rp"));
  assert.ok(!formatIDR(999.5).includes(","));
});

test("hide-balance mask never leaks digits", () => {
  const masked = formatMoneyDisplay(1_250_000, { hide: true, revealed: false });
  assert.ok(!masked.includes("1"), `leak: ${masked}`);
  assert.ok(masked.includes("Rp"));
  assert.equal(formatMoneyDisplay(1_250_000, { hide: true, revealed: true }), formatIDR(1_250_000));
  assert.equal(formatMoneyDisplay(1_250_000, { hide: false, revealed: false }), formatIDR(1_250_000));
});

/* ── Greeting ── */
test("greeting buckets by hour", () => {
  assert.equal(getGreeting(6), "Good Morning");
  assert.equal(getGreeting(12), "Good Afternoon");
  assert.equal(getGreeting(16), "Good Afternoon");
  assert.equal(getGreeting(3), "Good Evening");
});

/* ── Migration ── */
test("migrateSettings maps legacy shape and drops removed keys", () => {
  const legacy = {
    profile: { name: "Joy", tagline: "hi", avatarEmoji: "x", avatarColor: "#007AFF" },
    general: { showGreeting: true, dateStyle: "long", weekStartsMonday: true, time24h: true },
    appearance: { accent: "blue", theme: "dark", reduceMotion: true, hideBalance: true, compactNumbers: true },
  };
  const out = migrateSettings(legacy);
  assert.equal(out.profile.name, "Joy");
  assert.equal(out.profile.photo, "");
  assert.equal(out.hideBalance, true);
  assert.ok(!("tagline" in out.profile));
  assert.ok(!JSON.stringify(out).match(/reduceMotion|compactNumbers|tagline|dateStyle/));
});

test("migrateSettings passes new shape through, garbage falls back to defaults", () => {
  const cur = { profile: { name: "Zed", photo: "data:image/jpeg;base64,AAA" }, hideBalance: false };
  assert.deepEqual(migrateSettings(cur), cur);
  assert.deepEqual(migrateSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(migrateSettings("garbage"), DEFAULT_SETTINGS);
  assert.deepEqual(migrateSettings({ profile: { name: "x".repeat(40) } }).profile.name.length, 30);
  assert.equal(migrateSettings({ profile: { photo: "http://evil" } }).profile.photo, "");
});

test("migrateSettings prefers top-level hideBalance over legacy appearance", () => {
  const out = migrateSettings({ hideBalance: false, appearance: { hideBalance: true } });
  assert.equal(out.hideBalance, false);
});

/* ── Backup ── */
test("backup round-trips pockets, transactions and settings", () => {
  const settings = { profile: { name: "Joy", photo: "" }, hideBalance: true };
  const json = buildBackup(POCKETS, [txn()], settings);
  const res = importBackupPayload(json);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.pockets.length, 2);
    assert.equal(res.transactions.length, 1);
    assert.deepEqual(migrateSettings(res.settings), settings);
  }
});

test("import rejects garbage, foreign files and empty payloads", () => {
  assert.equal(importBackupPayload("not json").ok, false);
  assert.equal(importBackupPayload('{"app":"other","version":1}').ok, false);
  assert.equal(
    importBackupPayload(JSON.stringify({ app: "vinflow", version: 1, finance: { pockets: [], transactions: [] } })).ok,
    false
  );
});

test("import drops malformed rows but keeps good ones", () => {
  const json = JSON.stringify({
    app: "vinflow",
    version: 1,
    exportedAt: new Date().toISOString(),
    finance: {
      pockets: [{ id: "p1", name: "BCA", category: "Bank", balance: 1, iconName: "Building" }, { broken: true }],
      transactions: [txn(), { broken: true }],
    },
    settings: {},
  });
  const res = importBackupPayload(json);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.pockets.length, 1);
    assert.equal(res.transactions.length, 1);
  }
});

test("import errors are human-readable", () => {
  const bad = importBackupPayload("not json");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.error.length > 5 && !bad.error.includes("undefined"));
});