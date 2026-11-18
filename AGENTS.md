# AGENTS.md

Guidance for AI coding sessions. Team workflow and file ownership live in `CONTRIBUTING.md`; setup and product docs in `README.md`. Both are in Vietnamese.

## What this repo is

- Course project (CO3001, Group 17). Two independent npm projects plus a root `package.json` with shared scripts:
  - `server/` – Express 5 + SQLite (better-sqlite3) + Drizzle ORM, TypeScript run with `tsx`. Login uses `express-session` (cookie) + `bcryptjs`.
  - `client/` – React 18 + Vite + Tailwind + React Router, mobile UI for students and desktop UI for operators.
- There is no shared package. Status values live in `server/src/constants.ts`; the client keeps its own copies in `client/src/types.ts` and `client/src/statusLabels.ts`. Change both sides together.
- Work is split by use case; files start with `// Owner: <name> – <UC>`. When asked to implement a UC, fill its existing stubs rather than creating parallel routes/services.
- Class, method and parameter names follow the Submission #3 class diagram exactly (`.drawio` files under `docs/`; differences listed in `docs/submission-3/ANH_XA_CLASS_DIAGRAM_CODE.md`). Do not rename methods or change their parameters. Diagram-private (`-`) methods are module-level `function`s at the end of each Service file. `OperationalRepository` is one class in the design, split across `server/src/repositories/operational/*.ts` and merged in `OperationalRepository.ts`.
- Datatypes from the diagram live in `server/src/types/dto.ts` (Date for DateTime) and are copied to `client/src/types.ts` (ISO string for DateTime). Client API functions in `client/src/api/<name>.ts` have the same names and parameters as the Controller methods.
- The repo is still mostly the initial scaffold: auth, theme, Hub status and the vehicle simulator work. Nearly every UC service/repository method throws `notImplemented()` and returns HTTP 501.

## Setup and commands

Requires Node.js >= 20.19. Run commands from the repo root.

```bash
npm install        # root postinstall runs npm install in server/ and client/; creates server/.env
npm run db:reset   # delete dev DB, push schema, seed
npm run dev        # server :3000 + Vite :5173
npm run typecheck  # server then client
```

- Demo logins: `operator@hub.local` / `operator123`, `student1@hub.local` / `student123`.
- `server/.env` and `DATABASE_URL=./data/dev.db` are relative to `server/`. Use the npm scripts instead of running `tsx` from the root.
- Vite proxies `/api` to port 3000, so the session cookie works. Client code uses relative `/api` URLs.
- There are no automated tests in this phase (Submission 3 only needs test-case design). Verification is `npm run typecheck` plus running the app.

## Conventions

- Layers: `routes/` (URL, `requireAuth`/`requireRole`, `validateBody`) → `controllers/` (read req, `currentUser(req)`, `sendOk`) → `services/` (business rules) → `repositories/` (Drizzle queries on `db`). Reference flow: `GET /api/hubs`.
- Writes that must not double-book (reserve vehicle, hold slot, book charger) go inside `db.transaction(() => { ... })` and re-check state inside it. SQLite has one connection, so repositories just use `db`; the callback must be synchronous. Call `vehicleSimulator.requestUnlock/sendLockCommand` outside the transaction.
- Never take `studentId`/`operatorId` from the request body; use `currentUser(req)`.
- Write operations take a client-generated `requestId`. A repeated `requestId` returns the earlier result (`findProcessedRequest`); a new one writes a `processed_requests` row (operation from `REQUEST_OPERATIONS`) in the same transaction.
- Errors: `throw new AppError("CONFLICT", "...")` (codes in `server/src/lib/errors.ts`); the error handler returns `{ ok: false, error: { code, message } }`. Success responses are `{ ok: true, data }`.
- Business numbers (hold minutes, battery thresholds) come from `server/src/config/systemConfig.ts`.
- Live pages refresh by polling: `useAsync(fn, [], { refreshEveryMs: 3000 })`. There is no WebSocket.
- Keep TypeScript simple: interfaces for data and typed parameters; avoid advanced generics.
- Schema changes: edit `server/src/db/schema.ts`, then `npm run db:push --prefix server` or `npm run db:reset`.
