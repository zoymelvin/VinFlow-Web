"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = void 0;
exports.parseDateStr = parseDateStr;
exports.formatYYYYMMDD = formatYYYYMMDD;
const formatCurrency = (value) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
}).format(value);
exports.formatCurrency = formatCurrency;
const INDO_MONTHS = {
    januari: 0, jan: 0,
    februari: 1, feb: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, agu: 7, ags: 7,
    september: 8, sep: 8,
    oktober: 9, okt: 9,
    november: 10, nov: 10,
    desember: 11, des: 11,
};
function parseDateStr(dateStr) {
    if (!dateStr)
        return new Date();
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }
    const indoMatch = dateStr.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/);
    if (indoMatch) {
        const day = parseInt(indoMatch[1], 10);
        const monthKey = indoMatch[2].toLowerCase();
        const month = INDO_MONTHS[monthKey] ?? new Date().getMonth();
        const year = indoMatch[3] ? parseInt(indoMatch[3], 10) : new Date().getFullYear();
        return new Date(year, month, day);
    }
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        return new Date(parseInt(slashMatch[3], 10), parseInt(slashMatch[2], 10) - 1, parseInt(slashMatch[1], 10));
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()))
        return parsed;
    return new Date();
}
function formatYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
