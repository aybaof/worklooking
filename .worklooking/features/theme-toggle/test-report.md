# Test report: App UI theme toggle (light / dark / system)

- **Slug:** theme-toggle
- **Status:** tested
- **Verify commands run:**
  - `npm run typecheck` (`tsc --noEmit && tsc --noEmit -p electron/tsconfig.json`)
  - `npm test` (`vitest run` — both `node` + `renderer` projects)
  - `npm run test:renderer` (`vitest run --project renderer`) — feature fast loop

## Result

- **typecheck:** pass (both processes, `strict: true`, no `any`)
- **tests:** pass — **18 files, 149 tests** (was 141 before this stage)
  - `node` project: pass (all node/shared/electron tiers unchanged)
  - `renderer` project: pass — includes the feature's own files, which run in the
    jsdom renderer project as expected:
    - `src/hooks/useTheme.test.ts` — **17 tests** (was 11)
    - `src/components/ThemeToggle.test.tsx` — **5 tests** (was 3)

## Tests added/changed

Renderer project (jsdom), following `useTemplateSelection.test.ts` conventions
(plain assertions, no jest-dom-specific matchers).

`src/hooks/useTheme.test.ts`:
- Added "persists each of the three literal modes verbatim under the one key" —
  strengthens AC4 (all three literals, `Object.keys(localStorage) === ["worklooking_theme"]`).
- Added "re-enters system mode and resumes following the OS after a manual override" —
  AC5/AC6 round-trip.
- Strengthened "reflects live OS changes" to also assert `result.current.resolved` (AC5).
- Split AC13 into two explicit tests: **leaving system mode** removes the listener
  (and the removed listener `toBe` the added one — no leak), and **unmount while in
  system mode** removes the listener (previously `unmount()` was called but not asserted).
- Added "installs no matchMedia listener in a manual mode" (AC6/AC13).
- Added "uses the legacy addListener/removeListener API when addEventListener is absent"
  (AC5/AC13 — the deprecated-listener fallback path).
- Added "does not throw when matchMedia is unavailable" (matchMedia-absence guard).

`src/components/ThemeToggle.test.tsx`:
- Added "renders an icon inside each of the three buttons" — AC8 (asserts an `<svg>`
  lucide icon per button).
- Added "marks Système as pressed for the first-run default mode" — AC1/AC8 (control
  reflects `system` selection).
- Extended pressed/onModeChange tests to cover all three options incl. `Système`.

## Coverage of acceptance criteria

| #    | Criterion | Covered by |
|------|-----------|------------|
| AC1  | Default is System on first run | `useTheme.test.ts` (no-key → `mode==="system"`) + `ThemeToggle.test.tsx` (Système pressed) |
| AC2  | Light appearance = no `.dark` | `useTheme.test.ts` (light mode; system+OS-light) |
| AC3  | Dark appearance = `.dark` present | `useTheme.test.ts` (dark mode; system+OS-dark) |
| AC4  | localStorage key/value contract | `useTheme.test.ts` (all three literals; only `worklooking_theme` key) |
| AC5  | Live OS change in System mode | `useTheme.test.ts` (`emit(true/false)` flips class + `resolved`; legacy-listener test) |
| AC6  | Manual override precedence | `useTheme.test.ts` (manual mode ignores `emit`; installs no listener) |
| AC7  | Persistence across restart | `useTheme.test.ts` (stored `"dark"` read on init applies `.dark`) |
| AC8  | French labels + icons | `ThemeToggle.test.tsx` (Clair/Sombre/Système text + `<svg>` per button) |
| AC9  | Resume iframes unaffected | **Not unit-testable** — see below (manual visual) |
| AC10 | Control only on /settings | **Not unit-testable** — see below (structural + manual) |
| AC11 | TS strict / no-any | **Verified by `npm run typecheck`** (green) |
| AC12 | Invalid stored value → system | `useTheme.test.ts` (`"banana"` → `mode==="system"`, no throw) |
| AC13 | Listener cleanup | `useTheme.test.ts` (removeEventListener on leave + on unmount; removed===added; legacy removeListener; none in manual mode) |
| AC14 | Docs updated | Out of tester scope — `docs/state.md` updated by dev stage (per plan §Implementation notes); verify at review gate |
| AC15 | No flash of wrong theme | **Not unit-testable** — see below (index.html inline script; manual) |

### Not automatable here (how otherwise verified)

- **AC9 (resume preview iframes unaffected):** `.dark` is toggled on
  `document.documentElement`; theme iframes rendered from `electron/themes/*` are
  separate documents that do not inherit the parent class. No automated cross-iframe
  harness exists — verified by manual `npm run dev` toggle + visual check.
- **AC10 (control only on /settings):** enforced structurally (the hook is wired only
  into the `/settings` `ConfigurationPage` in `App.tsx`; header has no toggle) —
  verified by manual visual check; not a meaningful unit assertion.
- **AC11 (TS strict / no-any):** covered by `npm run typecheck` (passes), which
  enforces `strict: true` and the no-`any` rule.
- **AC15 (no flash of wrong theme):** implemented via the render-blocking inline
  `<script>` in `index.html` `<head>`; runs before the module bundle/first paint.
  Not observable in jsdom unit tests — verified manually by launching in each mode.

## Issues found / fixed

- **Test-isolation defect (fixed in test harness, not source):** the new
  "matchMedia unavailable" test exposed that `installMatchMedia` assigns
  `window.matchMedia`, which `vi.restoreAllMocks()` does not remove (jsdom has no
  native `matchMedia`). Without cleanup a later test saw a stale stub returning
  `undefined`, so `prefersDark()` threw `Cannot read properties of undefined
  (reading 'matches')`. Fixed by deleting `window.matchMedia` in the suite's
  `afterEach`, restoring true absence between tests. No source change was required:
  the hook's `prefersDark`/Effect-B guards correctly handle a genuinely absent
  `matchMedia` (confirmed by the passing absence-guard test).

- **No source defects found** in `useTheme.ts` or `ThemeToggle.tsx`. All AC-driven
  assertions passed against the implementation as built; no assertions were weakened.

## Remaining blockers

None. Both `npm run typecheck` and `npm test` are green.
