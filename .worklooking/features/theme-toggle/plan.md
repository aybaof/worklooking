# Implementation plan: App UI theme toggle (light / dark / system)

- **Slug:** theme-toggle
- **Status:** implemented
- **Spec:** ./spec.md
- **Updated:** 2026-07-10

## Approach

A new renderer hook `useTheme` owns all theme logic: the persisted mode
(`"light" | "dark" | "system"`), the localStorage contract under key
`worklooking_theme`, live OS subscription via `matchMedia`, and applying/removing
the `.dark` class on `document.documentElement` (which flips the existing CSS
variable block in `src/styles/globals.css`). `App.tsx` instantiates the hook at
root and threads `mode` + `setMode` into `ConfigurationPage`, mirroring exactly
how `useSettings` props are threaded today. A small presentational component
`ThemeToggle` renders the 3-button segmented control (French copy + lucide icons)
so the page stays a thin consumer and the hooks-own-logic / components-render
boundary is preserved.

**Anti-flash technique (AC15) — chosen: inline `<script>` in `index.html` head.**
An inline, render-blocking script reads `worklooking_theme` from localStorage,
resolves `system` against `matchMedia`, and toggles `.dark` on
`document.documentElement` *before* the module bundle (and React) load. This is the
only option that runs before first paint — doing it in `main.tsx` still leaves a
frame after CSS is parsed but before the module executes. The script duplicates a
tiny amount of resolution logic, but it is trivial (read key → compare to `"dark"`
or resolve system) and has no dependency on the bundle. `useTheme` then re-applies
the same class on mount as the single source of truth going forward, so the two
never diverge (the hook's mount effect is idempotent — it sets the exact class the
script already set).

Rationale for a separate `ThemeToggle` component: the control is self-contained,
has three repeated button definitions, and keeping it out of `configuration.tsx`
avoids bloating an already-large page and keeps the page a pure prop-wirer. It
receives only `mode` + `onModeChange` props — no logic.

## Changes (file-by-file)

### `src/hooks/useTheme.ts` (NEW — see "New files")

### `index.html`
- **What & why:** Add a render-blocking inline `<script>` in `<head>` (before the
  `main.tsx` module script) that resolves and applies the theme class pre-paint
  (AC15). Kept dependency-free and defensive (guards `window.matchMedia` absence,
  wraps localStorage access in try/catch, falls back to no `.dark` = light).
- **Boundary/layer rationale:** Bootstrap concern that must run before the bundle;
  it belongs in the HTML shell, not in a React module. It does not own state — it
  only paints the correct initial appearance; `useTheme` remains the source of
  truth once mounted.

### `src/App.tsx`
- **What & why:** Call `const theme = useTheme();` alongside the existing
  `useSettings()`/`useResume()` calls, then pass `mode={theme.mode}` and
  `setMode={theme.setMode}` into `<ConfigurationPage … />` (extend the existing
  prop list on the `/settings` route). No other route changes.
- **Boundary/layer rationale:** Root is where cross-page hooks are instantiated and
  threaded down, matching the established `useSettings` pattern (AC10 keeps the
  control on `/settings` only — no header wiring is added).

### `src/pages/configuration.tsx`
- **What & why:** Add `mode: ThemeMode` and `setMode: (mode: ThemeMode) => void`
  to the `IConfigurationPage` interface; destructure them; render a new
  "Apparence" `Card` (matching the existing Card structure) containing
  `<ThemeToggle mode={mode} onModeChange={setMode} />`. French section title/desc
  (e.g. "Apparence" / "Choisissez le thème de l'application."). Import `ThemeMode`
  type from `@/hooks/useTheme`.
- **Boundary/layer rationale:** Page consumes the hook's props and renders; it
  holds no theme logic (AC10, hooks-own-logic).

### `src/components/ThemeToggle.tsx` (NEW — see "New files")

### `docs/state.md`
- **What & why:** Docs contract (AC14). Add `useTheme` to the Hooks table and
  `worklooking_theme` to the Persistence table. Exact rows below.
- **Boundary/layer rationale:** Doc must match code in the same change.

## New files

### `src/hooks/useTheme.ts`
Exported surface (explicit return type, `interface` for shapes, no `any`):

```ts
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedAppearance = "light" | "dark";

export interface UseThemeResult {
  mode: ThemeMode;                 // persisted user choice
  resolved: ResolvedAppearance;    // what is actually applied right now
  setMode: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeResult;
```

Implementation contract:
- `const STORAGE_KEY = "worklooking_theme";` `const DEFAULT_MODE: ThemeMode = "system";`
- **Type guard** `isThemeMode(value: unknown): value is ThemeMode` (checks against
  the three literals) — used to validate the stored string (no `any`).
- `loadMode(): ThemeMode` — `try { const raw = localStorage.getItem(STORAGE_KEY); return isThemeMode(raw) ? raw : DEFAULT_MODE; } catch { return DEFAULT_MODE; }`
  Corrupt/unknown/missing → `"system"` (AC1, AC12).
- `prefersDark(): boolean` — guarded:
  `typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches`
  (matchMedia-absence guard per Risks).
- `resolveAppearance(mode, systemPrefersDark): ResolvedAppearance` — pure:
  `mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode`.
- State: `const [mode, setModeState] = useState<ThemeMode>(loadMode);`
- `applyClass(appearance)` — toggles `.dark` on `document.documentElement`
  (`classList.toggle("dark", appearance === "dark")`) (AC2, AC3).
- **Effect A (apply + persist on mode change):** on `mode` change, compute
  `resolveAppearance(mode, prefersDark())`, call `applyClass`, and
  `try { localStorage.setItem(STORAGE_KEY, mode); } catch {}` (AC4 writes exactly
  one of the three literals under the one key; AC7 persistence; idempotent with the
  index.html script).
- **Effect B (system subscription):** only when `mode === "system"` — obtain
  `const mql = window.matchMedia("(prefers-color-scheme: dark)")` (guard absence),
  add a `change` listener that re-applies the class from `mql.matches`; return a
  cleanup that removes it. Use `addEventListener("change", …)` with a fallback to
  the deprecated `addListener`/`removeListener` when `addEventListener` is absent
  (AC5, AC13). When `mode !== "system"` the effect installs no listener → OS
  changes are ignored (AC6). Changing mode re-runs the effect, cleanly removing the
  prior listener (Risks: rapid toggling / no leaks).
- `resolved` is stored in state and updated by both effects so the control and any
  consumer can reflect the live appearance.
- `setMode` is a stable `useCallback` that calls `setModeState`.

### `src/components/ThemeToggle.tsx`
Presentational only (no logic, no localStorage, no matchMedia):

```ts
interface IThemeToggle {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}
export function ThemeToggle({ mode, onModeChange }: IThemeToggle): JSX.Element;
```

- Renders three `<Button>` (from `@/components/ui/button`) in a segmented group
  (`<div className="inline-flex rounded-md border ...">` or `flex gap-2`), each
  using `variant={mode === value ? "default" : "ghost"}` and `size="sm"` — reusing
  the exact active/inactive pattern from `App.tsx` NavLinks.
- Options array (French labels + lucide-react icons):
  - `{ value: "light", label: "Clair", Icon: Sun }`
  - `{ value: "dark",  label: "Sombre", Icon: Moon }`
  - `{ value: "system", label: "Système", Icon: Monitor }`
  Icons from `lucide-react` (already a dependency): `Sun`, `Moon`, `Monitor`
  (AC8 — visible French label + icon each).
- Each button: `<Icon className="w-4 h-4 mr-2" />{label}`, `onClick={() => onModeChange(value)}`,
  and `aria-pressed={mode === value}` for the selected state.

### `src/hooks/useTheme.test.ts` (NEW — see "Tests")
### `src/components/ThemeToggle.test.tsx` (NEW — see "Tests")

## Tests

Renderer project (jsdom), co-located, Vitest + `@testing-library/react`, following
`src/hooks/useTemplateSelection.test.ts` style. **jsdom has no `matchMedia`**, so a
per-test helper installs a controllable mock:

```ts
// local helper in the test file
function installMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_: string, cb) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb) => listeners.delete(cb)),
    // legacy fallbacks the hook may use:
    addListener: vi.fn((cb) => listeners.add(cb)),
    removeListener: vi.fn((cb) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return { mql, emit: (m: boolean) => { mql.matches = m; listeners.forEach((cb) => cb({ matches: m } as MediaQueryListEvent)); } };
}
```

`localStorage` is auto-cleared by `tests/setup.renderer.ts` `afterEach`, but
`document.documentElement.classList` is NOT — each test must reset it in a
`beforeEach`/`afterEach` (`document.documentElement.classList.remove("dark")`).

`src/hooks/useTheme.test.ts`:
- **default = system when no key** → `mode === "system"` (AC1).
- **corrupt/unknown stored value falls back to system** without throwing
  (set `worklooking_theme = "banana"`) (AC12).
- **persistence read on init** → stored `"dark"` yields `mode === "dark"` and
  `.dark` present (AC7).
- **light mode ⇒ no `.dark` class** on `documentElement` (AC2).
- **dark mode ⇒ `.dark` class present** (AC3).
- **system + OS dark ⇒ `.dark`; system + OS light ⇒ no `.dark`** via matchMedia
  mock `matches` (AC2/AC3 for system).
- **setMode writes exactly the literal to `worklooking_theme`** and creates no
  other key (snapshot `localStorage.length`) (AC4).
- **live OS change in system mode** → `emit(true)` toggles `.dark` on with no
  further action; `emit(false)` toggles it off (AC5).
- **manual override precedence** → set `mode = "light"`, then `emit(true)`; assert
  `.dark` stays absent (listener inactive in manual mode) (AC6).
- **listener cleanup** → assert `addEventListener` was called in system mode and
  `removeEventListener` is called on unmount and when switching away from system
  (spy assertion) (AC13).

`src/components/ThemeToggle.test.tsx`:
- **renders French labels + icons** → "Clair", "Sombre", "Système" all present;
  three buttons rendered (AC8).
- **click calls `onModeChange` with the right value** and selected button has
  `aria-pressed="true"` for the current `mode`.

**Not unit-tested (verified manually / by design), called out here:**
- **AC9 (resume preview iframes unaffected):** `.dark` is applied to
  `document.documentElement`; iframe documents from `electron/themes/*` are
  separate documents and do not inherit the parent class. Verified by manual
  `npm run dev` toggle + visual check (no automated iframe test exists).
- **AC15 (no flash):** Implemented via the `index.html` inline script; verified
  manually by launching in each mode. No automated pre-paint test.
- **AC10 (control only on /settings):** Enforced structurally (only wired into the
  `/settings` route in `App.tsx`); manual check that the header has no toggle.
- **AC11 (TS strict / no-any):** Verified by `npm run typecheck`.

Verify commands (from `package.json`):
- `npm run typecheck` — `tsc --noEmit` for both processes, `strict: true` (AC11).
- `npm test` — full Vitest suite (node + renderer).
- `npm run test:renderer` — fast loop for the new renderer tests.
- `npm run dev` — manual: toggle each mode, flip OS scheme in system mode, restart,
  confirm resume preview and startup flash (AC9, AC15) and header absence (AC10).

## Docs to update

`docs/state.md`:
- **Hooks table** — add row:
  `| `useTheme` | App UI appearance mode (light/dark/system), `.dark` class + OS `matchMedia` subscription |`
- **Persistence table** — add row:
  `| App theme | `localStorage` (`worklooking_theme`, `light`\|`dark`\|`system`) | `useTheme` |`

## Risks & mitigations
- **FOUC (AC15):** mitigated by the `index.html` inline pre-paint script; hook
  re-applies idempotently on mount so no divergence.
- **`matchMedia` absent / legacy API:** hook and inline script guard for
  `window.matchMedia`; hook uses `addEventListener` with `addListener` fallback.
- **Leaked listeners on rapid toggling:** effect cleanup removes the prior listener
  before installing a new one; asserted in the cleanup test (AC13).
- **`.dark` cascading into resume iframes (AC9):** iframes are separate documents;
  root-class does not cross the boundary — confirmed by manual check.
- **Test env leakage:** `classList` not reset by shared setup; each theme test
  clears `.dark` in `beforeEach`/`afterEach` to avoid cross-test bleed.
- **Docs drift (AC14):** `docs/state.md` updated in the same change.

## Rollback / out-of-scope reminders
- **No IPC, no main-process changes, no security-config changes** — pure renderer +
  CSS-class + `localStorage`.
- **Resume preview iframes (`electron/themes/*`) must stay visually untouched** —
  do not add `.dark` handling inside rendered theme HTML.
- **No header/other-page control** — only `/settings`.
- **No new themes/accent colors/color pickers.**
- Rollback = remove `useTheme.ts`, `ThemeToggle.tsx`, their tests, the
  `index.html` script block, and the `ConfigurationPage`/`App.tsx` wiring +
  `docs/state.md` rows; the existing `:root`/`.dark` CSS is pre-existing and left
  as-is.

## Implementation notes

Built exactly as planned. `npm run typecheck` passes (both processes, `strict`);
tests were not run here (tester stage owns that).

- **`src/hooks/useTheme.ts` (new):** `ThemeMode` / `ResolvedAppearance` types and
  `UseThemeResult` interface; `isThemeMode` type guard; `loadMode` with try/catch →
  `"system"` fallback; guarded `prefersDark`; pure `resolveAppearance`; `applyClass`
  via `classList.toggle("dark", …)`. Effect A applies + persists on `mode` change;
  Effect B subscribes to `matchMedia` only in system mode with `addEventListener` +
  legacy `addListener` fallback and cleanup. `resolved` tracked in state; `setMode`
  is a stable `useCallback`. No `any`; explicit return type.
- **`src/components/ThemeToggle.tsx` (new):** presentational 3-button segmented
  control (Clair/Sombre/Système) with `Sun`/`Moon`/`Monitor` lucide icons, reusing
  `Button` with `variant` default/ghost + `size="sm"` and `aria-pressed`. `IThemeToggle`
  props interface; no logic.
- **`index.html`:** added the render-blocking inline anti-flash `<script>` in `<head>`
  before the module script; dependency-free, guards `matchMedia`, wraps localStorage
  in try/catch, defaults to light.
- **`src/App.tsx`:** `const theme = useTheme();` at root; threaded `mode`/`setMode`
  into the `/settings` `ConfigurationPage` alongside the existing settings props.
- **`src/pages/configuration.tsx`:** extended `IConfigurationPage` with
  `mode`/`setMode`, added an "Apparence" `Card` rendering `<ThemeToggle>`.
- **`docs/state.md`:** added `useTheme` Hooks row and `worklooking_theme` Persistence
  row (AC14).
- **Tests (created, not run):** `src/hooks/useTheme.test.ts` (matchMedia mock helper,
  classList reset per test, AC1/2/3/4/5/6/7/12/13 coverage) and
  `src/components/ThemeToggle.test.tsx` (French labels, aria-pressed, onModeChange).

### Deviations

1. **Return type `ReactElement` instead of `JSX.Element` for `ThemeToggle`.** The plan
   signature used `JSX.Element`, but under React 19 + `"jsx": "react-jsx"` the global
   `JSX` namespace is not reliably available (it now lives under `React.JSX`). Used the
   imported `ReactElement` type to keep an explicit return type with no type error. No
   behavioral difference.
2. **Component test avoids `@testing-library/jest-dom` matchers** (`toBeInTheDocument`,
   `toHaveAttribute`). The repo's `tsconfig.json` does not register the jest-dom type
   augmentation for `tsc`, and the existing `useTemplateSelection.test.ts` likewise uses
   plain assertions. Used `queryByText(...).not.toBeNull()` and
   `getAttribute("aria-pressed")` to match the established convention and keep typecheck
   green. Assertions cover the same AC8 / selection behavior.
