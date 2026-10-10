import { InsightConfig } from "./types";
import { GLOBAL_CONFIG } from "./config";
import { formatCurrency, parseDateStr } from "./utils";

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function pickVariant<T>(variants: T[], seed: string): { item: T; index: number } {
  const idx = stableHash(seed) % variants.length;
  return { item: variants[idx], index: idx };
}

/* ============================================================
   INSIGHT 1: Cash Flow Health (Kesehatan Arus Kas)
   ============================================================ */
export const cashFlowHealth: InsightConfig = {
  id: "cash_flow_health",
  category: "health",
  sentiment: "neutral",
  basePriority: 80,
  trigger: (d) => d.totalTransactions >= GLOBAL_CONFIG.thresholds.lowDataThreshold,
  generate: (d) => {
    const ratio = d.totalIncome > 0 ? d.totalExpense / d.totalIncome : Infinity;
    const savingsRate = d.totalIncome > 0 ? (d.netBalance / d.totalIncome) * 100 : 0;

    // Varian dipilih sesuai kondisi nyata — tidak semua narasi berlaku di semua state
    let variants: Array<{
      title: string;
      message: string;
      details: string;
      icon: string;
    }>;

    if (d.totalIncome === 0 && d.totalExpense === 0) {
      variants = [
        {
          title: "Belum Ada Data Arus Kas",
          message: "Belum ada pemasukan maupun pengeluaran tercatat pada periode ini.",
          details: "Tambahkan transaksi pertama agar kesehatan keuangan bisa dihitung.",
          icon: "HelpCircle",
        },
      ];
    } else if (d.totalIncome === 0) {
      // Tanpa pemasukan → satu-satunya narasi yang jujur
      variants = [
        {
          title: "Belum Ada Pemasukan",
          message: `Belum tercatat pemasukan pada periode ini, sedangkan pengeluaran ${formatCurrency(d.totalExpense)}.`,
          details: `Pastikan mencatat seluruh pemasukan agar analisis akurat. Jika memang tidak ada pemasukan, prioritaskan pengeluaran darurat saja.`,
          icon: "HelpCircle",
        },
      ];
    } else if (d.totalExpense === 0) {
      variants = [
        {
          title: "Pengeluaran Nol",
          message: `Tidak ada pengeluaran tercatat. Pemasukan ${formatCurrency(d.totalIncome)} utuh tersisa.`,
          details: `Kondisi ideal untuk menabung atau investasi. Pertimbangkan memindahkan ke rekening tabungan.`,
          icon: "Sparkles",
        },
      ];
    } else if (ratio >= GLOBAL_CONFIG.thresholds.cashFlowCriticalRatio) {
      variants = [
        {
          title: "Arus Kas Kritis",
          message: `Pengeluaran (${formatCurrency(d.totalExpense)}) melebihi pemasukan (${formatCurrency(d.totalIncome)}). Defisit ${formatCurrency(Math.abs(d.netBalance))}.`,
          details: `Segera tinjau kategori pengeluaran terbesar dan cari pemasukan tambahan atau kurangi belanja non-esensial.`,
          icon: "AlertCircle",
        },
        {
          title: "Defisit Perlu Ditangani",
          message: `Selisih ${formatCurrency(Math.abs(d.netBalance))} antara pemasukan ${formatCurrency(d.totalIncome)} dan pengeluaran ${formatCurrency(d.totalExpense)}.`,
          details: `Prioritaskan kebutuhan pokok dan tunda belanja fleksibel sampai pemasukan berikutnya.`,
          icon: "AlertTriangle",
        },
      ];
    } else if (ratio >= GLOBAL_CONFIG.thresholds.cashFlowWarningRatio) {
      variants = [
        {
          title: "Arus Kas Tipis",
          message: `Pengeluaran mencapai ${(ratio * 100).toFixed(0)}% dari pemasukan. Sisa hanya ${formatCurrency(Math.abs(d.netBalance))}.`,
          details: `Anda berada di zona aman tapi tipis. Hindari belanja impulsif sampai akhir periode.`,
          icon: "AlertTriangle",
        },
        {
          title: "Hampir Batas Anggaran",
          message: `${(ratio * 100).toFixed(0)}% pemasukan sudah terpakai; tersisa ${formatCurrency(Math.abs(d.netBalance))} untuk sisa periode.`,
          details: `Target sehat di bawah 80%. Kurangi pos non-esensial agar tidak melewati batas.`,
          icon: "AlertTriangle",
        },
      ];
    } else {
      variants = [
        {
          title: "Arus Kas Sehat",
          message: `Pemasukan Anda cukup menutupi pengeluaran dengan sisa ${formatCurrency(Math.abs(d.netBalance))} (${savingsRate.toFixed(0)}% disisihkan).`,
          details: `Rasio pengeluaran terhadap pemasukan: ${(ratio * 100).toFixed(0)}%. Target sehat di bawah 80%.`,
          icon: "CheckCircle",
        },
        {
          title: "Arus Kas Sehat",
          message: `Keuangan bulan ini stabil. Anda berhasil menyisihkan ${formatCurrency(Math.abs(d.netBalance))} dari total pemasukan.`,
          details: `Sisa saldo positif menunjukkan kebiasaan menabung yang baik. Terus pertahankan!`,
          icon: "PiggyBank",
        },
        {
          title: "Pemasukan Cukup Tutupi Belanja",
          message: `Belanja ${formatCurrency(d.totalExpense)} dari pemasukan ${formatCurrency(d.totalIncome)}; sisihkan ${formatCurrency(Math.abs(d.netBalance))}.`,
          details: `Rasio ${(ratio * 100).toFixed(0)}% masih di bawah batas aman 80%.`,
          icon: "TrendingUp",
        },
      ];
    }

    const seed = `cash_flow_health_${d.startDate.toISOString().slice(0, 10)}_${d.endDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    let sentiment: "positive" | "neutral" | "warning" | "critical" = "neutral";
    if (d.totalIncome === 0 && d.totalExpense > 0) sentiment = "critical";
    else if (d.totalIncome === 0 && d.totalExpense === 0) sentiment = "neutral";
    else if (d.totalExpense === 0 && d.totalIncome > 0) sentiment = "positive";
    else if (ratio >= GLOBAL_CONFIG.thresholds.cashFlowCriticalRatio) sentiment = "critical";
    else if (ratio >= GLOBAL_CONFIG.thresholds.cashFlowWarningRatio) sentiment = "warning";
    else sentiment = "positive";

    return { ...item, sentiment, displayProps: { variantIndex: index }, actionLabel: "Tambah Transaksi", actionHref: "/transaksi" };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 2: Top Expense Category Dominance (Kategori Dominan)
   ============================================================ */
export const topExpenseDominance: InsightConfig = {
  id: "top_expense_dominance",
  category: "spending",
  sentiment: "warning",
  basePriority: 70,
  trigger: (d) => d.topExpenseCategory.amount > 0 && d.totalExpense > 0 && (d.topExpenseCategory.amount / d.totalExpense) >= GLOBAL_CONFIG.thresholds.significantCategoryShare,
  generate: (d) => {
    const share = (d.topExpenseCategory.amount / d.totalExpense) * 100;
    const cat = d.topExpenseCategory.name;

    const variants = [
      {
        title: `${cat} Mendominasi`,
        message: `${cat} menyumbang ${share.toFixed(0)}% dari total pengeluaran (${formatCurrency(d.topExpenseCategory.amount)}).`,
        details: `Kategori ini jauh di atas rata-rata wajar (${GLOBAL_CONFIG.thresholds.significantCategoryShare * 100}%). Coba batasi budget untuk kategori ini.`,
        icon: "PieChart",
      },
      {
        title: `Fokus pada ${cat}`,
        message: `Hampir ${share.toFixed(0)}% uang keluar ke ${cat}. Itu ${formatCurrency(d.topExpenseCategory.amount)} dari total ${formatCurrency(d.totalExpense)}.`,
        details: `Dominasi satu kategori berarti risiko tinggi jika harga naik atau kebutuhan berubah. Diversifikasi pengeluaran lebih aman.`,
        icon: "Target",
      },
      {
        title: `Perhatian: ${cat} Terlalu Besar`,
        message: `Pengeluaran ${cat} sebesar ${formatCurrency(d.topExpenseCategory.amount)} (${share.toFixed(0)}% total).`,
        details: `Ambil sebulan belanja ${cat} catat detailnya. Sering kali ada item yang bisa dikurangi tanpa merasa kehilangan kualitas hidup.`,
        icon: "Search",
      },
      {
        title: `Kategori Utama: ${cat}`,
        message: `Dari ${d.expenseByCat.size} kategori, ${cat} ambil porsi ${share.toFixed(0)}%.`,
        details: `Ini bukan salah, tapi penting dipantau. Set target bulanan khusus untuk ${cat} agar tidak makan budget kategori lain.`,
        icon: "TrendingUp",
      },
      {
        title: `Pengeluaran Terpusat di ${cat}`,
        message: `${share.toFixed(0)}% budget pergi ke satu kategori: ${cat} (${formatCurrency(d.topExpenseCategory.amount)}).`,
        details: `Jika ${cat} naik 10%, total pengeluaran naik ${(share * 0.1).toFixed(0)}%. Buat buffer atau cari alternatif lebih murah.`,
        icon: "Shield",
      },
      {
        title: `Dominasi Kategori ${cat}`,
        message: `Porsi ${cat} sebesar ${share.toFixed(0)}% — di atas batas sehat ${(GLOBAL_CONFIG.thresholds.significantCategoryShare * 100).toFixed(0)}%.`,
        details: `Coba challenge: kurangi ${cat} 10% bulan depan. Hemat ${formatCurrency(d.topExpenseCategory.amount * 0.1)} tanpa merasa terlalu tertekan.`,
        icon: "MinusCircle",
      },
    ];

    const seed = `top_expense_${cat}_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, sentiment: "warning", displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 3: Period Comparison (Perbandingan Periode)
   ============================================================ */
export const periodComparison: InsightConfig = {
  id: "period_comparison",
  category: "spending",
  sentiment: "neutral",
  basePriority: 65,
  // Hanya tampil bila benar-benar ada data periode sebelumnya (≥3 transaksi)
  trigger: (d) => d.prevPeriod !== null && d.totalTransactions >= 3,
  generate: (d) => {
    const prev = d.prevPeriod!;
    const pct = (cur: number, before: number) =>
      before > 0 ? ((cur - before) / before) * 100 : null;

    const expChange = pct(d.totalExpense, prev.expense);
    const incChange = pct(d.totalIncome, prev.income);

    // Kategori dengan perubahan terbesar (hanya yang punya pembanding valid)
    let topCatDelta: { cat: string; delta: number } | null = null;
    d.expenseByCat.forEach((cur, cat) => {
      const before = prev.expenseByCat.get(cat);
      if (before && before > 0) {
        const delta = cur - before;
        if (!topCatDelta || Math.abs(delta) > Math.abs(topCatDelta.delta)) {
          topCatDelta = { cat, delta };
        }
      }
    });

    const sign = (n: number) => (n > 0 ? "+" : "");
    const expPct = expChange === null ? null : Math.round(Math.abs(expChange));
    const incPct = incChange === null ? null : Math.round(Math.abs(incChange));
    const pctText = expChange !== null ? ` Perubahan total pengeluaran ${sign(expChange)}${expPct}%.` : "";
    const catDeltaText =
      (topCatDelta
        ? `Penyesuaian terbesar ada di ${(topCatDelta as { cat: string }).cat} (${sign((topCatDelta as { delta: number }).delta)}${formatCurrency(Math.abs((topCatDelta as { delta: number }).delta))}).`
        : `Bandingkan pos per transaksi untuk tahu pemicunya.`) + pctText;

    const dirVariants =
      expChange !== null && expChange >= 10
        ? [
            {
              title: "Pengeluaran Meningkat",
              message: `Pengeluaran naik ${expPct}% dibanding periode sebelumnya: ${formatCurrency(d.totalExpense)} vs ${formatCurrency(prev.expense)}.`,
              details: catDeltaText,
              icon: "TrendingUp",
            },
            {
              title: `Belanja Naik ${expPct}%`,
              message: `Kali ini Anda belanja ${formatCurrency(d.totalExpense)}, padahal periode lalu ${formatCurrency(prev.expense)}.`,
              details: `Selisih ${formatCurrency(d.totalExpense - prev.expense)}.${pctText} Cek pos mana yang paling menambah.`,
              icon: "TrendingUp",
            },
          ]
        : expChange !== null && expChange <= -10
        ? [
            {
              title: "Pengeluaran Menurun 👍",
              message: `Hemat ${expPct}% dari periode lalu: ${formatCurrency(d.totalExpense)} dari sebelumnya ${formatCurrency(prev.expense)}.`,
              details: `Selisih ${formatCurrency(Math.abs(d.totalExpense - prev.expense))} bisa dialihkan ke tabungan.`,
              icon: "TrendingDown",
            },
            {
              title: "Belanja Lebih Hemat",
              message: `Pengeluaran turun jadi ${formatCurrency(d.totalExpense)}; periode lalu ${formatCurrency(prev.expense)}.`,
              details: `Anda menghemat ${formatCurrency(Math.abs(d.totalExpense - prev.expense))} pada rentang ini.${pctText}`,
              icon: "TrendingDown",
            },
          ]
        : [
            {
              title: "Pengeluaran Stabil",
              message: `Pengeluaran relatif tetap: ${formatCurrency(d.totalExpense)} vs ${formatCurrency(prev.expense)} periode lalu (${sign(expChange ?? 0)}${expPct ?? 0}%).`,
              details: `Konsistensi memudahkan perencanaan. Aman untuk menetapkan target bulanan.`,
              icon: "Minus",
            },
            {
              title: "Terkendali Dari Periode Lalu",
              message: `Selisih cuma ${formatCurrency(Math.abs(d.totalExpense - prev.expense))} dari periode sebelumnya (${formatCurrency(prev.expense)}).`,
              details: `Perubahan di bawah 10% biasanya wajar. Pertahankan ritme ini.`,
              icon: "Shield",
            },
          ];

    const catVariant = {
      title: topCatDelta ? `Pendorong Utama: ${(topCatDelta as { cat: string }).cat}` : "Rincian Per Kategori",
      message: topCatDelta
        ? `${(topCatDelta as { cat: string }).cat} berubah ${sign((topCatDelta as { delta: number }).delta)}${formatCurrency(Math.abs((topCatDelta as { delta: number }).delta))} dari periode lalu (total periode ini ${formatCurrency(d.totalExpense)}).`
        : `Total belanja ${formatCurrency(d.totalExpense)} tersebar di ${d.expenseByCat.size} kategori.`,
      details: catDeltaText,
      icon: "PieChart",
    };

    const summaryVariant = {
      title: "Ringkasan Periode",
      message: `${d.totalTransactions} transaksi pada ${d.periodLengthDays} hari, total belanja ${formatCurrency(d.totalExpense)} (periode lalu ${formatCurrency(prev.expense)}).`,
      details:
        expChange !== null
          ? `Perubahan pengeluaran: ${sign(expChange)}${expPct}% dari periode sebelumnya.`
          : `Pembanding persentase belum tersedia untuk periode ini.`,
      icon: "Info",
    };

    const variants = [...dirVariants, catVariant, summaryVariant];

    if (incChange !== null && Math.abs(incChange) >= 10) {
      variants.push({
        title: incChange > 0 ? "Pemasukan Naik" : "Pemasukan Turun",
        message: `Pemasukan berubah ${sign(incChange)}${incPct}% (${formatCurrency(d.totalIncome)} vs ${formatCurrency(prev.income)} sebelumnya).`,
        details:
          incChange > 0
            ? `Jaga agar kenaikan ini tidak diikuti kenaikan gaya hidup.`
            : `Lihat sisi pemasukan; beberapa pos bisa ditunda dulu.`,
        icon: incChange > 0 ? "ArrowUpRight" : "ArrowDownRight",
      });
    }

    const seed = `period_comp_${d.startDate.toISOString().slice(0, 10)}_${d.endDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    const sentiment: "positive" | "neutral" | "warning" =
      expChange !== null && expChange >= 10 ? "warning" : expChange !== null && expChange <= -10 ? "positive" : "neutral";

    return { ...item, sentiment, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 4: Unusual Spike (Lonjakan Tidak Biasa)
   ============================================================ */
export const unusualSpike: InsightConfig = {
  id: "unusual_spike",
  category: "anomaly",
  sentiment: "warning",
  basePriority: 75,
  trigger: (d) => d.totalTransactions >= GLOBAL_CONFIG.thresholds.lowDataThreshold && d.expenseByCat.size > 1,
  generate: (d) => {
    let spikeName = "";
    let spikeAmount = 0;
    let spikeAvgDaily = 0;
    let maxRatio = 1;

    d.expenseByCat.forEach((total, cat) => {
      const daysWithCat = Array.from(d.transactionsByDay.values()).filter((arr) =>
        arr.some((t) => t.isExpense && t.category === cat)
      ).length;
      const avgDaily = daysWithCat > 0 ? total / daysWithCat : 0;
      const overallDailyAvg = d.avgDailyExpense;
      if (overallDailyAvg > 0 && avgDaily > overallDailyAvg * GLOBAL_CONFIG.thresholds.unusualExpenseMultiplier) {
        const ratio = avgDaily / overallDailyAvg;
        if (ratio > maxRatio) {
          maxRatio = ratio;
          spikeName = cat;
          spikeAmount = total;
          spikeAvgDaily = avgDaily;
        }
      }
    });

    if (!spikeName) {
      return {
        title: "Tidak Ada Lonjakan",
        message: "Semua kategori pengeluaran berjalan dalam batas normal.",
        details: "Pola transaksi Anda stabil tanpa lonjakan tajam.",
        icon: "CheckCircle",
        sentiment: "positive" as const,
        displayProps: { variantIndex: 0 },
      };
    }

    const variants = [
      {
        title: `Lonjakan di ${spikeName}`,
        message: `${spikeName} naik ${maxRatio.toFixed(1)}x dari rata-rata harian (${formatCurrency(spikeAvgDaily)}/hari).`,
        details: `Total ${formatCurrency(spikeAmount)} pada periode ini. Cek apakah ada pengeluaran tidak biasa.`,
        icon: "Zap",
      },
      {
        title: `Perhatian: ${spikeName} Melonjak`,
        message: `Rata-rata harian ${spikeName} menjadi ${formatCurrency(spikeAvgDaily)}.`,
        details: `Lonjakan ${(maxRatio * 100 - 100).toFixed(0)}% dibanding batas biasa Anda.`,
        icon: "AlertTriangle",
      },
      {
        title: `Pola ${spikeName} Perlu Dicek`,
        message: `Selama ${d.periodLengthDays} hari, ${spikeName} menyerap ${formatCurrency(spikeAmount)}.`,
        details: `Rata-rata harian kategori ini ${formatCurrency(spikeAvgDaily)} — lihat transaksi besar apa yang mendorongnya.`,
        icon: "Search",
      },
      {
        title: `Fokus Pengawasan: ${spikeName}`,
        message: `Dari total belanja ${formatCurrency(d.totalExpense)}, ${spikeName} menyumbang ${formatCurrency(spikeAmount)}.`,
        details: `Pantau ${spikeName} 7 hari ke depan; bila tetap tinggi, tentukan batas khusus.`,
        icon: "Target",
      },
    ];

    const seed = `spike_${spikeName}_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 5: Outlier Transaction (Transaksi Janggal)
   ============================================================ */
export const outlierTransaction: InsightConfig = {
  id: "outlier_transaction",
  category: "anomaly",
  sentiment: "warning",
  basePriority: 70,
  trigger: (d) => d.totalTransactions >= 3,
  generate: (d) => {
    const expenses = d.filteredTransactions.filter((t) => t.isExpense);
    if (expenses.length < 3) {
      return {
        title: "Data Kurang",
        message: "Butuh minimal 3 transaksi pengeluaran untuk deteksi anomali.",
        details: "Tambah catatan transaksi agar insight ini aktif.",
        icon: "Database",
        sentiment: "neutral" as const,
        displayProps: { variantIndex: 0 },
      };
    }

    const amounts = expenses.map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const threshold = median * 3;

    const outlier = expenses.find((t) => t.amount >= threshold);
    if (!outlier) {
      return {
        title: "Tidak Ada Transaksi Janggal",
        message: "Semua nominal transaksi berada dalam rentang wajar.",
        details: `Median pengeluaran: ${formatCurrency(median)}. Batas anomali: ${formatCurrency(threshold)}.`,
        icon: "CheckCircle",
        sentiment: "positive" as const,
        displayProps: { variantIndex: 0 },
      };
    }

    const outlierRatio = median > 0 ? outlier.amount / median : 0;
    const variants = [
      {
        title: `Transaksi Besar: ${outlier.name}`,
        message: `Satu transaksi ${formatCurrency(outlier.amount)} (${outlierRatio.toFixed(1)}x lipat dari median).`,
        details: `Kategori: ${outlier.category}. Tanggal: ${outlier.date}. Pastikan ini belanja penting.`,
        icon: "Receipt",
      },
      {
        title: `Belanja Luar Biasa Terdeteksi`,
        message: `"${outlier.name}" sebesar ${formatCurrency(outlier.amount)} jauh di atas rata-rata Anda.`,
        details: `Pertimbangkan apakah pengeluaran ini sudah direncanakan sebelumnya.`,
        icon: "CreditCard",
      },
      {
        title: `Cek Ulang: ${outlier.name}`,
        message: `Nominal ${formatCurrency(outlier.amount)} berdiri jauh dari median ${formatCurrency(median)}.`,
        details: `Dengan ${expenses.length} pengeluaran tercatat, transaksi ini ${outlierRatio.toFixed(1)}x tipikal Anda.`,
        icon: "AlertCircle",
      },
      {
        title: "Transaksi Terbesar Periode Ini",
        message: `"${outlier.name}" (${outlier.category}) senilai ${formatCurrency(outlier.amount)} pada ${outlier.date}.`,
        details: `Kalau ini bukan kebutuhan prioritas, pertimbangkan tunda ke periode berikutnya.`,
        icon: "CalendarCheck",
      },
    ];

    const seed = `outlier_${outlier.id}_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 6: End of Month Projection (Proyeksi Akhir Bulan)
   ============================================================ */
export const endOfMonthProjection: InsightConfig = {
  id: "eom_projection",
  category: "projection",
  sentiment: "neutral",
  basePriority: 60,
  trigger: (d) => d.periodLengthDays >= 3 && d.avgDailyExpense > 0,
  generate: (d) => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysLeft = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const projectedExpense = d.avgDailyExpense * daysLeft;
    const projectedTotalExpense = d.totalExpense + projectedExpense;
    const projectedBalance = d.totalIncome - projectedTotalExpense;

    const variants = [
      {
        title: "Proyeksi Aman",
        message: `Dengan laju belanja ${formatCurrency(d.avgDailyExpense)}/hari, proyeksi sisa saldo akhir bulan: ${formatCurrency(projectedBalance)}.`,
        details: `Hari tersisa: ${daysLeft}. Perkiraan total pengeluaran: ${formatCurrency(projectedTotalExpense)}.`,
        icon: "CalendarCheck",
      },
      {
        title: "Proyeksi Peringatan",
        message: `Laju belanja ${formatCurrency(d.avgDailyExpense)}/hari berisiko membuat sisa saldo menipis di akhir bulan.`,
        details: `Proyeksi sisa saldo: ${formatCurrency(projectedBalance)}. Coba kendalikan harian.`,
        icon: "AlertTriangle",
      },
      {
        title: "Target Akhir Bulan",
        message: `${daysLeft} hari lagi, proyeksi tersisa ${formatCurrency(projectedBalance)} dari pemasukan ${formatCurrency(d.totalIncome)}.`,
        details: `Perkiraan total pengeluaran bulan berjalan: ${formatCurrency(projectedTotalExpense)}.`,
        icon: "Target",
      },
      {
        title: "Laju Harian Perlu Diatur",
        message: `Rata-rata belanja ${formatCurrency(d.avgDailyExpense)}/hari; turunkan sedikit agar proyeksi tetap aman.`,
        details: `Selisih proyeksi vs pemasukan: ${formatCurrency(projectedBalance)} dengan ${daysLeft} hari tersisa.`,
        icon: "TrendingDown",
      },
    ];

    let sentiment: "positive" | "neutral" | "warning" | "critical" = "neutral";
    if (projectedBalance > d.totalIncome * 0.2) sentiment = "positive";
    else if (projectedBalance > 0) sentiment = "neutral";
    else sentiment = "warning";

    const seed = `eom_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, sentiment, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 7: Recurring Expenses (Pengeluaran Berulang)
   ============================================================ */
export const recurringExpenses: InsightConfig = {
  id: "recurring_expenses",
  category: "spending",
  sentiment: "neutral",
  basePriority: 55,
  trigger: (d) => d.totalTransactions >= GLOBAL_CONFIG.thresholds.lowDataThreshold && d.totalIncome > 0,
  generate: (d) => {
    const catFrequency = new Map<string, { count: number; total: number }>();
    d.filteredTransactions.filter((t) => t.isExpense).forEach((t) => {
      const key = t.category;
      if (!catFrequency.has(key)) catFrequency.set(key, { count: 0, total: 0 });
      const v = catFrequency.get(key)!;
      v.count++;
      v.total += t.amount;
    });

    const recurringCandidates = Array.from(catFrequency.entries())
      .filter(([, v]) => v.count >= 3)
      .map(([cat, v]) => ({
        cat,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);

    if (recurringCandidates.length === 0) {
      return {
        title: "Belum Ada Pola Rutin",
        message: "Belum ada kategori dengan transaksi berulang yang dominan.",
        details: "Catat rutin transaksi harian untuk deteksi otomatis.",
        icon: "RefreshCw",
        sentiment: "neutral" as const,
        displayProps: { variantIndex: 0 },
      };
    }

    const topRecurring = recurringCandidates[0];
    const totalRecurring = recurringCandidates.reduce((s, c) => s + c.total, 0);
    const shareOfIncome = d.totalIncome > 0 ? (totalRecurring / d.totalIncome) * 100 : 0;

    const avgPerOccurrence = topRecurring.count > 0 ? topRecurring.total / topRecurring.count : 0;

    const variants = [
      {
        title: `Tagihan Rutin: ${topRecurring.cat}`,
        message: `Kategori ${topRecurring.cat} tercatat ${topRecurring.count}x dengan total ${formatCurrency(topRecurring.total)} (${shareOfIncome.toFixed(0)}% pemasukan).`,
        details: `Total beban rutin seluruh kategori: ${formatCurrency(totalRecurring)}.`,
        icon: "CreditCard",
      },
      {
        title: "Pola Rutin Terdeteksi",
        message: `${topRecurring.cat} muncul ${topRecurring.count} kali — total ${formatCurrency(topRecurring.total)} pada periode ini.`,
        details: `Rata-rata per kemunculan ${formatCurrency(avgPerOccurrence)}.`,
        icon: "RefreshCw",
      },
      {
        title: "Beban Berulang",
        message: `Seluruh kategori berulang membebani ${formatCurrency(totalRecurring)} atau ${shareOfIncome.toFixed(0)}% pemasukan.`,
        details: `Kategori rutin terbesar: ${topRecurring.cat} (${formatCurrency(topRecurring.total)}).`,
        icon: "Receipt",
      },
      {
        title: `Kebiasaan ${topRecurring.cat}`,
        message: `${topRecurring.cat} rata-rata ${formatCurrency(avgPerOccurrence)} tiap kali muncul, ${topRecurring.count} kemunculan.`,
        details: `Cek pos ini masih wajar atau perlu dinegosiasi/dikurangi.`,
        icon: "BarChart2",
      },
    ];

    const seed = `recurring_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 8: Spending Habits (Weekend vs Weekday)
   ============================================================ */
export const spendingHabits: InsightConfig = {
  id: "spending_habits",
  category: "spending",
  sentiment: "neutral",
  basePriority: 50,
  trigger: (d) => d.periodLengthDays >= 7 && d.totalTransactions >= GLOBAL_CONFIG.thresholds.lowDataThreshold,
  generate: (d) => {
    let weekdayExpense = 0;
    let weekendExpense = 0;

    d.filteredTransactions.filter((t) => t.isExpense).forEach((t) => {
      const date = parseDateStr(t.date);
      const day = date.getDay();
      if (day === 0 || day === 6) {
        weekendExpense += t.amount;
      } else {
        weekdayExpense += t.amount;
      }
    });

    const weekdaysInPeriod = Math.max(1, d.periodLengthDays - Math.floor(d.periodLengthDays / 7) * 2);
    const weekendsInPeriod = Math.max(1, Math.floor(d.periodLengthDays / 7) * 2);
    const avgWeekday = weekdayExpense / weekdaysInPeriod;
    const avgWeekend = weekendExpense / weekendsInPeriod;

    const diff = avgWeekend - avgWeekday;
    const richer = diff >= 0 ? "akhir pekan" : "hari kerja";

    const variants = [
      {
        title: "Pola Belanja Harian",
        message: `Rata-rata belanja weekend: ${formatCurrency(avgWeekend)}/hari vs hari kerja: ${formatCurrency(avgWeekday)}/hari.`,
        details: `Bandingkan konsumsi gaya hidup di akhir pekan dengan kebutuhan di hari kerja.`,
        icon: "BarChart2",
      },
      {
        title: "Selisih Akhir Pekan vs Hari Kerja",
        message: `${richer.charAt(0).toUpperCase() + richer.slice(1)} lebih boros ${formatCurrency(Math.abs(diff))} per hari.`,
        details: `Akhir pekan ${formatCurrency(avgWeekend)}/hari, hari kerja ${formatCurrency(avgWeekday)}/hari.`,
        icon: "CalendarCheck",
      },
      {
        title: "Kapan Dompet Paling Terkuras",
        message: `Belanja per hari lebih tinggi di ${richer} (${formatCurrency(diff >= 0 ? avgWeekend : avgWeekday)} vs ${formatCurrency(diff >= 0 ? avgWeekday : avgWeekend)}).`,
        details: `Selisih harian ${formatCurrency(Math.abs(diff))} terakumulasi bisa cukup besar dalam sebulan.`,
        icon: "Zap",
      },
      {
        title: "Ritme Belanja Anda",
        message: `Hari kerja total ${formatCurrency(weekdayExpense)}, akhir pekan ${formatCurrency(weekendExpense)} dalam ${d.periodLengthDays} hari.`,
        details: `Rata-rata: ${formatCurrency(avgWeekday)}/hari kerja dan ${formatCurrency(avgWeekend)}/akhir pekan.`,
        icon: "PieChart",
      },
    ];

    const seed = `habits_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return { ...item, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 9: Data Quality (Kualitas Data)
   ============================================================ */
export const dataQuality: InsightConfig = {
  id: "data_quality",
  category: "data_quality",
  sentiment: "neutral",
  basePriority: 40,
  trigger: (d) => d.totalTransactions < GLOBAL_CONFIG.thresholds.lowDataThreshold * 2,
  generate: (d) => {
    const variants = [
      {
        title: "Lengkapi Catatan",
        message: `Baru ada ${d.totalTransactions} transaksi tercatat pada periode ini.`,
        details: `Tambahkan lebih banyak transaksi agar analisis wawasan keuangan makin akurat.`,
        icon: "PlusCircle",
      },
      {
        title: "Catatan Masih Tipis",
        message: `${d.totalTransactions} transaksi pada ${d.periodLengthDays} hari belum cukup untuk analisis mendalam.`,
        details: `Perbandingan periode, proyeksi, dan deteksi anomali butuh lebih banyak data.`,
        icon: "Info",
      },
      {
        title: "Biar Wawasan Makin Tajam",
        message: `Catat setiap pengeluaran agar insight otomatis makin akurat untuk Anda.`,
        details: `Sekarang ${d.totalTransactions} transaksi; idealnya tiap belanja langsung dicatat.`,
        icon: "Sparkles",
      },
      {
        title: "Mulai Catat Hari Ini",
        message: `${d.totalTransactions} transaksi tercatat — tambah satu pengeluaran untuk memperkaya data.`,
        details: `Semakin lengkap datanya, semakin spesifik saran yang muncul di halaman ini.`,
        icon: "Search",
      },
    ];

    const seed = `data_quality_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);

    return {
      ...item,
      displayProps: { variantIndex: index },
      actionLabel: "Tambah Transaksi",
      actionHref: "/transaksi",
    };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 10: Positive Achievement (Pencapaian Positif)
   ============================================================ */
export const positiveAchievement: InsightConfig = {
  id: "positive_achievement",
  category: "positive",
  sentiment: "positive",
  basePriority: 45,
  trigger: (d) => {
    if (d.totalTransactions < GLOBAL_CONFIG.thresholds.lowDataThreshold) return false;
    const savingsRate = d.totalIncome > 0 ? d.netBalance / d.totalIncome : 0;
    const expenseDown =
      d.prevPeriod !== null && d.prevPeriod.expense > 0 && d.totalExpense < d.prevPeriod.expense;
    return savingsRate >= 0.2 || expenseDown;
  },
  generate: (d) => {
    const savingsRate = d.totalIncome > 0 ? Math.round((d.netBalance / d.totalIncome) * 100) : 0;
    const expenseDown =
      d.prevPeriod !== null && d.prevPeriod.expense > 0 && d.totalExpense < d.prevPeriod.expense;
    const savedVsPrev = d.prevPeriod ? d.prevPeriod.expense - d.totalExpense : 0;

    const variants = [
      {
        title: "Menabung Dengan Baik 🎉",
        message: `${savingsRate}% pemasukan berhasil Anda sisihkan, total ${formatCurrency(Math.max(0, d.netBalance))}.`,
        details: `Angka ini dihitung dari selisih pemasukan dan pengeluaran pada rentang filter aktif.`,
        icon: "PiggyBank",
      },
      {
        title: "Lebih Hemat Dari Periode Lalu",
        message: `Pengeluaran turun ${formatCurrency(Math.abs(savedVsPrev))} dibanding periode sebelumnya (${formatCurrency(d.totalExpense)} vs ${formatCurrency(d.prevPeriod?.expense ?? 0)}).`,
        details: `Pertahankan pola ini. Pertimbangkan memindahkan selisihnya ke tabungan otomatis.`,
        icon: "TrendingDown",
      },
      {
        title: "Arus Kas Positif",
        message: `Pemasukan lebih besar ${formatCurrency(d.netBalance)} daripada pengeluaran pada periode ini.`,
        details: `Saldo positif memberi ruang aman untuk dana darurat atau peluang menabung tambahan.`,
        icon: "CheckCircle",
      },
      {
        title: "Kendali Pengeluaran Terjaga",
        message: `Dari ${d.totalTransactions} transaksi, total pengeluaran hanya ${formatCurrency(d.totalExpense)} dengan sisa ${formatCurrency(d.netBalance)}.`,
        details: `Bandingkan tiap minggu agar tetap pada jalurnya.`,
        icon: "Target",
      },
    ];

    const seed = `positive_${d.startDate.toISOString().slice(0, 10)}_${d.endDate.toISOString().slice(0, 10)}`;
    // Bila pengeluaran benar-benar turun vs periode lalu, versi itu didahulukan
    const source = expenseDown ? [variants[1], variants[0], variants[2], variants[3]] : variants;
    const { item, index } = pickVariant(source, seed);

    return { ...item, displayProps: { variantIndex: index } };
  },
  messageVariants: [],
};

/* ============================================================
   INSIGHT 11: Budget Health (Kesehatan Anggaran)
   ============================================================ */
export const budgetHealth: InsightConfig = {
  id: "budget_health",
  category: "spending",
  sentiment: "warning",
  basePriority: 85,
  trigger: (d) => {
    if (!d.budgets || d.budgets.length === 0) return false;
    const periodStr = d.startDate.toISOString().slice(0, 7);
    const active = d.budgets.filter((b) => b.period === periodStr && b.amount > 0);
    if (active.length === 0) return false;
    return active.some((b) => {
      const spent = b.category === "__total__"
        ? d.totalExpense
        : d.expenseByCat.get(b.category) || 0;
      return (spent / b.amount) >= 0.8;
    });
  },
  generate: (d) => {
    const periodStr = d.startDate.toISOString().slice(0, 7);
    const active = d.budgets?.filter((b) => b.period === periodStr && b.amount > 0) || [];
    const crossed = active.find((b) => {
      const spent = b.category === "__total__"
        ? d.totalExpense
        : d.expenseByCat.get(b.category) || 0;
      return (spent / b.amount) >= 0.8;
    }) || active[0];

    const spent = crossed.category === "__total__"
      ? d.totalExpense
      : d.expenseByCat.get(crossed.category) || 0;
    const pct = Math.round((spent / crossed.amount) * 100);
    const name = crossed.category === "__total__" ? "Total" : crossed.category;

    const variants = [
      {
        title: `Anggaran ${name} Rawan`,
        message: `Pengeluaran ${name} sudah mencapai ${pct}% dari batas ${formatCurrency(crossed.amount)}.`,
        details: `Terpakai ${formatCurrency(spent)} dari limit bulanan.`,
        icon: "AlertTriangle",
      },
      {
        title: `Peringatan Budget ${name}`,
        message: `Anda memakai ${pct}% dari limit ${name} (${formatCurrency(spent)} dari ${formatCurrency(crossed.amount)}).`,
        details: `Kurangi belanja di kategori ini untuk sisa periode.`,
        icon: "Shield",
      },
    ];

    const seed = `budget_health_${name}_${d.startDate.toISOString().slice(0, 10)}`;
    const { item, index } = pickVariant(variants, seed);
    const sentiment = pct >= 100 ? "critical" : "warning";

    return { ...item, sentiment, displayProps: { variantIndex: index }, actionLabel: "Kelola Budget", actionHref: "/budgets" };
  },
  messageVariants: [],
};

export const ALL_INSIGHTS: InsightConfig[] = [
  cashFlowHealth,
  topExpenseDominance,
  periodComparison,
  unusualSpike,
  outlierTransaction,
  endOfMonthProjection,
  recurringExpenses,
  spendingHabits,
  dataQuality,
  positiveAchievement,
  budgetHealth,
];
