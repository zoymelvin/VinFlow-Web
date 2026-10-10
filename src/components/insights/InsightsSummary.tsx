"use client";

import { formatCurrency } from "@/lib/insights/utils";
import { InsightData } from "@/lib/insights/types";

type InsightsSummaryProps = {
  data: InsightData;
};

export default function InsightsSummary({ data }: InsightsSummaryProps) {
  const topCat = data.topExpenseCategory.amount > 0 ? data.topExpenseCategory.name : "—";
  const totalExp = data.totalExpense;
  const ratio = data.totalIncome > 0 ? Math.round((totalExp / data.totalIncome) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
      <div className="text-center">
        <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Top</p>
        <p className="text-xs font-bold text-white mt-0.5 truncate">{topCat}</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Total</p>
        <p className="text-xs font-bold text-red-400 mt-0.5 truncate font-numeric">
          {formatCurrency(totalExp)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Ratio</p>
        <p className="text-xs font-bold text-white mt-0.5 font-numeric">
          {ratio}%
        </p>
      </div>
    </div>
  );
}
