import {
  Coffee, Zap, ShoppingBag, Home, Receipt, Smartphone, LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export type CategoryDef = {
  /** Stable ID. Matches `transaction.category` values (English labels). */
  id: string;
  label: string;
  icon: LucideIcon;
};

/** Expense categories that can hold a budget. IDs are the English labels
 *  stored on transactions, so matching is by ID, not by free text. */
export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: "Food", label: "Food", icon: Coffee },
  { id: "Transport", label: "Transport", icon: Zap },
  { id: "Shopping", label: "Shopping", icon: ShoppingBag },
  { id: "Rent", label: "Rent", icon: Home },
  { id: "Hobby", label: "Hobby", icon: Receipt },
  { id: "Data Plan", label: "Data Plan", icon: Smartphone },
  { id: "Other", label: "Other", icon: LayoutGrid },
];

export function categoryLabel(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function categoryIcon(id: string): LucideIcon {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.icon ?? LayoutGrid;
}
