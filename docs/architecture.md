# Architecture

WorkLooking is an Electron desktop app: a secure Node.js **main process** and a React **renderer**, with a shared type layer between them.

## Process model

| Process | Location | Runtime | Responsibility |
| ------- | -------- | ------- | -------------- |
| Main | `electron/` | Node.js | Main window, IPC handlers, filesystem, AI tool loop, PDF/HTML rendering |
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
├── lib/                  # Pure, testable helpers used by main.ts
│   ├── paths.ts          # IPCError + validateAndSanitizePath (traversal guard)
│   └── auth-detect.ts    # detectsAuthRequired (fetch auth-wall heuristic)
└── utils/
    └── image-processor.ts

shared/                   # Cross-process types (source of truth)
├── ipc.ts                # Channels, IPCHandlers, ErrorCodes
├── resume-types.ts       # JSON Resume schema
├── candidature-types.ts  # CandidatureConfig
├── provider-types.ts     # ProviderApi, ProviderPreset, PROVIDER_PRESETS
├── chat-types.ts         # Chat message / tool payloads
├── resume-sections.ts    # RESUME_SECTIONS descriptor (feedback-loop pins; PII-free)
└── feedbackMessages.ts   # PII-free French regeneration/validation message builders

src/                      # Renderer (React 19 + react-router-dom)
├── App.tsx               # Root + routing
├── main.tsx              # React entry
├── electron.d.ts         # Global window.api types
├── pages/                # Route-level components (thin)
├── components/           # UI: ui/, resume-editor/, candidature-editor/, onboarding/, feedback-loop/ (FeedbackModal + rail/preview/controls)
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
6. **In-app modal for the CV feedback loop (single window).** When `ai:chat`
   returns an `updatedResume`, `useChat` opens the `FeedbackModal` in the main
   window. `useFeedbackLoop` holds the ephemeral draft comments + preview and
   drives regeneration/validation by continuing the SAME conversation via
   `useChat.sendFeedbackMessage` (no second `BrowserWindow`, no new IPC channels).
   The validated resume persists via `useResume.setResumeByAi`. This replaced an
   earlier, unreliable second-`BrowserWindow` design. See `docs/ipc.md`.
