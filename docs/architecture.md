# Architecture

WorkLooking is an Electron desktop app: a secure Node.js **main process** and a React **renderer**, with a shared type layer between them.

## Process model

| Process | Location | Runtime | Responsibility |
| ------- | -------- | ------- | -------------- |
| Main | `electron/` | Node.js | Window, IPC handlers, filesystem, AI tool loop, PDF/HTML rendering |
| Preload | `electron/preload.ts` | Bridge | Exposes typed `window.api` via `contextBridge` |
| Renderer | `src/` | Chromium + React | UI, routing, local state |
| Shared | `shared/` | Both | IPC contracts and domain types |

## Directory layout

```
electron/                 # Main process
├── main.ts               # Entry point: IPC handlers, tool loop, window
├── preload.ts            # contextBridge -> window.api
├── agent/                # The app's SHIPPED AI assistant (product, not dev tooling)
│   ├── tools.ts          # OpenAI function-tool definitions
│   ├── prompt.ts         # System prompt builder
│   ├── aiClient.ts       # AiClientRouter: OpenAI + Anthropic provider adapters
│   └── agent.md          # Product agent instructions (job-search assistant)
├── themes/               # Resume themes (Handlebars)
│   ├── index.ts          # Theme registry (ThemeName union)
│   ├── shared/render.ts  # Shared Handlebars rendering
│   └── <theme>/          # index.ts + resume.hbs + style.css
└── utils/
    └── image-processor.ts

shared/                   # Cross-process types (source of truth)
├── ipc.ts                # Channels, IPCHandlers, ErrorCodes
├── resume-types.ts       # JSON Resume schema
├── candidature-types.ts  # CandidatureConfig
├── provider-types.ts     # ProviderApi, ProviderPreset, PROVIDER_PRESETS
└── chat-types.ts         # Chat message / tool payloads

src/                      # Renderer (React 19 + react-router-dom)
├── App.tsx               # Root + routing
├── main.tsx              # React entry
├── electron.d.ts         # Global window.api types
├── pages/                # Route-level components (thin)
├── components/           # UI: ui/, resume-editor/, candidature-editor/, onboarding/
├── hooks/                # Business logic (use*.ts)
├── lib/                  # Utilities (cn, etc.)
└── styles/globals.css    # Tailwind v4
```

## Key boundaries

- **Renderer never touches Node.** All filesystem, network, and AI calls go through `window.api.invoke` → IPC handler in `main.ts`.
- **`shared/ipc.ts` is the contract.** Both processes import from it; changing a channel means changing it in one place.
- **The shipped agent (`electron/agent/`) is product code**, not dev-workflow config. Do not confuse `electron/agent/agent.md` with the root `AGENTS.md`.

## Notable decisions

1. Secure context bridge: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
2. Logic/UI separation: business logic lives in hooks, components render.
3. Centralized IPC: channel names are constants, preventing typos across processes.
4. Input validation: main process treats renderer input as untrusted (path sanitization).
5. App-wide `ErrorBoundary` for graceful failure.
