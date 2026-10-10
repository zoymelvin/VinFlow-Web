# AGENTS.md

## Stack
- Next.js 14.2 (App Router) + React 18 + TypeScript (strict), Tailwind CSS v3, shadcn-ui.
- State: `zustand` (persist: `vinflow-storage`, `vinflow-settings`). Client-only.
- Backend: `src/app/api/scan/` (requires `GEMINI_API_KEY`).
- Path alias: `@/*` → `./src/*`.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck` → `tsc --noEmit`
- `npm run lint` → `next lint`
- `npm test` → `tsc -p tsconfig.test.json && node --test .tmp-tests/tests`
  - Compile-then-run model. New tests in `tests/*.test.ts` (add to `tsconfig.test.json` if needed).
  - Test files: budget (8), insights (26), receipt (5), riwayat (14), settings (12), transfer (1). Total 66.

## Gotchas
- **Zustand**: Pages MUST use `useEffect` + `hasMounted` state to prevent hydration mismatches.
- **Routes**: `/`, `/pockets`, `/bills`, `/transaksi`, `/riwayat`, `/profile`, `/budgets`, `/goals`, `/notifikasi`, `/scan`.
- **Dark mode**: Forced `className="dark"` on `<html>`.
- **Overlaying**: Use `src/components/overlay.tsx` primitives (Portal, Overlay, etc). Do not hand-roll fixed/z-index.
- **Insights**: Logic in `src/lib/insights/`. `GLOBAL_CONFIG` in `config.ts` holds all hardcoded thresholds.
- **Dev notes**: `src/app/goals/page.tsx.backup` is ignored.

## Verification
- `npm test` (66 pass), then `npm run build`.
- Smoke: `/bills` filter toggle, insight generation, Top/Total/Ratio stats check.
