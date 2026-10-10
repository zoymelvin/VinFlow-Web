"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const settings_1 = require("../src/lib/settings");
let seq = 0;
function txn(partial = {}) {
    seq += 1;
    return {
        id: `s${seq}`,
        name: "Lunch",
        category: "Food",
        amount: 50000,
        isExpense: true,
        pocketId: "p1",
        time: "12:00",
        date: "2026-10-07",
        ...partial,
    };
}
const POCKETS = [
    { id: "p1", name: "BCA", category: "Bank", balance: 1000000, iconName: "Building" },
    { id: "p2", name: "Cash", category: "Cash", balance: 250000, iconName: "Coins" },
];
/* ── Identity ── */
(0, node_test_1.default)("initials handles multi/single/empty names", () => {
    strict_1.default.equal((0, settings_1.initials)("Joy Melvin"), "JM");
    strict_1.default.equal((0, settings_1.initials)("  joy   melvin  "), "JM");
    strict_1.default.equal((0, settings_1.initials)("Madonna"), "MA");
    strict_1.default.equal((0, settings_1.initials)("   "), "?");
});
(0, node_test_1.default)("name validation enforces limits", () => {
    strict_1.default.equal((0, settings_1.validateName)("  "), "Name cannot be empty.");
    strict_1.default.equal((0, settings_1.validateName)("x".repeat(31)), "Name must be 30 characters or fewer.");
    strict_1.default.equal((0, settings_1.validateName)(" Joy "), null);
});
/* ── Money ── */
(0, node_test_1.default)("formatIDR matches id-ID currency, no decimals", () => {
    strict_1.default.equal((0, settings_1.formatIDR)(1250000).replace(/\s/g, " "), "Rp 1.250.000");
    strict_1.default.ok((0, settings_1.formatIDR)(0).includes("Rp"));
    strict_1.default.ok(!(0, settings_1.formatIDR)(999.5).includes(","));
});
(0, node_test_1.default)("hide-balance mask never leaks digits", () => {
    const masked = (0, settings_1.formatMoneyDisplay)(1250000, { hide: true, revealed: false });
    strict_1.default.ok(!masked.includes("1"), `leak: ${masked}`);
    strict_1.default.ok(masked.includes("Rp"));
    strict_1.default.equal((0, settings_1.formatMoneyDisplay)(1250000, { hide: true, revealed: true }), (0, settings_1.formatIDR)(1250000));
    strict_1.default.equal((0, settings_1.formatMoneyDisplay)(1250000, { hide: false, revealed: false }), (0, settings_1.formatIDR)(1250000));
});
/* ── Greeting ── */
(0, node_test_1.default)("greeting buckets by hour", () => {
    strict_1.default.equal((0, settings_1.getGreeting)(6), "Good Morning");
    strict_1.default.equal((0, settings_1.getGreeting)(12), "Good Afternoon");
    strict_1.default.equal((0, settings_1.getGreeting)(16), "Good Evening");
    strict_1.default.equal((0, settings_1.getGreeting)(3), "Good Evening");
});
/* ── Migration ── */
(0, node_test_1.default)("migrateSettings maps legacy shape and drops removed keys", () => {
    const legacy = {
        profile: { name: "Joy", tagline: "hi", avatarEmoji: "x", avatarColor: "#007AFF" },
        general: { showGreeting: true, dateStyle: "long", weekStartsMonday: true, time24h: true },
        appearance: { accent: "blue", theme: "dark", reduceMotion: true, hideBalance: true, compactNumbers: true },
    };
    const out = (0, settings_1.migrateSettings)(legacy);
    strict_1.default.equal(out.profile.name, "Joy");
    strict_1.default.equal(out.profile.photo, "");
    strict_1.default.equal(out.hideBalance, true);
    strict_1.default.ok(!("tagline" in out.profile));
    strict_1.default.ok(!JSON.stringify(out).match(/reduceMotion|compactNumbers|tagline|dateStyle/));
});
(0, node_test_1.default)("migrateSettings passes new shape through, garbage falls back to defaults", () => {
    const cur = { profile: { name: "Zed", photo: "data:image/jpeg;base64,AAA" }, hideBalance: false };
    strict_1.default.deepEqual((0, settings_1.migrateSettings)(cur), cur);
    strict_1.default.deepEqual((0, settings_1.migrateSettings)(undefined), settings_1.DEFAULT_SETTINGS);
    strict_1.default.deepEqual((0, settings_1.migrateSettings)("garbage"), settings_1.DEFAULT_SETTINGS);
    strict_1.default.deepEqual((0, settings_1.migrateSettings)({ profile: { name: "x".repeat(40) } }).profile.name.length, 30);
    strict_1.default.equal((0, settings_1.migrateSettings)({ profile: { photo: "http://evil" } }).profile.photo, "");
});
(0, node_test_1.default)("migrateSettings prefers top-level hideBalance over legacy appearance", () => {
    const out = (0, settings_1.migrateSettings)({ hideBalance: false, appearance: { hideBalance: true } });
    strict_1.default.equal(out.hideBalance, false);
});
/* ── Backup ── */
(0, node_test_1.default)("backup round-trips pockets, transactions and settings", () => {
    const settings = { profile: { name: "Joy", photo: "" }, hideBalance: true };
    const json = (0, settings_1.buildBackup)(POCKETS, [txn()], settings);
    const res = (0, settings_1.importBackupPayload)(json);
    strict_1.default.equal(res.ok, true);
    if (res.ok) {
        strict_1.default.equal(res.pockets.length, 2);
        strict_1.default.equal(res.transactions.length, 1);
        strict_1.default.deepEqual((0, settings_1.migrateSettings)(res.settings), settings);
    }
});
(0, node_test_1.default)("import rejects garbage, foreign files and empty payloads", () => {
    strict_1.default.equal((0, settings_1.importBackupPayload)("not json").ok, false);
    strict_1.default.equal((0, settings_1.importBackupPayload)('{"app":"other","version":1}').ok, false);
    strict_1.default.equal((0, settings_1.importBackupPayload)(JSON.stringify({ app: "vinflow", version: 1, finance: { pockets: [], transactions: [] } })).ok, false);
});
(0, node_test_1.default)("import drops malformed rows but keeps good ones", () => {
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
    const res = (0, settings_1.importBackupPayload)(json);
    strict_1.default.equal(res.ok, true);
    if (res.ok) {
        strict_1.default.equal(res.pockets.length, 1);
        strict_1.default.equal(res.transactions.length, 1);
    }
});
(0, node_test_1.default)("import errors are human-readable", () => {
    const bad = (0, settings_1.importBackupPayload)("not json");
    strict_1.default.equal(bad.ok, false);
    if (!bad.ok)
        strict_1.default.ok(bad.error.length > 5 && !bad.error.includes("undefined"));
});
