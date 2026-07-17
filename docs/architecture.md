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
│   ├── fetch-fallback.ts # shouldFallBackToVisible (hidden→visible fetch decision)
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
   `useResume.setResumeByAi`. On a FULL success (both HTML/PDF paths present),
   the modal auto-closes and `App.tsx` appends a resume-attachment message to
   the SAME chat conversation plus a match-or-create write to
   `candidature.config.applications[*].resume_path` (`onFullValidationSuccess`
   — see below); a PARTIAL success (PDF failed) still leaves the modal open
   with `ValidationSuccessPanel`, unchanged. This replaced an earlier,
   unreliable second-`BrowserWindow` design. See `docs/ipc.md`.

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
   - **In-modal theme picker.** `ThemePickerRail` (rendered directly above
     `RegenControls` in the left rail) is a collapsed-by-default toggle showing
     the currently selected theme's name; expanding it reveals a compact grid
     of live per-theme thumbnails (one `ThemeThumbnail` per
     `useTemplateSelection.availableThemes` entry, mounted only while
     expanded), each rendering its OWN mini-preview via the same injected
     `renderPreview` (reused from `useTemplateSelection`, no duplicated
     `Channels.RESUME_RENDER_PREVIEW` call site) with independent
     loading/error state so one broken thumbnail never affects the others.
     `useFeedbackLoop` owns the actual selection as a modal-local
     `selectedTheme`, seeded from a `defaultTheme` option (the app-wide
     `templateSelection.selectedTheme`) on the SAME `seededRef`-guarded reseed
     effect as comments/round — so switching themes mid-session is a pure
     rendering concern that never resets comments/round/diff/validation
     state, and the main `PreviewFrame` re-renders against this local
     selection, not the app-wide default. The toggle and grid are disabled
     while `isRegenerating`. Clicking Valider sends the modal's CURRENT
     `selectedTheme` (not necessarily the app-wide default) as `themeName` to
     `resume:generate-final`; on success ONLY, `useFeedbackLoop` calls the
     injected `onThemeValidated(themeId)` callback, wired in `App.tsx` to
     `templateSelection.setSelectedTheme`, promoting the chosen theme to the
     new app-wide default (persisted `localStorage`) for "Mon CV" and future
     tailored resumes — a blocked/failed/rejected Valider, a plain
     regeneration round, or closing the modal never touch the app-wide
     default.
   - **Deterministic Valider + blocked/error/success states.** Clicking Valider
     no longer sends a message through the LLM conversation. `useFeedbackLoop`
     holds the LATEST non-empty `company`/`position` captured from
     `render_resume_html` (across regeneration rounds) and calls
     `resume:generate-final` directly: if `company`/`position` are unknown, the
     click is **blocked** with an inline French error and no IPC call is made
     (the user must relaunch a CV proposal so the model supplies them); on an
     IPC error/`success: false`, an inline French error is shown and the modal
     stays open/retryable; `onValidated` always persists the resume via
     `useResume.setResumeByAi`, but the modal's next state depends on WHICH kind
     of success: a **partial** success (PDF write failed, `warning` set) leaves
     the modal open with a `ValidationSuccessPanel` showing the written
     path(s), the warning, and an "Afficher dans le dossier" button
     (`revealInFolder`, via `shell:show-item-in-folder`) using the HTML path; a
     **full** success (both HTML and PDF paths present, no error) instead
     **auto-closes** the modal and fires the injected
     `onFullValidationSuccess({company, position, htmlPath, pdfPath})`
     callback, which `App.tsx` uses to (1) append one new assistant message to
     the SAME `useChat.messages` conversation (`shared/resumeAttachmentMessage.ts`,
     rendered by `ChatPage` as a distinct card with its own
     `shell:show-item-in-folder` reveal button, PDF path preferred) and (2) run
     a pure match-or-create decision (`shared/candidatureMatch.ts`) against
     `candidature.config.applications` — updating the matched entry's
     `resume_path` (trimmed/case-insensitive `company`+`position` match) via
     the existing `updateItem`, or appending a new entry with sane defaults via
     the existing `addItem` when none matches. A further regeneration round
     clears the success state (a new round invalidates the prior validation).
     See `docs/ipc.md`.
