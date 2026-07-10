# WorkLooking — Agent Guide

WorkLooking is an **Electron + TypeScript** desktop app (secure Node.js main process,
React 19 renderer) that helps tailor resumes and manage job applications with an
in-app AI assistant.

This file is the **index and workflow** for coding agents. Read the specific doc for
the task at hand instead of loading everything.

---

## Documentation index — read what you need

| When you are… | Read |
| ------------- | ---- |
| Getting oriented / understanding structure | [`docs/architecture.md`](docs/architecture.md) |
| Adding or changing renderer↔main comms | [`docs/ipc.md`](docs/ipc.md) |
| Working with hooks / state / persistence | [`docs/state.md`](docs/state.md) |
| Building, running, packaging, scripts | [`docs/build.md`](docs/build.md) |
| Writing code (style, naming, security) | [`docs/conventions.md`](docs/conventions.md) |
| Touching the shipped AI assistant / its tools | [`docs/agent.md`](docs/agent.md) |
| Adding or editing a resume theme | [`docs/themes.md`](docs/themes.md) |

> **Two different "agents":** the root `AGENTS.md` (this file) governs *dev workflow*.
> `electron/agent/` is the *product's* shipped assistant — see `docs/agent.md`.

---

## Workflow

1. **Orient.** Skim [`docs/architecture.md`](docs/architecture.md) if unfamiliar with the area.
2. **Plan.** For multi-step work, keep a todo list and do one thing at a time.
3. **Locate the boundary.** Decide which process/layer the change belongs to:
   - Cross-process type/contract → `shared/`
   - Node work (fs, network, AI, PDF) → `electron/main.ts` via an IPC handler
   - UI logic/state → a hook in `src/hooks/`
   - Rendering → a component in `src/components/` or page in `src/pages/`
4. **Implement** following [`docs/conventions.md`](docs/conventions.md). Reuse existing
   patterns (typed IPC, path sanitization, hooks-own-logic).
5. **Verify.** No test runner is wired up. Type-check (`strict`), then `npm run dev`
   and exercise the affected flow. See [`docs/build.md`](docs/build.md).
6. **Commit only when asked.** Match existing commit style; never commit secrets.

### Common task → guide

| Task | Guide |
| ---- | ----- |
| Add an IPC channel | [`docs/ipc.md`](docs/ipc.md) → "Adding a channel" |
| Add a resume theme | [`docs/themes.md`](docs/themes.md) → "Adding a theme" |
| Add an AI agent tool | [`docs/agent.md`](docs/agent.md) → "Adding an agent tool" |
| Add a page + hook | [`docs/state.md`](docs/state.md) + [`docs/conventions.md`](docs/conventions.md) |

---

## Critical always-on rules

1. **Renderer is untrusted.** Never expose Node to the renderer; go through
   `window.api.invoke` → typed IPC handler. Validate/sanitize every input in `main.ts`.
2. **`shared/ipc.ts` is the single source of truth** for channels and their
   request/response types. Change it in one place.
3. **No `any`.** `strict: true` everywhere — use `unknown` + type guards.
4. **Hooks own logic, components render.** Don't put business logic in components.
5. **Keep security config intact:** `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`.
6. **Product text is French.** UI copy and `electron/agent/` content are French — match
   the surrounding language. Code identifiers and these dev docs stay English.
7. **Don't leak PII into the LLM prompt** — see `docs/agent.md`.
8. **Docs must match code — always.** If you find any dissonance between the code and
   the documentation (`docs/*.md`, this file, or `.opencode/skill/**`), you **MUST** fix
   the documentation in the same change. See "Documentation is a contract" below.

---

## Documentation is a contract

The `docs/` files, this `AGENTS.md`, and the skills in `.opencode/skill/**` describe how
the code actually works. Treat any mismatch as a defect.

**Hard rules:**

- **Whenever you touch code that a doc describes, update that doc in the same change.**
  Adding an IPC channel → update `docs/ipc.md`; adding an agent tool → update
  `docs/agent.md` (incl. the tool table); adding a theme → the theme list in
  `docs/themes.md`; changing scripts/build → `docs/build.md`; new hook/persistence →
  `docs/state.md`.
- **If you discover an existing dissonance** (doc says X, code does Y) while working —
  even if unrelated to your task — **correct the doc to match the code** before finishing.
  Code is the source of truth; the doc bends to it (unless the code is clearly a bug, in
  which case flag it).
- **Never leave a doc knowingly stale.** No "TODO: update docs later". Do it now.
- **Verify, don't guess.** Base doc claims on the actual source (read `main.ts`,
  `shared/ipc.ts`, `electron/agent/*`, `electron/themes/*`), not on assumptions.

This keeps the router/skills trustworthy for the next agent.
