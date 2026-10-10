"use strict";
/** Pure settings helpers — no browser APIs at load, fully testable. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACKUP_VERSION = exports.DEFAULT_SETTINGS = void 0;
exports.initials = initials;
exports.validateName = validateName;
exports.formatIDR = formatIDR;
exports.formatMoneyDisplay = formatMoneyDisplay;
exports.getGreeting = getGreeting;
exports.buildBackup = buildBackup;
exports.importBackupPayload = importBackupPayload;
exports.migrateSettings = migrateSettings;
exports.DEFAULT_SETTINGS = {
    profile: { name: "Joy Melvin", photo: "" },
    hideBalance: false,
};
/** "Joy Melvin" → "JM". Empty → "?". */
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return "?";
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
/** Enforce 1..30 chars after trim. */
function validateName(name) {
    const t = name.trim();
    if (!t)
        return "Name cannot be empty.";
    if (t.length > 30)
        return "Name must be 30 characters or fewer.";
    return null;
}
/** IDR, no decimals. */
function formatIDR(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
/** Money display honoring Hide Balance. Masked value never leaks digits. */
function formatMoneyDisplay(value, opts) {
    if (opts?.hide && !opts?.revealed)
        return "Rp ••••••";
    return formatIDR(value);
}
function getGreeting(hour) {
    if (hour >= 5 && hour < 12)
        return "Good Morning";
    if (hour >= 12 && hour < 15)
        return "Good Afternoon";
    if (hour >= 15 && hour < 18)
        return "Good Evening";
    return "Good Evening";
}
/* ── Backup export / import (pure shape handling) ── */
exports.BACKUP_VERSION = 1;
function buildBackup(pockets, transactions, settings, budgets = [], goals = [], goalSavings = [], now = new Date()) {
    const payload = {
        app: "vinflow",
        version: exports.BACKUP_VERSION,
        exportedAt: now.toISOString(),
        finance: { pockets, transactions, budgets, goals, goalSavings },
        settings,
    };
    return JSON.stringify(payload);
}
function isPocket(v) {
    if (!v || typeof v !== "object")
        return false;
    const p = v;
    return (typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.category === "string" &&
        typeof p.balance === "number" &&
        typeof p.iconName === "string");
}
function isTransaction(v) {
    if (!v || typeof v !== "object")
        return false;
    const t = v;
    return (typeof t.id === "string" &&
        typeof t.name === "string" &&
        typeof t.category === "string" &&
        typeof t.amount === "number" &&
        typeof t.isExpense === "boolean" &&
        typeof t.pocketId === "string" &&
        typeof t.time === "string" &&
        typeof t.date === "string");
}
function isBudget(v) {
    if (!v || typeof v !== "object")
        return false;
    const b = v;
    return (typeof b.id === "string" &&
        typeof b.category === "string" &&
        typeof b.amount === "number" &&
        typeof b.period === "string");
}
function isGoal(v) {
    if (!v || typeof v !== "object")
        return false;
    const g = v;
    return typeof g.id === "string" && typeof g.name === "string" && typeof g.target === "number" && typeof g.status === "string" && typeof g.createdAt === "string";
}
function isGoalSaving(v) {
    if (!v || typeof v !== "object")
        return false;
    const s = v;
    return typeof s.id === "string" && typeof s.goalId === "string" && typeof s.amount === "number" && typeof s.pocketId === "string" && typeof s.date === "string";
}
/** Strict top level, lenient rows: drops malformed entries, rejects empty files. */
function importBackupPayload(json) {
    let data;
    try {
        data = JSON.parse(json);
    }
    catch {
        return { ok: false, error: "Backup file could not be read." };
    }
    if (!data || typeof data !== "object")
        return { ok: false, error: "Backup file is not valid." };
    const root = data;
    if (root.app !== "vinflow" || typeof root.version !== "number") {
        return { ok: false, error: "This file is not a VinFlow backup." };
    }
    const finance = root.finance;
    if (!finance || !Array.isArray(finance.pockets) || !Array.isArray(finance.transactions)) {
        return { ok: false, error: "Backup has no wallet or transaction data." };
    }
    const pockets = finance.pockets.filter(isPocket);
    const transactions = finance.transactions.filter(isTransaction);
    const budgets = Array.isArray(finance.budgets) ? finance.budgets.filter(isBudget) : [];
    const goals = Array.isArray(finance.goals) ? finance.goals.filter(isGoal) : [];
    const goalSavings = Array.isArray(finance.goalSavings)
        ? finance.goalSavings.filter(isGoalSaving).filter((s) => goals.some((g) => g.id === s.goalId))
        : [];
    if (pockets.length === 0 && transactions.length === 0) {
        return { ok: false, error: "Backup contains no usable data." };
    }
    return { ok: true, pockets, transactions, budgets, goals, goalSavings, settings: root.settings ?? {} };
}
function isRecord(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
}
/**
 * Migrate any persisted settings shape (legacy v0 with profile.tagline/
 * general/appearance, or anything garbage) to the current shape. Always
 * returns a safe, complete object.
 */
function migrateSettings(persisted) {
    if (!isRecord(persisted))
        return { ...exports.DEFAULT_SETTINGS };
    const profileRaw = isRecord(persisted.profile) ? persisted.profile : {};
    const appearanceRaw = isRecord(persisted.appearance) ? persisted.appearance : {};
    const name = typeof profileRaw.name === "string" && profileRaw.name.trim()
        ? profileRaw.name.trim().slice(0, 30)
        : exports.DEFAULT_SETTINGS.profile.name;
    const photo = typeof profileRaw.photo === "string" && profileRaw.photo.startsWith("data:image/")
        ? profileRaw.photo
        : "";
    // New key wins; fall back to legacy appearance.hideBalance.
    const hideBalance = typeof persisted.hideBalance === "boolean"
        ? persisted.hideBalance
        : typeof appearanceRaw.hideBalance === "boolean"
            ? appearanceRaw.hideBalance
            : false;
    return { profile: { name, photo }, hideBalance };
}
