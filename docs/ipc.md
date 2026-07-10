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

> Handler references: handlers are registered in `electron/main.ts` (e.g. `Channels.FILE_READ` ~L459, `Channels.AI_CHAT` ~L668).

## AI tool loop (`ai:chat`)

`electron/main.ts` runs an OpenAI function-calling loop:

1. Receives `messages`, `apiKey`, `model`, `resume`, `candidature`, `selectedTheme`.
2. Calls OpenAI with tools from `electron/agent/tools.ts`.
3. Executes each tool call locally via `executeTool()` (`main.ts` ~L533).
4. Streams progress via `chat:update` and `tool:status`.
5. Returns final response with optional `updatedResume` / `updatedConfig`.
