# Feature: App UI theme toggle (light / dark / system)

- **Slug:** theme-toggle
- **Status:** draft
- **Created:** 2026-07-10

## Summary

Add a light / dark / system appearance toggle for the WorkLooking app chrome, living on
the Settings/Configuration page, driven by a new `useTheme` hook that persists the choice
in `localStorage` and follows the OS color scheme live when set to "System".

## Problem

WorkLooking only renders in a single fixed appearance. Users who prefer a dark interface
(or who run their OS in dark mode) have no way to change the app's look, and the app does
not respect the operating system's `prefers-color-scheme`. This causes eye strain in
low-light environments and an inconsistent experience versus the rest of the user's OS.

## Users / personas

- **Everyday job seeker (primary):** Uses WorkLooking during evenings/late hours; wants a
  dark interface to reduce glare, or simply wants the app to match their OS theme
  automatically without fiddling.
- **OS-theme-following user:** Runs macOS/Windows with an automatic day/night scheme and
  expects apps to follow the system appearance and switch live when the OS switches.

## User stories

1. **First run (System default):** As a first-time user with no stored preference, when I
   open the app, the interface matches my OS color scheme (dark chrome if my OS is dark,
   light chrome if my OS is light), and the Settings control shows "Système" selected.
2. **Switching to Light:** As a user, when I click "Clair" on the Settings page, the app
   chrome immediately switches to the light appearance and stays light regardless of my OS
   scheme.
3. **Switching to Dark:** As a user, when I click "Sombre" on the Settings page, the app
   chrome immediately switches to the dark appearance and stays dark regardless of my OS
   scheme.
4. **Switching back to System:** As a user, when I click "Système", the app chrome
   immediately resolves to my current OS scheme and thereafter follows OS changes.
5. **OS scheme changes live while in System mode:** As a user in "Système" mode, when I
   change my OS from light to dark (or vice versa) while the app is open, the app chrome
   updates live without a restart or manual action.
6. **Preference survives restart:** As a user who picked "Sombre" (or any mode), when I
   quit and relaunch the app, my selection is still in effect and still selected in the
   Settings control.

## In scope

- New renderer hook `src/hooks/useTheme.ts` owning theme state, persistence, and effects.
- A segmented 3-button control ("Clair", "Sombre", "Système", each with an icon) on the
  Configuration page (`/settings`, `src/pages/configuration.tsx` / `ConfigurationPage`).
- Wiring the hook at the app root (`src/App.tsx`) and threading mode + setter down to the
  Configuration page, mirroring how `useSettings` is threaded today.
- Persisting the preference in `localStorage` under key `worklooking_theme`.
- Applying/removing the `.dark` class on `document.documentElement` to switch the existing
  CSS variables in `src/styles/globals.css`.
- Live subscription to `window.matchMedia("(prefers-color-scheme: dark)")` while in System
  mode, with listener cleanup.
- Updating `docs/state.md` (Hooks table + Persistence table) in the same change.

## Out of scope

- **Resume preview iframes rendered from `electron/themes/*` — explicitly OUT OF SCOPE and
  must remain visually untouched.** Only the app chrome/UI is themed.
- Any theme control in the app header or anywhere other than the Settings page.
- New IPC channels or any main-process changes (renderer + CSS + localStorage only).
- Per-component custom color pickers, additional themes beyond light/dark, or accent colors.
- Changes to main-process security config.

## Constraints

- TypeScript `strict: true`, **no `any`** (use `unknown` + type guards). Explicit return
  types on exported functions; prefer `interface` for object shapes.
- File naming: hook is camelCase with `use` prefix (`useTheme.ts`); components PascalCase.
- Hooks own logic; components render only. No business logic in the Settings component.
- Product UI copy is **French** ("Clair" / "Sombre" / "Système"); code identifiers and dev
  docs stay English.
- No main-process changes; no new IPC channel. Pure renderer + `localStorage`.
- Persistence must survive app restart.
- **Docs contract:** because this adds a hook + a localStorage key + a Settings control,
  `docs/state.md` (Hooks table and Persistence table) MUST be updated in the same change.

## Data & PII notes

- **No PII.** The only data touched is a single `localStorage` key `worklooking_theme`
  with values `"light" | "dark" | "system"`.
- **No new IPC** and no main-process/file-system data. No data is sent to the LLM.

## Acceptance criteria

Each criterion is independently verifiable (unit test, DOM assertion, or manual check).

- **AC1 — Default is System on first run:** With no `worklooking_theme` key in
  `localStorage`, the hook resolves to mode `"system"` and the Settings control shows
  "Système" selected.
- **AC2 — Light appearance = no `.dark` class:** When the resolved appearance is light
  (mode `"light"`, or mode `"system"` while OS is light), `document.documentElement` does
  NOT have the `.dark` class.
- **AC3 — Dark appearance = `.dark` class present:** When the resolved appearance is dark
  (mode `"dark"`, or mode `"system"` while OS is dark), `document.documentElement` HAS the
  `.dark` class.
- **AC4 — localStorage key/value contract:** Selecting a mode writes exactly one of
  `"light"`, `"dark"`, or `"system"` to `localStorage` under key `worklooking_theme`; no
  other key is created or modified.
- **AC5 — Live OS change in System mode:** While mode is `"system"`, dispatching a
  `matchMedia("(prefers-color-scheme: dark)")` change event flips the `.dark` class to
  match the new OS scheme with no restart and no user action.
- **AC6 — Manual override precedence:** After selecting `"light"` or `"dark"`, subsequent
  OS scheme changes do NOT alter the app appearance (the matchMedia listener is inactive or
  ignored while in a manual mode).
- **AC7 — Persistence across restart:** After selecting a mode and reloading/relaunching
  the renderer, the same mode is read from `localStorage` and applied, and the Settings
  control reflects it.
- **AC8 — French labels present:** The three buttons render the visible French labels
  "Clair", "Sombre", and "Système", each with an accompanying icon.
- **AC9 — Resume preview unaffected:** Toggling any mode produces no change to the resume
  preview iframes rendered from `electron/themes/*` (their markup/styles are untouched).
- **AC10 — Control location:** The theme control appears only on `/settings`
  (`ConfigurationPage`) and nowhere in the app header or other pages.
- **AC11 — TS strict / no-any:** New code passes `npm run typecheck` with `strict: true`
  and contains no `any`; exported hook function has an explicit return type and object
  shapes use `interface`.
- **AC12 — Invalid stored value falls back to default:** If `worklooking_theme` holds an
  unrecognized/corrupt value, the hook falls back to `"system"` without throwing.
- **AC13 — Listener cleanup:** Switching away from System mode or unmounting removes the
  `matchMedia` change listener (no leaked listeners; verified via spy or teardown assertion).
- **AC14 — Docs updated:** `docs/state.md` is updated in the same change to add `useTheme`
  to the Hooks table and `worklooking_theme` to the Persistence table.
- **AC15 — No flash of wrong theme:** The correct appearance is applied at/before first
  paint so users do not see a flash of the wrong theme on startup.

## Open questions

None. All requirements were confirmed by the user prior to spec authoring.

Note for downstream stages (non-blocking): AC15 (no flash) is a quality target; the
implementation stage should decide the mechanism (e.g. apply the resolved theme in a
top-of-`main.tsx`/index bootstrap or an inline pre-hydration script) — the spec does not
mandate a specific technique, only the observable outcome.

## Risks

- **Flash of incorrect theme (FOUC):** If the `.dark` class is applied only after React
  mounts, users may briefly see the wrong appearance. Mitigated by applying the resolved
  theme before/at first paint (AC15).
- **`matchMedia` availability:** In some environments `window.matchMedia` may be undefined
  or the deprecated `addListener`/`removeListener` API may be needed instead of
  `addEventListener`. The hook must guard for absence and use the supported listener API.
- **Rapid toggling:** Fast repeated mode changes must not leak `matchMedia` listeners or
  desync the persisted value from the applied class (each change replaces the prior effect
  cleanly).
- **Corrupt/invalid stored value:** A bad `worklooking_theme` value must not crash the app;
  it falls back to `"system"` (AC12).
- **Scope leakage into resume preview:** Applying `.dark` at the document root could
  unintentionally cascade into resume preview iframes; must be verified isolated (AC9).
- **Docs drift:** Forgetting to update `docs/state.md` would violate the docs contract
  (AC14).
