# Core Stack
- Next.js 14.2 (App Router), React 18, TypeScript strict.
- Tailwind, shadcn/ui, zustand persisted stores.
- Path alias `@/*` → `./src/*`.

# Commands
- `npm run dev` – start dev server.
- `npm run build` – production build.
- `npm run lint` – next lint.
- `npm run typecheck` – `tsc --noEmit`.
- `npm test` – compile `tsconfig.test.json` then run tests in `.tmp-tests/tests` via Node's built‑in runner.
- Full verify: `npm run lint && npm run typecheck && npm test`.

# Architecture & Conventions
- **Data**: No backend. All state in `zustand` + `persist` (LocalStorage).
- **Currency**: Finance uses IDR (no decimals, `src/lib/settings.ts`). Crypto uses USD.
- **UI**: Mobile-first (iPhone ~390px). Use `PageHeader` component. Secondary pages use `isCompact` prop (smaller title/buttons).
- **Hydration**: Client-only components must use `useEffect` + `hasMounted` guard.
- **Dark Mode**: Hardcoded `className="dark"` on `<html>`.

# Gotchas
- Scan API (`src/app/api/scan/route.ts`) requires `GEMINI_API_KEY`.
- Scan API handles model fallback (`PRIMARY_MODEL` -> `FALLBACK_MODEL`) and uses a 12s timeout.
- Testing: `npm test` compiles to `.tmp-tests/` before execution.
- Vercel: No `vercel.json` required for region/runtime.
