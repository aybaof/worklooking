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

## Release automation

`.github/workflows/release.yml` builds and publishes the app for Windows,
Linux, and macOS whenever a version tag is pushed:

- **Trigger**: only on tag pushes matching `v*.*.*` (e.g. `v1.2.0`) — no
  `workflow_dispatch`, no trigger on ordinary `main` pushes.
- **Version gate**: a `validate-version` job strips the leading `v` from the
  pushed tag and compares it to `package.json.version` on the tagged commit;
  a mismatch fails the workflow with a clear `::error::` message before any
  platform build starts.
- **Matrix**: `windows-latest`, `ubuntu-latest`, `macos-latest`, each with
  `needs: validate-version` and Node pinned to **24** via
  `actions/setup-node`.
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
