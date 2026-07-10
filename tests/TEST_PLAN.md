# WorkLooking — Test Plan

This is the **to-do list for the test suite**. The infrastructure is already
scaffolded and working (three smoke tests were validated then removed). Each
section below has a matching **skeleton test file** with `it.todo(...)` stubs.
Implementing agents replace the `it.todo` stubs with real `it(...)` tests, fix
the commented-out imports, and delete this note as they go.

> **Golden rule:** a test file is "done" when it has **no `it.todo` left**, all
> its tests pass under `npm test`, and any code it forced you to refactor
> (e.g. exporting a function) is reflected in the relevant `docs/*.md`.

> **Working rule (one test at a time):** implement and land tests **one `it(...)`
> at a time**. After writing a single test, run it, confirm it passes, and
> **pause for the human to review** that the assertion matches the intended
> behavior before moving to the next stub. Do **not** batch-convert a whole file
> of `it.todo` in one go — the reviewer needs to sign off that each test is
> legit for what they have in mind.

---

## How the suite is wired (already done)

- **Runner:** [Vitest](https://vitest.dev) (shares Vite's resolution, so `@`
  alias, `.css?raw` and the custom `.hbs`/`.md` raw-loader all work in tests).
- **Config:** `vitest.config.ts` defines **two projects**:
  - **`node`** — `environment: "node"`; globs `electron/**` + `shared/**`
    (`*.test.ts` / `*.spec.ts`) and `tests/node/**`.
  - **`renderer`** — `environment: "jsdom"`; globs `src/**` (`*.test.ts(x)`)
    and `tests/renderer/**`; loads `tests/setup.renderer.ts`
    (jest-dom matchers + cleanup + localStorage reset).
- **Scripts (`package.json`):**
  | Script | Command |
  | ------ | ------- |
  | `npm test` | `vitest run` (both projects, one-shot) |
  | `npm run test:watch` | `vitest` (watch mode) |
  | `npm run test:ui` | `vitest --ui` |
  | `npm run test:node` | `vitest run --project node` |
  | `npm run test:renderer` | `vitest run --project renderer` |
  | `npm run typecheck` | `tsc --noEmit` (renderer) + electron tsconfig |
- **Fixtures:** `tests/fixtures/` (see its README; add sample PDF/PNG for Tier 4).
- **Renderer IPC mock helper:** `tests/renderer/mockWindowApi.ts` — installs a
  typed mock `window.api` (`invoke`/`on`/`once` as `vi.fn()`). `on` defaults to a
  no-op unsubscribe; override with `on.mockImplementation((channel, cb) => …)` to
  capture listeners and drive `CHAT_UPDATE`/`TOOL_STATUS` events (see
  `useChat.test.ts`).

### Conventions

- Co-locate unit tests next to source as `<name>.test.ts(x)`.
- Put cross-cutting/integration tests under `tests/node/` or `tests/renderer/`.
- No `any` in tests either (`strict: true`); prefer real types + `unknown` guards.
- Prefer **pure-function** tests; only reach for mocks when I/O is unavoidable.
- For debounced/timer logic use `vi.useFakeTimers()`.
- Product text is French — assert French copy where relevant (e.g. tool
  descriptions, PII rule), but keep test names/identifiers in English.

---

## Tier 1 — Pure functions (no/minimal mocking) — **do first**

| Target | Skeleton file | Refactor needed? |
| ------ | ------------- | ---------------- |
| `validateAndSanitizePath`, `detectsAuthRequired` | `electron/main.test.ts` | **Yes** — not exported. Extract to `electron/lib/*.ts` (preferred) or add `export`. Update `docs/architecture.md`. |
| `normalizeAnthropicBaseURL`, `isAzureEndpoint` | `electron/agent/aiClient.test.ts` | `isAzureEndpoint` not exported — export it. |
| `GenerateSystemPrompt` (PII stripping) | `electron/agent/prompt.test.ts` | No. **Security-critical — see AGENTS.md #7.** |
| Handlebars helpers + `renderTheme` | `electron/themes/shared/render.test.ts` | No. |
| `getPresetById`, `PROVIDER_PRESETS` | `shared/provider-types.test.ts` | No. |
| `cn` | `src/lib/utils.test.ts` | No. |

## Tier 2 — Pure-ish with light setup

| Target | Skeleton file |
| ------ | ------------- |
| `AiClientRouter.resolve`, `AnthropicProvider` tool mapping | `electron/agent/aiClient.test.ts` |
| Theme registry parity (9 themes, default = `modern-sidebar`) | `electron/themes/shared/render.test.ts` |
| tools.ts ↔ `executeTool` name parity | `electron/agent/tools.test.ts` |

## Tier 3 — Renderer hooks (jsdom + @testing-library/react)

Use `renderHook` + `act`. Mock `window.api` via `tests/renderer/mockWindowApi.ts`.
Use fake timers for autosave/debounce.

| Hook | Skeleton file |
| ---- | ------------- |
| `useResume` | `src/hooks/useResume.test.ts` |
| `useCandidatureConfig` | `src/hooks/useCandidatureConfig.test.ts` |
| `useSettings` | `src/hooks/useSettings.test.ts` |
| `useTemplateSelection` | `src/hooks/useTemplateSelection.test.ts` |
| `useChat` | `src/hooks/useChat.test.ts` |
| `useOnboarding` | `src/hooks/useOnboarding.test.ts` |
| `useDebounce` | `src/lib/useDebounce.test.ts` |

> Optional: component render tests (React Testing Library) for
> `ErrorBoundary`, resume/candidature editor sections. Add under
> `tests/renderer/` when the hooks above are green.

## Tier 4 — Integration (mock Electron/fs/network; real temp dir + fixtures)

| Target | Skeleton file | Notes |
| ------ | ------------- | ----- |
| IPC handlers: FILE_READ/WRITE, RESUME_RENDER_PREVIEW, APP_SET_USER_DATA_PATH; `readPdf`; `executeTool` | `electron/main.integration.test.ts` | `vi.mock("electron", …)`; capture `ipcMain.handle` callbacks; real `fs.mkdtemp` temp dir. |
| `processImage` | `electron/utils/image-processor.test.ts` | Needs `tests/fixtures/sample.png` + `not-an-image.txt`. |
| Provider `runChat` loops | `electron/agent/aiClient.test.ts` | Mock the OpenAI/Anthropic SDK clients. |

> `generatePdf` and `fetchUrl` need a real Electron `BrowserWindow` and are
> **out of scope for unit/integration**; cover their pure cores
> (`detectsAuthRequired`) instead, or add an e2e harness later (Playwright +
> Electron) if desired — track as a follow-up, not part of this plan.

---

## Definition of done for the whole suite

1. No `it.todo` remain in any `*.test.ts(x)`.
2. `npm test` is green (both projects).
3. `npm run typecheck` is clean.
4. Any code change made to enable testing (exports, extracted modules) is
   documented in the matching `docs/*.md` (AGENTS.md "Documentation is a contract").
5. `docs/build.md` "Verification" section reflects the real workflow (already updated).

## Refactors made to enable testing

Keep this list in sync and reflect each in the relevant `docs/*.md`:

- `electron/agent/aiClient.ts` — exported `isAzureEndpoint` (was module-private)
  and extracted the OpenAI→Anthropic tool mapping into an exported pure
  `toAnthropicTools(tools)` (the `AnthropicProvider` now calls it). Update
  `docs/agent.md` public-surface notes.
- (Earlier) `electron/lib/paths.ts` + `electron/lib/auth-detect.ts` — extracted
  `validateAndSanitizePath`/`IPCError` and `detectsAuthRequired` from `main.ts`.
- `tests/renderer/mockWindowApi.ts` — fleshed out from the original stub into a
  typed `window.api` mock (no source change; test infra only). Tier 3 hooks
  required no source refactors.
- **Tier 4 required no source refactors.** `main.ts` exports nothing and runs
  its handler registration as top-level side effects, so the integration test
  imports it under a mocked `electron` (capturing `ipcMain.handle` callbacks)
  plus mocked `electron-squirrel-startup` / `update-electron-app` and stubbed
  Forge/Vite globals. The internal `executeTool` + `readPdf` are exercised
  through the real `AI_CHAT` handler by mocking
  `AiClientRouter.getInstance().runChat` to invoke the `runTool` callback — no
  new exports needed. Provider `runChat` loops are tested via the router with
  the `openai` / `@anthropic-ai/sdk` constructors mocked.

## Notes / observations from Tier 3

- `useResume` and `useCandidatureConfig` autosave effects list `isDirty` in their
  dependency arrays (`useResume.ts:89`, `useCandidatureConfig.ts:87`), so the save
  fires on the render after a mutation rather than strictly after the
  `useDebounce(…, 1500)` window. Tests assert this real (effectively immediate)
  behavior. Flagged as a potential defect, not fixed here.
- `useResume` persists only to `localStorage` (no IPC), despite the original stub
  mentioning IPC. Tests match the code.

## Notes / observations from Tier 4

- `validateAndSanitizePath` treats **absolute** paths as trusted (OS-dialog
  callers), so directory-traversal rejection only applies to *relative* paths
  that climb out of the base. The FILE_WRITE traversal test asserts the
  relative-path case (`INVALID_PATH`) accordingly.
- New checked-in fixtures: `tests/fixtures/sample.pdf` (contains
  `WorkLooking sample PDF fixture`), `sample.png` (400×300, forces a resize),
  `not-an-image.txt`. See `tests/fixtures/README.md`.
- `readPdf` and `executeTool` are not exported; they're covered end-to-end
  through the `AI_CHAT` IPC handler (mocked router `runChat` drives `runTool`).

## Progress checklist

- [x] Tier 1 — main.ts pure fns
- [x] Tier 1 — aiClient normalize/azure
- [x] Tier 1 — prompt PII stripping
- [x] Tier 1 — themes helpers + renderTheme
- [x] Tier 1 — provider-types
- [x] Tier 1 — cn
- [x] Tier 2 — AiClientRouter (singleton) / tool mapping
- [x] Tier 2 — theme registry parity
- [x] Tier 2 — tools ↔ executeTool parity
- [x] Tier 2/4 — AiClientRouter.resolve provider selection (covered by Tier 4 runChat w/ mocked SDK)
- [x] Tier 3 — useResume
- [x] Tier 3 — useCandidatureConfig
- [x] Tier 3 — useSettings
- [x] Tier 3 — useTemplateSelection
- [x] Tier 3 — useChat
- [x] Tier 3 — useOnboarding
- [x] Tier 3 — useDebounce
- [x] Tier 4 — main.ts integration (IPC/fs/pdf/executeTool)
- [x] Tier 4 — image-processor
- [x] Tier 4 — provider runChat loops
