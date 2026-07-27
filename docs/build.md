# Build & Tooling

Bundling and packaging are driven by **Electron Forge** with the **Vite plugin**.

## NPM scripts (`package.json`)

| Script | Command | Purpose |
| ------ | ------- | ------- |
| `dev` | `electron-forge start` | Dev server + Electron with HMR |
| `dev:debug` | `electron-forge start --inspect-electron --remote-debugging-port=9222` | Dev with debugger attached |
| `start` | `electron-forge start` | Alias for dev |
| `package` | `electron-forge package` | Package app (no installer) |
| `make` | `electron-forge make --platform win32 --arch x64` | Windows build + installer |
| `make:all` | `electron-forge make` | All configured platforms |
| `publish` | `electron-forge publish` | Publish (GitHub publisher) |
| `clean` | `rm -rf .vite out dist dist-electron` | Remove build artifacts |
| `generate:icon` | `tsx scripts/generate-icon.ts` | Regenerate `electron/icon.ico` (multi-resolution) |
| `test` | `vitest run` | Run the full test suite once (node + renderer) |
| `test:watch` | `vitest` | Test suite in watch mode |
| `test:ui` | `vitest --ui` | Vitest browser UI |
| `test:node` | `vitest run --project node` | Main-process + `shared/` tests only |
| `test:renderer` | `vitest run --project renderer` | Renderer (jsdom) tests only |
| `typecheck` | `tsc --noEmit && tsc --noEmit -p electron/tsconfig.json` | Type-check both processes |

## Build output

- Electron Forge + `@electron-forge/plugin-vite` build to **`.vite/`**.
- `main` entry is `.vite/build/main.js` (see `package.json` `main`).
- `out/` holds packaged/made artifacts.

## Config files

| File | Role |
| ---- | ---- |
| `vite.config.ts` | Renderer build (React + Tailwind v4, `@/*` → `./src/*`) |
| `vite.main.config.ts` | Main/preload build (CommonJS, `.md` loader, externalizes electron/node) |
| `forge.config.js` | Makers (Squirrel/ZIP/DEB/RPM), ASAR, fuses, `extraResource` |
| `tsconfig.json` | Renderer TS config (`strict`, `@/*` alias) |
| `electron/tsconfig.json` | Main-process TS config |
| `tsconfig.node.json` | Config for Vite config files |
| `nodemon.json` | Electron hot reload |

## Forge specifics (`forge.config.js`)

- `extraResource: ["electron/themes/", "electron/agent/agent.md"]` — ships themes and the product agent instructions.
- Fuses harden security (RunAsNode disabled, cookie encryption on).
- `packagerConfig.appVersion` is derived from `package.json` (`packageJson.version`)
  rather than hardcoded, so the built app's version always matches
  `package.json.version` with no manual sync step — see "Release automation" below.
- `externalDependencies` + the `packageAfterCopy` hook copy npm packages that
  are externalized from the Vite main-process bundle (see
  `vite.main.config.ts`'s `rollupOptions.external`) into the packaged
  `node_modules`, since Vite's `ssr` build leaves them as runtime `require()`
  calls instead of bundling them. **Any package added to one list must be
  added to the other**, or the packaged app crashes at startup with
  `Cannot find module '<pkg>'`. The hook also walks each dependency's own
  prod dependency tree (via `flora-colossus`) and separately enumerates
  `node_modules/@img/*` (sharp's per-platform native binaries), since those
  are optional dependencies the walker doesn't follow.
- The `postMake` hook renames maker output to non-technical-friendly
  filenames before publishing (e.g. `WorkLookingAgent-darwin-arm64-X.Y.Z.zip`
  → `WorkLookingAgent-Mac-AppleSilicon-X.Y.Z.zip`). It intentionally leaves
  Windows' `.nupkg`/`RELEASES` files untouched, since Squirrel's
  auto-updater matches those by their exact original filename.

## App icon

- **`electron/icon.ico`** is the single canonical source-of-truth app icon,
  consumed by both `forge.config.js`'s `packagerConfig.icon` (the packaged
  app/shortcut icon) and the Squirrel maker's `setupIcon` (the `Setup.exe`
  installer icon).
- It **must be a multi-resolution ICO** containing at minimum the 16x16,
  32x32, 48x48, and 256x256 sizes, all 32bpp RGBA. A single-resolution
  `.ico` is what previously caused the installed app, its Desktop/Start Menu
  shortcuts, and its taskbar icon to fall back to the generic Electron icon
  on Windows — do not reintroduce a single-resolution icon file. This is
  enforced by an automated regression test, `tests/node/icon.test.ts`.
- **Regenerate it** with `npm run generate:icon` (`tsx scripts/generate-icon.ts`),
  which resamples the file's own existing embedded frame to the standard
  sizes via `sharp` and hand-assembles a valid multi-frame ICO container (no
  ICO-writing npm package is used or needed). Point the script at better
  source art if any is ever added to the repo; as of now no higher-resolution
  or vector source art exists, so the 256px frame is upsampled from the
  original 128px image.
- `assets/icon.ico` and `assets/icon.png` are **stray, unused, unwired
  duplicates** of the old single-resolution icon (not referenced by
  `forge.config.js` or any other source) — they are not the canonical file
  and are intentionally left untouched; don't confuse them with
  `electron/icon.ico`.

## Release automation

`.github/workflows/release.yml` builds and publishes the app for Windows,
Linux, and macOS whenever a version tag is pushed:

- **Trigger**: only on tag pushes matching `v*.*.*` (e.g. `v1.2.0`) — no
  `workflow_dispatch`, no trigger on ordinary `main` pushes.
- **Version gate**: a `validate-version` job strips the leading `v` from the
  pushed tag and compares it to `package.json.version` on the tagged commit;
  a mismatch fails the workflow with a clear `::error::` message before any
  platform build starts.
- **Matrix**: uses `matrix.include` (not a flat `os:` list) so each entry can
  set its own `runs-on`:
  - `windows-latest` (Windows x64)
  - `ubuntu-latest` (Linux x64)
  - `macos-latest` (macOS Apple Silicon/arm64, GitHub-hosted)
  - `[self-hosted, macOS, X64]` (macOS Intel/x64 — see "Intel Mac runner
    (self-hosted)" below)

  Every job has `needs: validate-version` and Node pinned to **24** via
  `actions/setup-node`. Native modules (e.g. sharp's `@img/*` binaries) are
  resolved correctly per architecture because each matrix job runs its own
  `npm ci`, so no cross-compilation or arch override is needed.

### Intel Mac runner (self-hosted)

GitHub removed the free Intel (x64) macOS hosted runner image (`macos-13` is
deprecated/removed) and only offers x64 macOS via paid **Larger runners**
(org/enterprise-only, GitHub Team/Enterprise Cloud plan required — not
available on personal accounts). Instead, Intel Mac builds run on a
**self-hosted runner** on real Intel Mac hardware:

- **Labels**: registered with `self-hosted`, `macOS`, `X64` — targeted in the
  workflow via `runs-on: [self-hosted, macOS, X64]`.
- **Prerequisites on the runner machine**: `git` (for `actions/checkout`) and
  a network connection; Node.js is **not** pre-installed manually —
  `actions/setup-node@v4` downloads/installs Node 24 automatically on
  self-hosted runners too, same as hosted ones.
- **Must be online at release time**: the runner (and its background
  service) must be powered on and connected whenever a `v*.*.*` tag is
  pushed, or that matrix job hangs waiting for a runner to pick it up.
- **Security note**: this is safe here because the workflow only triggers on
  tag pushes (requires write access to the repo), not on `pull_request`, so
  forks/external contributors can't schedule jobs on this machine.
- **Per-job gate order**: `npm ci` → `npm run typecheck` → `npm test` →
  `npm run publish`. A typecheck or test failure stops that job before
  `electron-forge publish` runs.
- **Publish target**: GitHub Releases, via the existing
  `@electron-forge/publisher-github` config in `forge.config.js`, using the
  default `secrets.GITHUB_TOKEN` — no additional repo secrets are needed.
- **Platform independence**: the matrix uses `fail-fast: false`, so one
  platform's build/test/publish failure does not cancel or block the
  others — a release can end up with partial platform coverage if one job
  fails; re-check the Actions run, not just the Release page, after tagging.

## Testing (Vitest)

The suite uses **Vitest**, configured in `vitest.config.ts` with **two projects**:

- **`node`** (`environment: node`) — covers `electron/**` and `shared/**`.
- **`renderer`** (`environment: jsdom`) — covers `src/**`; setup in
  `tests/setup.renderer.ts` (jest-dom matchers, DOM/localStorage reset).

Vitest reuses Vite resolution, so the `@` alias, `.css?raw`, and the custom
`.hbs`/`.md` raw-loader (mirrored from `vite.main.config.ts`) all work in tests.

- Tests are co-located next to source as `<name>.test.ts(x)`; cross-cutting
  ones live under `tests/node/` or `tests/renderer/`.
- Fixtures: `tests/fixtures/`. Renderer IPC mock helper:
  `tests/renderer/mockWindowApi.ts`.
- The suite is **scaffolded with `it.todo` stubs**; the outstanding work and
  full test inventory live in **`tests/TEST_PLAN.md`**.

## Verification

Before finishing a change, agents **must**:

1. `npm run typecheck` — must be clean (`strict: true`, both processes).
2. `npm test` — the full suite must pass (both projects).
3. `npm run dev` and exercise the affected flow when UI/behavior changed.

`prettier` is available as a dev dependency for formatting.
