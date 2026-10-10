"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRupiah = normalizeRupiah;
exports.matchWallet = matchWallet;
exports.detectExpense = detectExpense;
exports.validateAIOutput = validateAIOutput;
exports.findDuplicate = findDuplicate;
function normalizeRupiah(s) {
    const clean = s.replace(/[^\d]/g, "");
    return parseInt(clean, 10) || 0;
}
function matchWallet(merchant, pocketNames) {
    const m = merchant.toLowerCase();
    for (const name of pocketNames) {
        const n = name.toLowerCase();
        if (n.includes(m) || m.includes(n))
            return name;
        if (levenshtein(m, n) < 3)
            return name;
    }
    return null;
}
function levenshtein(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++)
        matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++)
        matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return matrix[b.length][a.length];
}
function detectExpense(text) {
    const lower = text.toLowerCase();
    const expense = ["transfer", "bayar", "charge", "debit", "keluar"];
    const income = ["terima", "masuk", "kredit", "income"];
    const expenseMatch = expense.some((w) => lower.includes(w));
    const incomeMatch = income.some((w) => lower.includes(w));
    return expenseMatch && !incomeMatch;
}
function validateAIOutput(data) {
    if (!data || typeof data !== "object")
        return null;
    const d = data;
    const amount = typeof d.amount === "number" && d.amount > 0 ? d.amount : null;
    const date = typeof d.date === "string" && d.date.match(/^\d{4}-\d{2}-\d{2}$/) ? d.date : null;
    const merchant = typeof d.merchant === "string" && d.merchant.trim() ? d.merchant.trim() : null;
    const walletName = typeof d.walletName === "string" && d.walletName.trim() ? d.walletName.trim() : null;
    if (!amount || !date || !merchant || !walletName)
        return null;
    return {
        amount,
        isExpense: typeof d.isExpense === "boolean" ? d.isExpense : detectExpense(merchant),
        date,
        merchant,
        walletName,
        note: typeof d.note === "string" ? d.note : "",
        confidence: typeof d.confidence === "object" && d.confidence ? d.confidence : {},
    };
}
function findDuplicate(txns, candidate) {
    const threshold = Math.max(1, candidate.amount * 0.05);
    return txns.some((t) => Math.abs(t.amount - candidate.amount) <= threshold &&
        t.date === candidate.date &&
        t.isExpense === candidate.isExpense &&
        t.pocketId === candidate.pocketId);
}
