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
│   ├── auth-detect.ts    # detectsAuthRequired (fetch auth-wall heuristic)
│   └── candidature-folder.ts # deriveCandidatureFolderSegment (Valider folder naming)
└── utils/
    └── image-processor.ts

shared/                   # Cross-process types (source of truth)
├── ipc.ts                # Channels, IPCHandlers, ErrorCodes
├── resume-types.ts       # JSON Resume schema
├── candidature-types.ts  # CandidatureConfig
├── provider-types.ts     # ProviderApi, ProviderPreset, PROVIDER_PRESETS
├── chat-types.ts         # Chat message / tool payloads
├── resume-sections.ts    # RESUME_SECTIONS descriptor (feedback-loop pins; PII-free)
└── feedbackMessages.ts   # PII-free French regeneration message builder

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
   drives REGENERATION rounds by continuing the SAME conversation via
   `useChat.sendFeedbackMessage` (no second `BrowserWindow`). Validation
   ("Valider"), however, is a DETERMINISTIC main-process write reached directly
   from the renderer via the new `resume:generate-final` IPC channel — no LLM
   round-trip — plus a `shell:show-item-in-folder` channel for the resulting
   "reveal in folder" action. The validated resume persists via
   `useResume.setResumeByAi`. This replaced an earlier, unreliable
   second-`BrowserWindow` design. See `docs/ipc.md`.

   UX details of the loop:
   - **Hidden feedback turns.** Feedback-loop turns (regeneration/validation
     prompts and their assistant replies) are tagged `origin: "feedback"` on the
     `Message` type (`shared/chat-types.ts`). `useChat.runTurn(userMessage,
     origin)` stamps the marker on the user message and the assistant reply
     (streamed chunks via a `currentTurnOriginRef`, final reply via
     `response.content`). `ChatPage` filters `origin === "feedback"` messages out
     of the rendered list, but the FULL history (including flagged turns) is
     still sent to the model. Absent `origin` = visible chat (back-compatible).
   - **Full-screen modal.** `FeedbackModal` fills the window edge-to-edge
     (`inset-0`, full width/height; no `p-4` margin or size cap).
   - **Section-scoped merge.** After each regeneration `useFeedbackLoop` applies
     a deterministic merge via the pure `shared/resumeMerge.ts`
     (`mergeScopedResume`): only the commented sections are taken from the LLM's
     `updatedResume`; every other section, the whole `basics` block (PII), `meta`,
     and unknown top-level keys are restored verbatim from the pre-regen resume
     (`summary` maps ONLY to `basics.summary`). The raw LLM output is never
     applied directly, so the preview/persisted resume only ever reflects scoped
     edits regardless of LLM drift.
   - **Per-round diff panel.** After each regeneration `useFeedbackLoop` computes
     a leaf-field diff via the pure `shared/resumeDiff.ts` (`diffResumes`) against
     the MERGED resume and exposes it as `changes` (each entry carries a
     structured `sectionId`/`sectionLabel`); the collapsible `RoundDiffPanel`
     groups them under section headers, renders before → after values in French,
     and flags any commented section the LLM left unchanged (via
     `lastRoundCommentedIds`). Diff values are displayed IN-MODAL ONLY and never
     sent into a prompt (PII-safe).
   - **Unsaved-comments guard.** Closing (X / Escape) or Valider while non-empty
     comments are pending shows the in-app `UnsavedCommentsConfirm` (French, not
     `window.confirm`); cancelling keeps the modal + comments intact.
   - **Reseed guard.** A `seededRef` in `useFeedbackLoop` ensures an
     `updatedResume` returned by validation cannot re-open/re-seed the closed
     modal. The same guard also reseeds `company`/`position` from
     `initialCompany`/`initialPosition` when a NEW tailored resume opens the
     modal.
   - **Deterministic Valider + blocked/error/success states.** Clicking Valider
     no longer sends a message through the LLM conversation. `useFeedbackLoop`
     holds the LATEST non-empty `company`/`position` captured from
     `render_resume_html` (across regeneration rounds) and calls
     `resume:generate-final` directly: if `company`/`position` are unknown, the
     click is **blocked** with an inline French error and no IPC call is made
     (the user must relaunch a CV proposal so the model supplies them); on an
     IPC error/`success: false`, an inline French error is shown and the modal
     stays open/retryable; on success, `onValidated` persists the resume WITHOUT
     closing the modal, and a `ValidationSuccessPanel` shows the written
     path(s), any partial-PDF-failure warning, and an "Afficher dans le
     dossier" button (`revealInFolder`, via `shell:show-item-in-folder`) that
     picks the PDF path if present, else the HTML path. A further regeneration
     round clears the success state (a new round invalidates the prior
     validation). See `docs/ipc.md`.
