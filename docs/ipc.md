# IPC Communication

All renderer↔main communication is typed and centralized in `shared/ipc.ts`.

## Contract (`shared/ipc.ts`)

- `Channels` — `const` map of channel name constants (`domain:action`).
- `IPCHandlers` — maps each channel to its `{ request, response }` shape.
- `ErrorCodes` — known error code constants.
- `IPCError` — `{ code, message }` error contract.

## Channels (`window.api.invoke`)

| Channel | Direction | Purpose |
| ------- | --------- | ------- |
| `app:get-user-data-path` | R → M | Get current user data directory |
| `app:set-user-data-path` | R → M | Change user data directory |
| `dialog:select-folder` | R → M | Native folder picker |
| `dialog:select-file` | R → M | Native file picker (optional filters) |
| `file:read` | R → M | Read file from user data dir |
| `file:write` | R → M | Write file to user data dir |
| `image:select-and-optimize` | R → M | Pick + optimize an image (sharp), returns data URL |
| `resume:render-preview` | R → M | Render resume JSON to HTML for a theme |
| `resume:generate-final` | R → M | Deterministically write the final resume HTML + PDF (Valider) |
| `shell:show-item-in-folder` | R → M | Reveal a previously-written file in the OS file explorer |
| `ai:chat` | R → M | Send messages to the AI agent (runs tool loop) |
| `ai:test-connection` | R → M | Validate provider `baseURL`/`apiKey`/`model` with a tiny request |

> The CV feedback loop's REGENERATION rounds reuse `ai:chat` and
> `resume:render-preview` from the main window (no second `BrowserWindow`).
> VALIDATION ("Valider"), however, adds two new channels —
> `resume:generate-final` and `shell:show-item-in-folder` — so the final write
> never depends on the LLM deciding to call a tool. See the flow below.

## Events (`window.api.on`)

| Event | Direction | Purpose |
| ----- | --------- | ------- |
| `chat:update` | M → R | Stream partial AI responses |
| `tool:status` | M → R | Notify tool execution start/end |

## Adding a channel (workflow)

1. Add the constant to `Channels` in `shared/ipc.ts`.
2. Add its `{ request, response }` entry to `IPCHandlers`.
3. Implement `ipcMain.handle(Channels.X, ...)` in `electron/main.ts`.
   - Validate/sanitize all input (see `validateAndSanitizePath` in `main.ts`).
   - Return a typed response; throw/return typed errors using `ErrorCodes`.
4. Call it from a hook via `window.api.invoke("domain:action", payload)`.

> Handler references: handlers are registered in `electron/main.ts` (e.g. `Channels.FILE_READ` ~L394, `Channels.AI_CHAT` ~L957).

## AI tool loop (`ai:chat`)

The `ai:chat` handler in `electron/main.ts` runs a provider-agnostic function-calling loop:

1. Receives `messages`, `apiKey`, `model`, `baseURL`, `api` (`"openai" | "anthropic"`),
   `resume`, `candidature`, `selectedTheme`.
2. Builds the system prompt via `GenerateSystemPrompt` (`electron/agent/prompt.ts`).
3. Delegates the chat loop to `AiClientRouter.getInstance().runChat(api, …)`
   (`electron/agent/aiClient.ts`), which selects the OpenAI or Anthropic adapter.
4. The adapter drives the tool loop, calling back into the `runTool` callback, which
   invokes `executeTool()` (`main.ts` ~L714) for each tool from `electron/agent/tools.ts`.
   The `ai:chat` handler delegates to a shared `runChatLoop` helper.
5. Streams progress via `chat:update` and `tool:status`.
6. Returns final response with optional `updatedResume` / `updatedConfig` /
   `company` / `position` (the latter two captured from a `render_resume_html`
   call, if any, during the turn).

## CV feedback loop (single-window, in-app modal)

The feedback loop runs **inside the main window as a modal overlay** — there is
no second `BrowserWindow`. An earlier two-window design was dropped because the
second window's lifecycle (open/flash/close, event routing, double-mount of the
full app) was unreliable; the modal keeps everything in one renderer and reuses
the existing conversation directly.

1. When `useChat` runs a tailoring turn (`ai:chat`) that returns `updatedResume`,
   the main renderer opens the feedback modal via `onTailoredResume` (`App` sets
   `feedbackResume`, `feedbackCompany`, `feedbackPosition`). The proposal is
   **purely ephemeral** — nothing is persisted here. `updatedResume` is produced
   by the write-free **`render_resume_html`** tool (the CV-*proposal* step):
   its `executeTool` case renders the resume to HTML via `renderResume`
   **without writing any file** and sets `updatedResume = args.resumeJson`
   (in-memory only) on success, but not on a render failure. The tool ALSO
   requires `company`/`position` (non-PII strings from the job-offer context);
   `executeTool` captures them and they flow back through `runChatLoop` →
   `ai:chat`'s response → `useChat.runTurn`/`onTailoredResume` so the app knows
   which candidature folder Valider should write to (see step 4). Before
   rendering, both `render_resume_html` and `generate_resume_files` call
   `restoreBasicsPii()` to restore **only** the true PII fields
   (`name`/`email`/`phone`/`url`/`image`/`location`/`profiles`) from the source
   resume while **preserving** the model-tailored `summary` and `label` from the
   proposal — so a profile/summary comment is reflected in both the preview and
   the final HTML/PDF (see `docs/agent.md` → PII handling). The
   write-only **`generate_resume_files`** tool does **not** set `updatedResume`
   (it remains available for OTHER, non-Valider "generate files" requests in
   free-form chat, unchanged). `save_source_resume` (base-CV only) also does
   **not** set `updatedResume` and never opens the modal. Only a free-form
   `handleSend` tailoring turn fires `onTailoredResume`; the regeneration
   rounds go through `sendFeedbackMessage`, which does **not** re-open the
   modal.
2. `useFeedbackLoop` (in the main window) seeds from that resume (and
   `company`/`position`) and renders the themed preview via
   `resume:render-preview`. The **conversation history stays in `useChat`**
   (single authoritative owner in the renderer).
3. Each REGENERATION round, the modal compiles the PII-free French message
   (`shared/feedbackMessages.ts`) and calls `useChat.sendFeedbackMessage`, which
   **appends** the message to the SAME conversation and re-runs `ai:chat` (one
   implementation, not a duplicate). The message includes a **non-authoritative**
   French scoping hint telling the LLM to change ONLY the commented sections and
   leave the rest (incl. personal info) unchanged. The agent re-proposes via
   `render_resume_html` (still write-free), so the round returns a new
   `updatedResume` (and, if supplied again, `company`/`position` — `useFeedbackLoop`
   keeps the LATEST non-empty values across rounds). Progress/lock UX uses
   `useChat.activeTool` driven by `chat:update` / `tool:status`.
   The raw `updatedResume` is **never applied verbatim**. `useFeedbackLoop`
   applies a **deterministic section-scoped merge** (`shared/resumeMerge.ts`,
   `mergeScopedResume(preRegen, updatedResume, comments)`): only the commented
   sections are taken from the LLM output; every other section, the entire
   `basics` block (PII), `meta`, and any unknown top-level key are restored
   verbatim from the pre-regen resume. `summary` maps ONLY to `basics.summary`.
   This is the source of truth regardless of LLM compliance with the prompt hint.
   The round diff shown in `RoundDiffPanel` is computed against the **merged**
   resume (`diffResumes(preRegen, merged)`), grouped by section, and flags
   commented sections the LLM left unchanged. The merged resume replaces the
   preview and comments are cleared. Regeneration is ephemeral — nothing is
   persisted mid-loop.
4. **Validate is deterministic — no LLM round-trip.** `useFeedbackLoop.validate()`
   calls `resume:generate-final` directly with `{ resumeJson, company, position,
   themeName }`; there is no `sendFeedbackMessage`/`ai:chat` call at all. The
   handler derives the candidature folder SERVER-SIDE via
   `deriveCandidatureFolderSegment` (`electron/lib/candidature-folder.ts` — pure,
   traversal-safe sanitizer; see below), builds the SAME relative
   `candidatures/<segment>/resume.html` / `.../resume.pdf` paths the
   `generate_resume_files` tool uses, and calls the SAME shared
   `generateResumeArtifacts()` render/write/`restoreBasicsPii` helper `main.ts`
   also uses for that tool (no duplicated logic). Three outcomes:
   - **Blocked**: if `company`/`position` are empty/blank (e.g. the model never
     supplied them), `validate()` makes **no** IPC call, sets an inline French
     error, and leaves the modal open/retryable.
   - **Error**: `success: false` (or a rejected call) sets an inline French
     error; the modal stays open and Valider is retryable.
   - **Success**: `onValidated` persists the resume via
     `useResume.setResumeByAi`, but the modal does **NOT** auto-close — a
     `ValidationSuccessPanel` shows the written path(s) (plus any
     partial-PDF-failure warning) and an "Afficher dans le dossier" button
     (`revealInFolder`) that invokes the new `shell:show-item-in-folder`
     channel with the PDF path if present, else the HTML path. Closing is now a
     distinct user action. A further regeneration round clears the success
     state (a new round invalidates the prior validation).
   Re-validating for the SAME `company`/`position` overwrites the same folder
   (no dated/duplicate folders), matching the existing one-folder-per-
   application convention.

The regeneration message carries **only section labels + user comments** (plus
the fixed French scoping hint) — never resume PII field values — consistent
with the prompt PII-stripping described in `docs/agent.md`. `company`/
`position` are plain, non-PII strings (already known to the model from the
job-offer context) and are fine to thread through `ai:chat`'s response and the
`resume:generate-final` request. The scoped merge and the round diff run in the
renderer AFTER the reply; their values may hold PII but are used for in-modal
display / local application only and never flow into a prompt.

## Provider connection test (`ai:test-connection`)

`AiClientRouter.getInstance().testConnection(api, …)` issues a minimal request against the
configured `baseURL` / `apiKey` / `model` (`api` picks the OpenAI or Anthropic adapter) and
returns `{ success, error? }`. Handler in `electron/main.ts` ~L978.
