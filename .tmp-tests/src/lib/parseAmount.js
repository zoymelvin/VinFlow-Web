"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRupiahAmount = parseRupiahAmount;
// src/lib/parseAmount.ts
function parseRupiahAmount(value) {
    if (typeof value === "number") {
        return Number.isInteger(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string")
        return null;
    const cleaned = value
        .replace(/Rp\s*/gi, "")
        .replace(/\./g, "")
        .trim();
    if (!/^\d+$/.test(cleaned))
        return null;
    const num = parseInt(cleaned, 10);
    return num > 0 ? num : null;
}
