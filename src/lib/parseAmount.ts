// src/lib/parseAmount.ts
export function parseRupiahAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/Rp\s*/gi, "")
    .replace(/\./g, "")
    .trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const num = parseInt(cleaned, 10);
  return num > 0 ? num : null;
}