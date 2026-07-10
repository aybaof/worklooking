# Review: App UI theme toggle (light / dark / system)

- **Slug:** theme-toggle
- **Status:** approved
- **Reviewed diff:** working tree (`useTheme.ts`, `ThemeToggle.tsx`, `index.html`, `App.tsx`, `configuration.tsx`, co-located tests, `docs/state.md`)

## Verdict
approved

## Blocking findings
None.

## Non-blocking suggestions
- **`src/hooks/useTheme.ts:54-57` — `loadMode()` called twice on init.** The `mode`
  state initializer and the `resolved` state initializer each call `loadMode()`
  (which reads `localStorage`). Harmless (Effect A immediately re-resolves on mount),
  but a single read shared into both initializers would be marginally cleaner.
- **`src/hooks/useTheme.ts:61-70` — Effect A persists on first mount.** On a true
  first run (no key), the mount effect writes `"system"` to `localStorage` without any
  user action. This does not violate AC4 (only the one key, one of the three literals)
  and matches the inline script's default, but it means the "no stored preference"
  state is not preserved after the first launch. Acceptable; noting for awareness only.
- **`src/hooks/useTheme.ts:55-57` — `prefersDark()` runs during render** (in the
  `resolved` initializer). It is side-effect-free (only reads `matchMedia().matches`),
  so this is safe under React's render rules, but a `useState(() => …)` that queries the
  environment is worth a one-line comment for the next reader.
- **`src/components/ThemeToggle.tsx:28` — segmented "border" group.** The plan mentioned
  an optional `rounded-md border` segmented container; the implementation uses
  `inline-flex gap-2` (spaced buttons) instead. Purely cosmetic, within the plan's
  stated latitude ("or `flex gap-2`"). No action needed.

## Spec coverage
| Criterion | Met? | Notes |
| --------- | ---- | ----- |
| AC1 — Default System on first run | met | `loadMode` → `DEFAULT_MODE="system"`; no-key test + `ThemeToggle` "Système pressed" test. |
| AC2 — Light = no `.dark` | met | `applyClass` toggles off; light-mode & system+OS-light tests. |
| AC3 — Dark = `.dark` present | met | dark-mode & system+OS-dark tests. |
| AC4 — localStorage key/value contract | met | Effect A writes only `worklooking_theme`; test asserts `Object.keys(localStorage)===["worklooking_theme"]` for all 3 literals. |
| AC5 — Live OS change in System | met | Effect B `change` listener re-applies from `event.matches`; `emit(true/false)` test asserts class + `resolved`. |
| AC6 — Manual override precedence | met | Effect B early-returns when `mode!=="system"`; "installs no listener in manual mode" + "ignores OS changes" tests. |
| AC7 — Persistence across restart | met | `loadMode` reads key on init; stored `"dark"` → `.dark` applied test. |
| AC8 — French labels + icons | met | Clair/Sombre/Système + one `<svg>` per button asserted. |
| AC9 — Resume preview unaffected | met-manually | `.dark` on `document.documentElement` only; `electron/themes/*` iframes are separate documents (untouched — confirmed no edits). Manual visual check per plan/test-report. |
| AC10 — Control only on /settings | met-manually / structural | Wired solely into `/settings` `ConfigurationPage` in `App.tsx`; header has no toggle (verified in `App.tsx`). |
| AC11 — TS strict / no-any | met-by-typecheck | `unknown`+`isThemeMode` guard; explicit `UseThemeResult`/`ReactElement` return types; `interface` shapes; `npm run typecheck` green. |
| AC12 — Invalid stored value → system | met | `try/catch` + guard; `"banana"` → `"system"` no-throw test. |
| AC13 — Listener cleanup | met | Cleanup removes exact added listener (leave-system + unmount tests assert `removed===added`); legacy `removeListener` path tested. |
| AC14 — Docs updated | met | `docs/state.md` Hooks row (L19) + Persistence row (L34) added. |
| AC15 — No flash | met-manually | Render-blocking inline `<script>` in `index.html` `<head>` before module bundle; key/fallback/resolution logic matches `useTheme` exactly. Manual verification per plan. |

## Docs check
Passed. `docs/state.md` was updated in the same change: `useTheme` appears in the
Hooks table (L19) and `worklooking_theme` in the Persistence table (L34), matching the
implemented key and value domain. No other doc describes this area, so no further doc
edits are owed. Docs contract (AGENTS.md) satisfied.

## Detailed assessment notes

**Anti-flash / inline-script consistency (AC15).** The `index.html` script and
`useTheme` are consistent on all three axes: same storage key (`worklooking_theme`),
same invalid→`"system"` fallback, and the same resolution (`dark` OR `system`&OS-dark).
Both guard `window.matchMedia` absence; the script is dependency-free, wraps all access
in `try/catch`, defaults to light (no class), and reads no Node/renderer bridge. No
injection surface (no interpolation of external data; only a literal string compare and
`classList.toggle`). No divergence found between the script and the hook.

**matchMedia subscription.** Effect B guards `window`/`matchMedia` absence, uses
`addEventListener("change", …)` with a deprecated `addListener`/`removeListener`
fallback, and returns matching cleanup in each branch. Re-runs on `mode` change (dep
`[mode]`), so switching modes cleanly removes the prior listener before (re)subscribing —
no leaks. Absence path returns without subscribing and does not throw.

**localStorage contract / PII.** Only `worklooking_theme` is written, exactly one of the
three literals; reads and writes are `try/catch`-guarded; corrupt values fall back to
`"system"`. No PII, no IPC, no LLM exposure.

**Security / boundary.** Renderer + CSS-class + `localStorage` only. No changes to
`electron/main.ts` (security config `contextIsolation:true`, `nodeIntegration:false`,
`sandbox:true` intact), no new IPC channel, and `electron/themes/*` untouched. Scope
matches the spec; nothing sneaked in.

**Test quality.** Assertions are meaningful, not weakened: AC4 checks the full key set;
AC13 asserts the removed listener is the same reference that was added (real leak check);
the legacy-API and absence-guard paths are exercised. Component tests use plain
assertions per repo convention (jest-dom matchers intentionally avoided — documented
deviation). The four non-automatable ACs (AC9/AC10/AC11/AC15) are correctly delegated to
typecheck/structural/manual verification and clearly called out.
