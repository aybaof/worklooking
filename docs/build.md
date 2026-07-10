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

## Verification

There is currently no test runner or lint script wired into `package.json`. To verify changes:

- Type-check via the editor/`tsc` (project is `strict: true`).
- Run `npm run dev` and exercise the affected flow.
- `prettier` is available as a dev dependency for formatting.
