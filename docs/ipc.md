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
| `ai:chat` | R → M | Send messages to the AI agent (runs tool loop) |
| `ai:test-connection` | R → M | Validate provider `baseURL`/`apiKey`/`model` with a tiny request |

> The CV feedback loop adds **no new IPC channels** — it reuses `ai:chat` and
> `resume:render-preview` from the main window. See the flow below.

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

> Handler references: handlers are registered in `electron/main.ts` (e.g. `Channels.FILE_READ` ~L394, `Channels.AI_CHAT` ~L698).

## AI tool loop (`ai:chat`)

The `ai:chat` handler in `electron/main.ts` runs a provider-agnostic function-calling loop:

1. Receives `messages`, `apiKey`, `model`, `baseURL`, `api` (`"openai" | "anthropic"`),
   `resume`, `candidature`, `selectedTheme`.
2. Builds the system prompt via `GenerateSystemPrompt` (`electron/agent/prompt.ts`).
3. Delegates the chat loop to `AiClientRouter.getInstance().runChat(api, …)`
   (`electron/agent/aiClient.ts`), which selects the OpenAI or Anthropic adapter.
4. The adapter drives the tool loop, calling back into the `runTool` callback, which
   invokes `executeTool()` (`main.ts` ~L467) for each tool from `electron/agent/tools.ts`.
   The `ai:chat` handler delegates to a shared `runChatLoop` helper.
5. Streams progress via `chat:update` and `tool:status`.
6. Returns final response with optional `updatedResume` / `updatedConfig`.

## CV feedback loop (single-window, in-app modal)

The feedback loop runs **inside the main window as a modal overlay** — there is
no second `BrowserWindow`. An earlier two-window design was dropped because the
second window's lifecycle (open/flash/close, event routing, double-mount of the
full app) was unreliable; the modal keeps everything in one renderer and reuses
the existing conversation directly.

1. When `useChat` runs a tailoring turn (`ai:chat`) that returns `updatedResume`,
   the main renderer opens the feedback modal via `onTailoredResume` (`App` sets
   `feedbackResume`). The proposal is **purely ephemeral** — nothing is persisted
   here. `updatedResume` is produced by the write-free **`render_resume_html`**
   tool (the CV-*proposal* step): its `executeTool` case renders the resume to
   HTML via `renderResume` **without writing any file** and sets `updatedResume =
   args.resumeJson` (in-memory only) on success, but not on a render failure. The
   write-only **`generate_resume_files`** tool does **not** set `updatedResume`
   (it writes the final HTML + PDF to disk and is called only after validation, so
   the validation-triggered generation cannot re-open the modal).
   `save_source_resume` (base-CV only) also does **not** set `updatedResume` and
   never opens the modal. Only a free-form `handleSend` tailoring turn fires
   `onTailoredResume`; the regeneration/validation rounds go through
   `sendFeedbackMessage`, which does **not** re-open the modal.
2. `useFeedbackLoop` (in the main window) seeds from that resume and renders the
   themed preview via `resume:render-preview`. The **conversation history stays
   in `useChat`** (single authoritative owner in the renderer).
3. Each round, the modal compiles the PII-free French message
   (`shared/feedbackMessages.ts`) and calls `useChat.sendFeedbackMessage`, which
   **appends** the message to the SAME conversation and re-runs `ai:chat` (one
   implementation, not a duplicate). The agent re-proposes via `render_resume_html`
   (still write-free), so the round returns a new `updatedResume`. Progress/lock
   UX uses `useChat.activeTool` driven by `chat:update` / `tool:status`. The new
   resume replaces the preview and comments are cleared. Regeneration is
   ephemeral — nothing is persisted mid-loop.
4. Validate compiles the French validation message and runs the same turn, which
   triggers `generate_resume_files` (the write-only step that produces the final
   HTML + PDF and returns **no** `updatedResume`). On success the modal persists
   the last-proposed resume via `useResume.setResumeByAi` and closes. Validation
   is retryable (the modal stays open on error). Persistence therefore happens
   only here — never on the intermediate proposals.

The regeneration/validation messages carry **only section labels + user
comments** — never resume PII field values — consistent with the prompt
PII-stripping described in `docs/agent.md`.

## Provider connection test (`ai:test-connection`)

`AiClientRouter.getInstance().testConnection(api, …)` issues a minimal request against the
configured `baseURL` / `apiKey` / `model` (`api` picks the OpenAI or Anthropic adapter) and
returns `{ success, error? }`. Handler in `electron/main.ts` ~L719.
