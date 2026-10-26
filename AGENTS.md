# Core Stack
- Next.js 14.2 (App Router), React 18, TypeScript strict.
- Tailwind, shadcn/ui, zustand persisted stores.
- Path alias `@/*` → `./src/*`.

# Commands
- `npm run dev` (or `yarn dev`, `pnpm dev`, `bun dev`) – start dev server.
- `npm run build` – production build.
- `npm run lint` – next lint.
- `npm run typecheck` – `tsc --noEmit`.
- `npm test` – compile `tsconfig.test.json` then run tests in `.tmp-tests/tests` via Node's built‑in runner.
- Run single test: `node --test path/to/.tmp-tests/tests/<file>.test.js` after compilation.
- Full verify: `npm run lint && npm run typecheck && npm test`.

# Gotchas
- Scan API (`src/app/api/scan/route.ts`) requires `GEMINI_API_KEY`; missing => 500.
- All client‑only effects need `useEffect` + `hasMounted` guard.
- Dark mode enforced via `<html className="dark">`; UI assumes it.
- Order lint → typecheck → test required for CI.
