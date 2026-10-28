/**
 * Node test harness shim: zustand persist's default storage reads
 * `window.localStorage`, which is undefined under Node — without it the
 * persist middleware skips installing its API entirely. Must be the FIRST
 * import of a test file (CommonJS require order is preserved).
 */
const mem = new Map<string, string>();

(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
};

/** Backing map of the shimmed localStorage, for persistence assertions. */
export function storageEntries(): Map<string, string> {
  return mem;
}
