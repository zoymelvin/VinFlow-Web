import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateInsightData,
  evaluateInsights,
  computeFinancialHealthScore,
} from "../src/lib/insights/engine";
import { formatCurrency, parseDateStr, formatYYYYMMDD } from "../src/lib/insights/utils";
import { GLOBAL_CONFIG } from "../src/lib/insights/config";
import { ALL_INSIGHTS } from "../src/lib/insights/insights";
import type { Transaction, Pocket } from "../src/store/useFinanceStore";

/* ── Fixtures ──────────────────────────────────────────── */

const POCKETS: Pocket[] = [
  { id: "p1", name: "BCA", category: "Bank", balance: 5_000_000, iconName: "Building" },
  { id: "p2", name: "Tunai", category: "Cash", balance: 300_000, iconName: "Coins" },
];

let seq = 0;
function txn(partial: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    name: "Expense",
    category: "Food",
    amount: 50_000,
    isExpense: true,
    pocketId: "p1",
    time: "12:00",
    date: "7 Oktober",
    ...partial,
  };
}

function rangeOf(txns: Transaction[]) {
  const times = txns.map((t) => parseDateStr(t.date).getTime());
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}

function run(txns: Transaction[], pockets: Pocket[] = POCKETS) {
  const r = txns.length ? rangeOf(txns) : { start: new Date(), end: new Date() };
  const data = generateInsightData(txns, pockets, r.start, r.end);
  const insights = evaluateInsights(data);
  return { data, insights };
}

const MESSAGES = ["undefined", "NaN", "[object Object]", "null%", "Insight:", "TODO", "{{", "}}"];

function assertNoRawText(insights: ReturnType<typeof evaluateInsights>) {
  for (const i of insights) {
    assert.ok(i.title && i.title.length > 0, "title wajib terisi");
    assert.ok(i.message && i.message.length > 0, "message wajib terisi");
    for (const bad of MESSAGES) {
      assert.ok(
        !i.message.includes(bad) && !i.title.includes(bad),
        `teks mentah bocor "${bad}" di: ${i.message}`
      );
    }
  }
}

/* ── Kasus khusus ──────────────────────────────────────── */

test("tidak ada transaksi sama sekali → tidak error, insight tetap valid", () => {
  const { data, insights } = run([]);
  assert.equal(data.totalTransactions, 0);
  assert.equal(data.totalIncome, 0);
  assert.equal(data.totalExpense, 0);
  assert.ok(insights.length <= GLOBAL_CONFIG.insightDisplayLimit);
  assertNoRawText(insights);
});

test("pemasukan nol tapi ada pengeluaran → cash flow kritis", () => {
  const txns = Array.from({ length: 8 }, (_, i) =>
    txn({ date: `${i + 1} Oktober`, amount: 100_000 + i * 10_000 })
  );
  const { insights } = run(txns);
  const cash = insights.find((i) => i.type === "cash_flow_health");
  assert.ok(cash, "cash_flow_health harus muncul");
  assert.equal(cash!.sentiment, "critical");
  assertNoRawText(insights);
});

test("hanya 1 transaksi → aman, tanpa pembagian nol", () => {
  const { data, insights } = run([txn({ amount: 25_000 })]);
  assert.equal(data.periodLengthDays, 1);
  assertNoRawText(insights);
  const score = computeFinancialHealthScore(data);
  assert.ok(score >= 0 && score <= 100);
});

test("hanya 2 transaksi → data_quality tampil bila di bawah threshold", () => {
  const txns = [txn({ date: "1 Oktober" }), txn({ date: "2 Oktober" })];
  const { insights } = run(txns);
  const dq = insights.find((i) => i.type === "data_quality");
  assert.ok(dq, "data_quality harus muncul untuk data sangat sedikit");
  assertNoRawText(insights);
});

test("transaksi tanpa kategori → jatuh ke 'Lainnya' tanpa error", () => {
  const txns = Array.from({ length: 6 }, (_, i) =>
    txn({ date: `${i + 1} Oktober`, category: "", amount: 40_000 })
  );
  const { data, insights } = run(txns);
  assert.equal(data.topExpenseCategory.name, "Lainnya");
  assertNoRawText(insights);
});

test("rentang 1 hari → periodLength minimal 1, tidak ada pembagian nol", () => {
  const txns = [txn({ date: "7 Oktober", amount: 100_000 }), txn({ date: "7 Oktober", isExpense: false, amount: 200_000 })];
  const { data } = run(txns);
  assert.equal(data.periodLengthDays, 1);
  assert.ok(Number.isFinite(data.avgDailyExpense));
});

test("rentang 1 tahun → proyeksi & habits tetap masuk akal", () => {
  const txns = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(2025, 0, 1 + i * 9);
    return txn({ date: formatYYYYMMDD(d), amount: 75_000 });
  });
  const { data, insights } = run(txns);
  assert.ok(data.periodLengthDays > 300);
  assertNoRawText(insights);
  assert.ok(insights.length > 0);
});

test("tanpa histori sebelumnya → period_comparison tidak membandingkan angka karangan", () => {
  // Data hanya pada satu hari, tanpa data pendahulu
  const txns = Array.from({ length: 6 }, () => txn({ date: "7 Oktober", amount: 30_000 }));
  const { insights } = run(txns);
  const comp = insights.find((i) => i.type === "period_comparison");
  // period_comparison hanya boleh muncul bila benar-benar ada data pembanding;
  // engine saat ini tidak punya data histori → wajib tidak menampilkan klaim persentase.
  if (comp) {
    assert.ok(!comp.message.includes("% naik"), "tidak boleh mengarang persentase");
  }
});

/* ── Konsistensi & seleksi ─────────────────────────────── */

test("semua 9 jenis insight punya trigger+generate yang tidak error", () => {
  const txns = Array.from({ length: 12 }, (_, i) =>
    txn({ date: `${(i % 10) + 1} Oktober`, amount: 50_000 * (i + 1), category: i % 3 === 0 ? "Food" : "Transport" })
  );
  const data = generateInsightData(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
  for (const cfg of ALL_INSIGHTS) {
    if (cfg.trigger(data)) {
      const out = cfg.generate(data);
      assert.ok(out.title.length > 0, `${cfg.id} title kosong`);
      assert.ok(out.message.length > 0, `${cfg.id} message kosong`);
      assert.ok(!out.message.includes("undefined"), `${cfg.id} menghasilkan undefined`);
    }
  }
});

test("variasi narasi stabil: seed sama → pesan sama", () => {
  const txns = Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 60_000 }));
  const a = run(txns).insights;
  const b = run(txns).insights;
  assert.deepEqual(
    a.map((i) => [i.type, i.displayProps?.variantIndex]),
    b.map((i) => [i.type, i.displayProps?.variantIndex])
  );
});

test("batas tampilan dihormati dan tidak ada tipe ganda", () => {
  const txns = Array.from({ length: 30 }, (_, i) =>
    txn({ date: `${(i % 20) + 1} Oktober`, amount: 20_000 + i * 5_000, category: i % 4 === 0 ? "Shopping" : "Food" })
  );
  const { insights } = run(txns);
  assert.ok(insights.length <= GLOBAL_CONFIG.insightDisplayLimit);
  const types = insights.map((i) => i.type);
  assert.equal(new Set(types).size, types.length, "satu tipe insight tidak boleh dobel");
  for (let i = 1; i < insights.length; i++) {
    assert.ok(insights[i - 1].priority >= insights[i].priority, "urutan priority menurun");
  }
  assertNoRawText(insights);
});

test("minimal satu insight positif bila ada kabar baik", () => {
  const txns = [
    ...Array.from({ length: 6 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 500_000, category: "Salary" })),
    txn({ date: "2 Oktober", amount: 30_000, category: "Food" }),
  ];
  const { insights } = run(txns);
  assert.ok(
    insights.some((i) => i.sentiment === "positive"),
    "harus ada minimal satu insight positif"
  );
});

test("semua uang memakai format Rp dan tanpa desimal", () => {
  const a = formatCurrency(1_250_000);
  assert.ok(a.replace(/\u00A0/g, " ").startsWith("Rp"), `harus diawali Rp, dapat: ${a}`);
  assert.ok(a.includes("1.250.000"), `harus memakai pemisah ribuan id-ID, dapat: ${a}`);
  assert.ok(formatCurrency(0).includes("0"));
  assert.ok(!formatCurrency(999.5).includes(","));
});

test("parseDateStr mendukung ISO, Indonesia, dan DD/MM/YYYY", () => {
  assert.equal(formatYYYYMMDD(parseDateStr("2025-10-07")), "2025-10-07");
  const indo = parseDateStr("7 Oktober");
  assert.equal(indo.getDate(), 7);
  assert.equal(indo.getMonth(), 9);
  assert.equal(formatYYYYMMDD(parseDateStr("07/10/2025")), "2025-10-07");
});

test("ganti filter dompet/rentang → data & insight ikut berubah", () => {
  const txns = [
    txn({ id: "a", date: "1 Oktober", pocketId: "p1", amount: 100_000 }),
    txn({ id: "b", date: "2 Oktober", pocketId: "p2", amount: 400_000 }),
  ];
  const d1 = generateInsightData(txns.filter((t) => t.pocketId === "p1"), POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 1));
  const d2 = generateInsightData(txns.filter((t) => t.pocketId === "p2"), POCKETS, new Date(2025, 9, 2), new Date(2025, 9, 2));
  assert.notEqual(d1.totalExpense, d2.totalExpense);
  assert.equal(d1.totalExpense, 100_000);
  assert.equal(d2.totalExpense, 400_000);
});

test("skor kesehatan selalu 0..100 pada semua kondisi", () => {
  const cases = [
    [],
    [txn({ amount: 10_000 })],
    Array.from({ length: 10 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 90_000 })),
    Array.from({ length: 10 }, (_, i) => txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 900_000 })),
  ];
  for (const txns of cases) {
    const r = run(txns);
    const score = computeFinancialHealthScore(r.data);
    assert.ok(score >= 0 && score <= 100, `skor di luar rentang: ${score}`);
  }
});

/* ── Data contoh (seed) ────────────────────────────────── */

test("seed 3 bulan realistis: unik, tanggal valid, ada gaji & outlier", async () => {
  const { generateSeedTransactions } = await import("../src/lib/insights/seed");
  const seed = generateSeedTransactions(new Date(2025, 9, 15));
  assert.ok(seed.length > 200, `minimal 200 transaksi, dapat ${seed.length}`);
  assert.equal(new Set(seed.map((t) => t.id)).size, seed.length, "id unik");
  assert.ok(seed.some((t) => t.category === "Salary" && !t.isExpense), "ada gaji");
  assert.ok(seed.some((t) => t.amount >= 2_000_000), "ada outlier besar");
  for (const t of seed) {
    const d = parseDateStr(t.date);
    assert.ok(!Number.isNaN(d.getTime()), `tanggal tidak valid: ${t.date}`);
    assert.ok(t.amount > 0);
  }
  // deterministik
  const again = generateSeedTransactions(new Date(2025, 9, 15));
  assert.deepEqual(again.map((t) => t.id), seed.map((t) => t.id));
});

test("seed bisa dijalankan engine tanpa error dan menghasilkan insight", async () => {
  const { generateSeedTransactions } = await import("../src/lib/insights/seed");
  const seed = generateSeedTransactions(new Date(2025, 9, 15));
  const r = run(seed);
  assert.ok(r.insights.length > 0);
  assertNoRawText(r.insights);
  assert.ok(r.data.totalIncome > 0 && r.data.totalExpense > 0);
});

/* ── Perbandingan periode sebelumnya (data nyata) ──────── */

test("prevPeriod dihitung dari data historis, null bila < 3 transaksi", () => {
  // Periode berjalan: 1–10 Okt (10 hari) → periode sebelumnya: 21–30 Sep
  const past = Array.from({ length: 5 }, (_, i) =>
    txn({ date: formatYYYYMMDD(new Date(2025, 8, 24 + i)), amount: 100_000 })
  );
  const current = Array.from({ length: 5 }, (_, i) =>
    txn({ date: formatYYYYMMDD(new Date(2025, 9, i + 1)), amount: 150_000 })
  );
  const all = [...past, ...current];
  const data = generateInsightData(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), all);
  assert.ok(data.prevPeriod, "histori harus ada");
  assert.equal(data.prevPeriod!.count, 5);
  assert.equal(data.prevPeriod!.expense, 500_000);

  const noHistory = generateInsightData(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), current);
  assert.equal(noHistory.prevPeriod, null, "tanpa histori → null");
});

test("period_comparison memakai angka prev yang benar dan tidak menyesatkan", () => {
  const past = Array.from({ length: 6 }, (_, i) =>
    txn({ date: formatYYYYMMDD(new Date(2025, 8, 24 + i)), amount: 100_000, category: "Food" })
  );
  const current = Array.from({ length: 6 }, (_, i) =>
    txn({ date: formatYYYYMMDD(new Date(2025, 9, i + 1)), amount: 200_000, category: "Food" })
  );
  const data = generateInsightData(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), [...past, ...current]);
  const cfg = ALL_INSIGHTS.find((c) => c.id === "period_comparison")!;
  assert.ok(cfg.trigger(data), "trigger aktif bila ada histori");
  const out = cfg.generate(data);
  const combined = `${out.message} ${out.details ?? ""}`;
  assert.ok(combined.includes("1.200.000"), `harus menyebut total periode ini, dapat: ${combined}`);
  assert.ok(combined.includes("600.000"), `harus menyebut total periode lalu, dapat: ${combined}`);
  assert.ok(combined.includes("100%"), `harus menyebut kenaikan 100%, dapat: ${combined}`);
});

test("tanpa histori cukup → period_comparison tidak dipicu", () => {
  const current = Array.from({ length: 6 }, (_, i) =>
    txn({ date: formatYYYYMMDD(new Date(2025, 9, i + 1)), amount: 90_000 })
  );
  const data = generateInsightData(current, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10), current);
  const cfg = ALL_INSIGHTS.find((c) => c.id === "period_comparison")!;
  assert.equal(cfg.trigger(data), false);
});

/* ── Pencapaian positif ────────────────────────────────── */

test("positive_achievement tampil saat nabung ≥ 20%", () => {
  const txns = [
    ...Array.from({ length: 5 }, (_, i) =>
      txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 1_000_000, category: "Salary" })
    ),
    txn({ date: "2 Oktober", amount: 300_000, category: "Food" }),
  ];
  const data = generateInsightData(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
  const cfg = ALL_INSIGHTS.find((c) => c.id === "positive_achievement")!;
  assert.ok(cfg.trigger(data), "harus terpicu saat savings rate tinggi");
  const out = cfg.generate(data);
  assert.ok(out.message.includes("Rp"), `semua varian menyebut angka rupiah, dapat: ${out.message}`);
  assertNoRawText([{
    id: "x", type: "positive_achievement", category: "positive",
    sentiment: "positive", priority: 50, ...out,
  }]);
});

test("10 tipe insight terdaftar dan punya ikon valid", () => {
  assert.ok(ALL_INSIGHTS.length >= 8, `minimal 8 tipe, ada ${ALL_INSIGHTS.length}`);
  const ids = ALL_INSIGHTS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "id unik");
  for (const cfg of ALL_INSIGHTS) {
    assert.ok(cfg.basePriority >= 0 && cfg.basePriority <= 100, `${cfg.id} priority di luar 0-100`);
    assert.ok(["health", "spending", "anomaly", "projection", "positive", "data_quality"].includes(cfg.category), `${cfg.id} kategori tidak dikenal`);
    assert.ok(["positive", "neutral", "warning", "critical"].includes(cfg.sentiment), `${cfg.id} sentiment tidak dikenal`);
  }
});

test("maksimal 1 emoji per judul+pesan insight", async () => {
  const { generateSeedTransactions } = await import("../src/lib/insights/seed");
  const emoji = new RegExp(
    "[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]|[\\u2600-\\u27BF\\u2B50\\u2705\\u274C]",
    "g"
  );

  const datasets = [
    generateSeedTransactions(new Date(2025, 9, 15)),
    Array.from({ length: 8 }, (_, i) => txn({ date: `${i + 1} Oktober`, amount: 45_000 })),
    Array.from({ length: 8 }, (_, i) =>
      txn({ date: `${i + 1} Oktober`, isExpense: false, amount: 1_000_000, category: "Salary" })
    ),
  ];

  for (const txns of datasets) {
    for (const insight of run(txns).insights) {
      const text = `${insight.title} ${insight.message}`;
      const count = (text.match(emoji) || []).length;
      assert.ok(count <= 1, `lebih dari 1 emoji: "${text}" (${count})`);
    }
  }
});

test("ada pemasukan → tidak pernah memilih narasi 'Belum Ada Pemasukan'", () => {
  const txns = [
    txn({ date: "1 Oktober", isExpense: false, amount: 5_000_000, category: "Salary" }),
    ...Array.from({ length: 6 }, (_, i) =>
      txn({ date: `${i + 2} Oktober`, amount: 150_000, category: "Food" })
    ),
  ];
  const cfg = ALL_INSIGHTS.find((c) => c.id === "cash_flow_health")!;
  const data = generateInsightData(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
  assert.ok(data.totalIncome > 0, "pemasukan harus terhitung");
  const out = cfg.generate(data);
  assert.notEqual(out.title, "Belum Ada Pemasukan");
  assert.ok(!out.message.includes("Belum tercatat pemasukan"));
  assert.equal(out.sentiment, "positive");
});

test("tanpa pemasukan → narasi 'Belum Ada Pemasukan' + sentiment critical", () => {
  const txns = Array.from({ length: 6 }, (_, i) =>
    txn({ date: `${i + 1} Oktober`, amount: 120_000 })
  );
  const cfg = ALL_INSIGHTS.find((c) => c.id === "cash_flow_health")!;
  const data = generateInsightData(txns, POCKETS, new Date(2025, 9, 1), new Date(2025, 9, 10));
  const out = cfg.generate(data);
  assert.equal(out.title, "Belum Ada Pemasukan");
  assert.equal(out.sentiment, "critical");
});
