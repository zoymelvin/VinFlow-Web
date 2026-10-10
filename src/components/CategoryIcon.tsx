"use client";

import {
  Building, Smartphone, Wallet, Coins, LayoutGrid,
  Coffee, ShoppingBag, Zap, Receipt, Home,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Peta kategori → ikon, dipakai konsisten di Home, Riwayat, dan detail.
 *  Termasuk alias Indonesia lawas (data lama di localStorage sebelum
 *  daftar kategori diseragamkan ke Inggris) agar ikon tetap bermakna. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Food: Coffee,
  Transport: Zap,
  Shopping: ShoppingBag,
  Belanja: ShoppingBag,
  Rent: Home,
  Kost: Home,
  Hobby: Receipt,
  Hobi: Receipt,
  "Data Plan": Zap,
  Salary: Building,
  Gaji: Building,
  Other: LayoutGrid,
  Lainnya: LayoutGrid,
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? LayoutGrid;
}

export const POCKET_ICONS: Record<string, LucideIcon> = {
  Building, Smartphone, Wallet, Coins, LayoutGrid,
  Coffee, ShoppingBag, Zap, Receipt, Home,
};

interface Props {
  category: string;
  size?: "sm" | "md";
}

/** Lencana ikon kategori — satu sumber tampilan untuk item transaksi. */
export default function CategoryIcon({ category, size = "md" }: Props) {
  const Icon = categoryIcon(category);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0",
        size === "md" ? "w-10 h-10" : "w-8 h-8 rounded-xl"
      )}
    >
      <Icon className={cn("text-blue-500", size === "md" ? "w-5 h-5" : "w-4 h-4")} />
    </span>
  );
}
