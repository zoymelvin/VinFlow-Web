"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_1 = require("../src/lib/insights/engine");
const utils_1 = require("../src/lib/insights/utils");
const config_1 = require("../src/lib/insights/config");
const insights_1 = require("../src/lib/insights/insights");
/* ── Fixtures ──────────────────────────────────────────── */
const POCKETS = [
    { id: "p1", name: "BCA", category: "Bank", balance: 5000000, iconName: "Building" },
    { id: "p2", name: "Tunai", category: "Cash", balance: 300000, iconName: "Coins" },
];
let seq = 0;
function txn(partial) {
    seq += 1;
    return {
        id: `t${seq}`,
        name: "Expense",
        category: "Food",
        amount: 50000,
        isExpense: true,
        pocketId: "p1",
        time: "12:00",
        date: "7 Oktober",
        ...partial,
    };
}
function rangeOf(txns) {
    const times = txns.map((t) => (0, utils_1.parseDateStr)(t.date).getTime());
    return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}
function run(txns, pockets = POCKETS) {
    const r = txns.length ? rangeOf(txns) : { start: new Date(), end: new Date() };
    const data = (0, engine_1.generateInsightData)(txns, pockets, r.start, r.end);
    const insights = (0, engine_1.evaluateInsights)(data);
    return { data, insights };
}
const MESSAGES = ["undefined", "NaN", "[object Object]", "null%", "Insight:", "TODO", "{{", "}}"];
function assertNoRawText(insights) {
    for (const i of insights) {
        strict_1.default.ok(i.title && i.title.length > 0, "title wajib terisi");
        strict_1.default.ok(i.message && i.message.length > 0, "message wajib terisi");
        for (const bad of MESSAGES) {
            strict_1.default.ok(!i.message.includes(bad) && !i.title.includes(bad), `teks mentah bocor "${bad}" di: ${i.message}`);
        }
    }
}
/* ── Kasus khusus ──────────────────────────────────────── */
(0, node_test_1.default)("tidak ada transaksi sama sekali → tidak error, insight tetap valid", () => {
    const { data, insights } = run([]);
    strict_1.default.equal(data.totalTransactions, 0);
    strict_1.default.equal(data.totalIncome, 0);
    strict_1.default.equal(data.totalExpense, 0);
    strict_1.default.ok(insights.length <= config_1.GLOBAL_CONFIG.insightDisplayLimit);
    assertNoRawText(insights);
});
(0, node_test_1.default)("pemasukan nol tapi ada pengeluaran → cash flow kritis", () => {
    const txns = Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 100000 + i * 10000 }));
    const { insights } = run(txns);
    const cash = insights.find((i) => i.type === "cash_flow_health");
    strict_1.default.ok(cash, "cash_flow_health harus muncul");
    strict_1.default.equal(cash.sentiment, "critical");
    assertNoRawText(insights);
});
(0, node_test_1.default)("hanya 1 transaksi → aman, tanpa pembagian nol", () => {
    const { data, insights } = run([txn({ amount: 25000 })]);
    strict_1.default.equal(data.periodLengthDays, 1);
    assertNoRawText(insights);
    const score = (0, engine_1.computeFinancialHealthScore)(data);
    strict_1.default.ok(score >= 0 && score <= 100);
});
(0, node_test_1.default)("hanya 2 transaksi → data_quality tampil bila di bawah threshold", () => {
    const txns = [txn({ date: "1 Oktober" }), txn({ date: "2 Oktober" })];
    const { insights } = run(txns);
    const dq = insights.find((i) => i.type === "data_quality");
    strict_1.default.ok(dq, "data_quality harus muncul untuk data sangat sedikit");
    assertNoRawText(insights);
});
(0, node_test_1.default)("transaksi tanpa kategori → jatuh ke 'Lainnya' tanpa error", () => {
    const txns = Array.from({ length: 6 }, (_, i) => txn({ date: `${i + 1} Oktober`, category: "", amount: 40000 }));
    const { data, insights } = run(txns);
    strict_1.default.equal(data.topExpenseCategory.name, "Lainnya");
    assertNoRawText(insights);
});
(0, node_test_1.default)("rentang 1 hari → periodLength minimal 1, tidak ada pembagian nol", () => {
    const txns = [txn({ date: "7 Oktober", amount: 100000 }), txn({ date: "7 Oktober", isExpense: false, amount: 200000 })];
    const { data } = run(txns);
    strict_1.default.equal(data.periodLengthDays, 1);
    strict_1.default.ok(Number.isFinite(data.avgDailyExpense));
});
(0, node_test_1.default)("rentang 1 tahun → proyeksi & habits tetap masuk akal", () => {
    const txns = Array.from({ length: 40 }, (_, i) => {
        const d = new Date(2025, 0, 1 + i * 9);
        return txn({ date: (0, utils_1.formatYYYYMMDD)(d), amount: 75000 });
    });
    const { data, insights } = run(txns);
    strict_1.default.ok(data.periodLengthDays > 300);
    assertNoRawText(insights);
    strict_1.default.ok(insights.length > 0);
});
(0, node_test_1.default)("tanpa histori sebelumnya → period_comparison tidak membandingkan angka karangan", () => {
    // Data hanya pada satu hari, tanpa data pendahulu
    const txns = Array.from({ length: 6 }, () => txn({ date: "7 Oktober", amount: 30000 }));
    const { insights } = run(txns);
    const comp = insights.find((i) => i.type === "period_comparison");
    // period_comparison hanya boleh muncul bila benar-benar ada data pembanding;
    // engine saat ini tidak punya data histori → wajib tidak menampilkan klaim persentase.
    if (comp) {
        strict_1.default.ok(!comp.message.includes("% naik"), "tidak boleh mengarang persentase");
    }
});
/* ── Konsistensi & seleksi ─────────────────────────────── */
(0, node_test_1.default)("semua 9 jenis insight punya trigger+generate yang tidak error", () => {
    const txns = Array.from({ length: 12 }, (_, i) => txn({ date: `${(i % 10) + 1} Oktober`, amount: 50000 * (i + 1), category: i % 3 === 0 ? "Food" : "Transport" }));
    const data = (0, engine_1.generateInsightData)(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
    for (const cfg of insights_1.ALL_INSIGHTS) {
        if (cfg.trigger(data)) {
            const out = cfg.generate(data);
            strict_1.default.ok(out.title.length > 0, `${cfg.id} title kosong`);
            strict_1.default.ok(out.message.length > 0, `${cfg.id} message kosong`);
            strict_1.default.ok(!out.message.includes("undefined"), `${cfg.id} menghasilkan undefined`);
        }
    }
});
(0, node_test_1.default)("variasi narasi stabil: seed sama → pesan sama", () => {
    const txns = Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 60000 }));
    const a = run(txns).insights;
    const b = run(txns).insights;
    strict_1.default.deepEqual(a.map((i) => [i.type, i.displayProps?.variantIndex]), b.map((i) => [i.type, i.displayProps?.variantIndex]));
});
(0, node_test_1.default)("batas tampilan dihormati dan tidak ada tipe ganda", () => {
    const txns = Array.from({ length: 30 }, (_, i) => txn({ date: `${(i % 20) + 1} Oktober`, amount: 20000 + i * 5000, category: i % 4 === 0 ? "Shopping" : "Food" }));
    const { insights } = run(txns);
    strict_1.default.ok(insights.length <= config_1.GLOBAL_CONFIG.insightDisplayLimit);
    const types = insights.map((i) => i.type);
    strict_1.default.equal(new Set(types).size, types.length, "satu tipe insight tidak boleh dobel");
    for (let i = 1; i < insights.length; i++) {
        strict_1.default.ok(insights[i - 1].priority >= insights[i].priority, "urutan priority menurun");
    }
    assertNoRawText(insights);
});
(0, node_test_1.default)("minimal satu insight positif bila ada kabar baik", () => {
    const txns = [
        ...Array.from({ length: 6 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 500000, category: "Salary" })),
        txn({ date: "2 Oktober", amount: 30000, category: "Food" }),
    ];
    const { insights } = run(txns);
    strict_1.default.ok(insights.some((i) => i.sentiment === "positive"), "harus ada minimal satu insight positif");
});
(0, node_test_1.default)("semua uang memakai format Rp dan tanpa desimal", () => {
    const a = (0, utils_1.formatCurrency)(1250000);
    strict_1.default.ok(a.replace(/\u00A0/g, " ").startsWith("Rp"), `harus diawali Rp, dapat: ${a}`);
    strict_1.default.ok(a.includes("1.250.000"), `harus memakai pemisah ribuan id-ID, dapat: ${a}`);
    strict_1.default.ok((0, utils_1.formatCurrency)(0).includes("0"));
    strict_1.default.ok(!(0, utils_1.formatCurrency)(999.5).includes(","));
});
(0, node_test_1.default)("parseDateStr mendukung ISO, Indonesia, dan DD/MM/YYYY", () => {
    strict_1.default.equal((0, utils_1.formatYYYYMMDD)((0, utils_1.parseDateStr)("2025-10-07")), "2025-10-07");
    const indo = (0, utils_1.parseDateStr)("7 Oktober");
    strict_1.default.equal(indo.getDate(), 7);
    strict_1.default.equal(indo.getMonth(), 9);
    strict_1.default.equal((0, utils_1.formatYYYYMMDD)((0, utils_1.parseDateStr)("07/10/2025")), "2025-10-07");
});
(0, node_test_1.default)("ganti filter dompet/rentang → data & insight ikut berubah", () => {
    const txns = [
        txn({ id: "a", date: "1 Oktober", pocketId: "p1", amount: 100000 }),
        txn({ id: "b", date: "2 Oktober", pocketId: "p2", amount: 400000 }),
    ];
    const d1 = (0, engine_1.generateInsightData)(txns.filter((t) => t.pocketId === "p1"), POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 1));
    const d2 = (0, engine_1.generateInsightData)(txns.filter((t) => t.pocketId === "p2"), POCKETS, new Date(2025, 9, 2), new Date(2025, 9, 2));
    strict_1.default.notEqual(d1.totalExpense, d2.totalExpense);
    strict_1.default.equal(d1.totalExpense, 100000);
    strict_1.default.equal(d2.totalExpense, 400000);
});
(0, node_test_1.default)("skor kesehatan selalu 0..100 pada semua kondisi", () => {
    const cases = [
        [],
        [txn({ amount: 10000 })],
        Array.from({ length: 10 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 90000 })),
        Array.from({ length: 10 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 900000 })),
    ];
    for (const txns of cases) {
        const r = run(txns);
        const score = (0, engine_1.computeFinancialHealthScore)(r.data);
        strict_1.default.ok(score >= 0 && score <= 100, `skor di luar rentang: ${score}`);
    }
});
/* ── Data contoh (seed) ────────────────────────────────── */
(0, node_test_1.default)("seed 3 bulan realistis: unik, tanggal valid, ada gaji & outlier", async () => {
    const { generateSeedTransactions } = await Promise.resolve().then(() => __importStar(require("../src/lib/insights/seed")));
    const seed = generateSeedTransactions(new Date(2025, 9, 15));
    strict_1.default.ok(seed.length > 200, `minimal 200 transaksi, dapat ${seed.length}`);
    strict_1.default.equal(new Set(seed.map((t) => t.id)).size, seed.length, "id unik");
    strict_1.default.ok(seed.some((t) => t.category === "Salary" && !t.isExpense), "ada gaji");
    strict_1.default.ok(seed.some((t) => t.amount >= 2000000), "ada outlier besar");
    for (const t of seed) {
        const d = (0, utils_1.parseDateStr)(t.date);
        strict_1.default.ok(!Number.isNaN(d.getTime()), `tanggal tidak valid: ${t.date}`);
        strict_1.default.ok(t.amount > 0);
    }
    // deterministik
    const again = generateSeedTransactions(new Date(2025, 9, 15));
    strict_1.default.deepEqual(again.map((t) => t.id), seed.map((t) => t.id));
});
(0, node_test_1.default)("seed bisa dijalankan engine tanpa error dan menghasilkan insight", async () => {
    const { generateSeedTransactions } = await Promise.resolve().then(() => __importStar(require("../src/lib/insights/seed")));
    const seed = generateSeedTransactions(new Date(2025, 9, 15));
    const r = run(seed);
    strict_1.default.ok(r.insights.length > 0);
    assertNoRawText(r.insights);
    strict_1.default.ok(r.data.totalIncome > 0 && r.data.totalExpense > 0);
});
/* ── Perbandingan periode sebelumnya (data nyata) ──────── */
(0, node_test_1.default)("prevPeriod dihitung dari data historis, null bila < 3 transaksi", () => {
    // Periode berjalan: 1–10 Okt (10 hari) → periode sebelumnya: 21–30 Sep
    const past = Array.from({ length: 5 }, (_, i) => txn({ date: (0, utils_1.formatYYYYMMDD)(new Date(2025, 8, 24 + i)), amount: 100000 }));
    const current = Array.from({ length: 5 }, (_, i) => txn({ date: (0, utils_1.formatYYYYMMDD)(new Date(2025, 9, i + 1)), amount: 150000 }));
    const all = [...past, ...current];
    const data = (0, engine_1.generateInsightData)(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), all);
    strict_1.default.ok(data.prevPeriod, "histori harus ada");
    strict_1.default.equal(data.prevPeriod.count, 5);
    strict_1.default.equal(data.prevPeriod.expense, 500000);
    const noHistory = (0, engine_1.generateInsightData)(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), current);
    strict_1.default.equal(noHistory.prevPeriod, null, "tanpa histori → null");
});
(0, node_test_1.default)("period_comparison memakai angka prev yang benar dan tidak menyesatkan", () => {
    const past = Array.from({ length: 6 }, (_, i) => txn({ date: (0, utils_1.formatYYYYMMDD)(new Date(2025, 8, 24 + i)), amount: 100000, category: "Food" }));
    const current = Array.from({ length: 6 }, (_, i) => txn({ date: (0, utils_1.formatYYYYMMDD)(new Date(2025, 9, i + 1)), amount: 200000, category: "Food" }));
    const data = (0, engine_1.generateInsightData)(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), [...past, ...current]);
    const cfg = insights_1.ALL_INSIGHTS.find((c) => c.id === "period_comparison");
    strict_1.default.ok(cfg.trigger(data), "trigger aktif bila ada histori");
    const out = cfg.generate(data);
    const combined = `${out.message} ${out.details ?? ""}`;
    strict_1.default.ok(combined.includes("1.200.000"), `harus menyebut total periode ini, dapat: ${combined}`);
    strict_1.default.ok(combined.includes("600.000"), `harus menyebut total periode lalu, dapat: ${combined}`);
    strict_1.default.ok(combined.includes("100%"), `harus menyebut kenaikan 100%, dapat: ${combined}`);
});
(0, node_test_1.default)("tanpa histori cukup → period_comparison tidak dipicu", () => {
    const current = Array.from({ length: 6 }, (_, i) => txn({ date: (0, utils_1.formatYYYYMMDD)(new Date(2025, 9, i + 1)), amount: 90000 }));
    const data = (0, engine_1.generateInsightData)(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), current);
    const cfg = insights_1.ALL_INSIGHTS.find((c) => c.id === "period_comparison");
    strict_1.default.equal(cfg.trigger(data), false);
});
/* ── Pencapaian positif ────────────────────────────────── */
(0, node_test_1.default)("positive_achievement tampil saat nabung ≥ 20%", () => {
    const txns = [
        ...Array.from({ length: 5 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 1000000, category: "Salary" })),
        txn({ date: "2 Oktober", amount: 300000, category: "Food" }),
    ];
    const data = (0, engine_1.generateInsightData)(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
    const cfg = insights_1.ALL_INSIGHTS.find((c) => c.id === "positive_achievement");
    strict_1.default.ok(cfg.trigger(data), "harus terpicu saat savings rate tinggi");
    const out = cfg.generate(data);
    strict_1.default.ok(out.message.includes("Rp"), `semua varian menyebut angka rupiah, dapat: ${out.message}`);
    assertNoRawText([{
            id: "x", type: "positive_achievement", category: "positive",
            sentiment: "positive", priority: 50, ...out,
        }]);
});
(0, node_test_1.default)("10 tipe insight terdaftar dan punya ikon valid", () => {
    strict_1.default.ok(insights_1.ALL_INSIGHTS.length >= 8, `minimal 8 tipe, ada ${insights_1.ALL_INSIGHTS.length}`);
    const ids = insights_1.ALL_INSIGHTS.map((c) => c.id);
    strict_1.default.equal(new Set(ids).size, ids.length, "id unik");
    for (const cfg of insights_1.ALL_INSIGHTS) {
        strict_1.default.ok(cfg.basePriority >= 0 && cfg.basePriority <= 100, `${cfg.id} priority di luar 0-100`);
        strict_1.default.ok(["health", "spending", "anomaly", "projection", "positive", "data_quality"].includes(cfg.category), `${cfg.id} kategori tidak dikenal`);
        strict_1.default.ok(["positive", "neutral", "warning", "critical"].includes(cfg.sentiment), `${cfg.id} sentiment tidak dikenal`);
    }
});
(0, node_test_1.default)("maksimal 1 emoji per judul+pesan insight", async () => {
    const { generateSeedTransactions } = await Promise.resolve().then(() => __importStar(require("../src/lib/insights/seed")));
    const emoji = new RegExp("[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]|[\\u2600-\\u27BF\\u2B50\\u2705\\u274C]", "g");
    const datasets = [
        generateSeedTransactions(new Date(2025, 9, 15)),
        Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 45000 })),
        Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 1000000, category: "Salary" })),
    ];
    for (const txns of datasets) {
        for (const insight of run(txns).insights) {
            const text = `${insight.title} ${insight.message}`;
            const count = (text.match(emoji) || []).length;
            strict_1.default.ok(count <= 1, `lebih dari 1 emoji: "${text}" (${count})`);
        }
    }
});
(0, node_test_1.default)("ada pemasukan → tidak pernah memilih narasi 'Belum Ada Pemasukan'", () => {
    const txns = [
        txn({ date: "1 Oktober", isExpense: false, amount: 5000000, category: "Salary" }),
        ...Array.from({ length: 6 }, (_, i) => txn({ date: `${i + 2} Oktober`, amount: 150000, category: "Food" })),
    ];
    const cfg = insights_1.ALL_INSIGHTS.find((c) => c.id === "cash_flow_health");
    const data = (0, engine_1.generateInsightData)(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
    strict_1.default.ok(data.totalIncome > 0, "pemasukan harus terhitung");
    const out = cfg.generate(data);
    strict_1.default.notEqual(out.title, "Belum Ada Pemasukan");
    strict_1.default.ok(!out.message.includes("Belum tercatat pemasukan"));
    strict_1.default.equal(out.sentiment, "positive");
});
(0, node_test_1.default)("tanpa pemasukan → narasi 'Belum Ada Pemasukan' + sentiment critical", () => {
    const txns = Array.from({ length: 6 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 120000 }));
    const cfg = insights_1.ALL_INSIGHTS.find((c) => c.id === "cash_flow_health");
    const data = (0, engine_1.generateInsightData)(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
    const out = cfg.generate(data);
    strict_1.default.equal(out.title, "Belum Ada Pemasukan");
    strict_1.default.equal(out.sentiment, "critical");
});
