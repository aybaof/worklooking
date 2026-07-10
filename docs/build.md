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
