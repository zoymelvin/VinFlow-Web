import type { Transaction } from "@/store/useFinanceStore";

/** PRNG deterministik (mulberry32) supaya data contoh selalu sama. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

    
/**
 * Data contoh ~3 bulan transaksi realistis:
 * gaji bulanan, sewa kost, langganan tetap, belanja harian,
 * akhir pekan lebih boros, plus satu transaksi janggal.
 */
export function generateSeedTransactions(now: Date = new Date()): Transaction[] {
  const rnd = mulberry32(42);
  const txns: Transaction[] = [];
  let seq = 0;

  const push = (t: Omit<Transaction, "id">) => {
    seq += 1;
    txns.push({ ...t, id: `seed-${seq}` });
  };

  const fmtDate = (d: Date) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
  const fmtTime = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  for (let back = 92; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // Gaji — tanggal 25
    if (d.getDate() === 25) {
      push({
        name: "Gaji Bulanan", category: "Salary", amount: 6_500_000, isExpense: false,
        pocketId: "p1", time: fmtTime(9, 0), date: fmtDate(d),
      });
    }

    // Sewa kost — tanggal 1
    if (d.getDate() === 1) {
      push({
        name: "Sewa Kost", category: "Rent", amount: 950_000, isExpense: true,
        pocketId: "p1", time: fmtTime(8, 30), date: fmtDate(d),
      });
    }

    // Langganan streaming — tanggal 3
    if (d.getDate() === 3) {
      push({
        name: "Langganan Streaming", category: "Hobby", amount: 186_000, isExpense: true,
        pocketId: "p2", time: fmtTime(10, 5), date: fmtDate(d),
      });
    }

    // Internet rumah — tanggal 10
    if (d.getDate() === 10) {
      push({
        name: "Tagihan Internet", category: "Data Plan", amount: 355_000, isExpense: true,
        pocketId: "p1", time: fmtTime(19, 15), date: fmtDate(d),
      });
    }

    // Makan — tiap hari
    const meals = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < meals; i++) {
      const base = 28_000 + Math.round(rnd() * 35_000);
      push({
        name: rnd() > 0.5 ? "Makan Siang" : "Kopi & Snack",
        category: "Food",
        amount: isWeekend ? base + 15_000 : base,
        isExpense: true,
        pocketId: rnd() > 0.5 ? "p2" : "p3",
        time: fmtTime(11 + i * 5, Math.floor(rnd() * 60)),
        date: fmtDate(d),
      });
    }

    // Transport — hari kerja
    if (!isWeekend && rnd() > 0.25) {
      push({
        name: rnd() > 0.5 ? "Bensin" : "Ojek Online",
        category: "Transport",
        amount: 15_000 + Math.round(rnd() * 30_000),
        isExpense: true,
        pocketId: "p3",
        time: fmtTime(7, Math.floor(rnd() * 60)),
        date: fmtDate(d),
      });
    }

    // Belanja — akhir pekan lebih sering
    if ((isWeekend && rnd() > 0.45) || rnd() > 0.9) {
      push({
        name: isWeekend ? "Belanja Mingguan" : "Belanja Online",
        category: "Shopping",
        amount: 90_000 + Math.round(rnd() * 350_000),
        isExpense: true,
        pocketId: "p1",
        time: fmtTime(14, Math.floor(rnd() * 60)),
        date: fmtDate(d),
      });
    }
  }

  // Satu transaksi janggal (outlier) — pembelian elektronik
  const outlierDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 20);
  push({
    name: "Beli Headphone", category: "Shopping", amount: 2_750_000, isExpense: true,
    pocketId: "p1", time: fmtTime(20, 45), date: fmtDate(outlierDay),
  });

  return txns;
}
