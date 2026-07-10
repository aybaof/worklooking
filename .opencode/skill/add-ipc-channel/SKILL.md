---
name: add-ipc-channel
description: Use when adding or changing renderer↔main IPC in WorkLooking — a new window.api.invoke channel, ipcMain.handle handler, chat:update/tool:status event, or editing shared/ipc.ts (Channels, IPCHandlers, ErrorCodes). Front-load keywords: IPC channel, window.api.invoke, ipcMain.handle, shared/ipc.ts, preload, main process handler.
---

# Add an IPC channel

Full reference: [`docs/ipc.md`](../../../docs/ipc.md). This skill is the step list.

`shared/ipc.ts` is the single source of truth. The renderer is untrusted — validate
every input in the main process.

## Steps

1. **Declare the channel** in `shared/ipc.ts`:
   - Add a constant to `Channels` using `domain:action` naming (e.g. `RESUME_EXPORT: "resume:export"`).
   - Add its typed `{ request, response }` entry to the `IPCHandlers` interface.
   - If it can fail in new ways, add an `ErrorCodes` constant.

2. **Implement the handler** in `electron/main.ts`:
   - `ipcMain.handle(Channels.X, async (_event, payload) => { ... })`.
   - **Validate/sanitize input.** For any file path, use `validateAndSanitizePath(filePath, USER_DATA_PATH)`.
   - Return a value matching the declared `response` type. Report failures via `ErrorCodes` / the `{ error }` field, not thrown strings.
   - Register handlers next to the existing ones (~L385–520).

3. **Consume it from a hook** (`src/hooks/use*.ts`), never directly from a component:
   - `const res = await window.api.invoke("domain:action", payload);`
   - Handle the `error` field and expose state to the component.

4. **Events (optional, main → renderer):** if the flow streams updates, send with
   `event.sender.send(Channels.CHAT_UPDATE, ...)` and subscribe in the renderer with
   `window.api.on(...)`. See the `ai:chat` loop in `main.ts` (~L668) for the pattern.

## Verify

- Type-check (`strict`): request/response types must line up across `shared/ipc.ts`,
  the handler, and the hook.
- `npm run dev` and exercise the flow. See [`docs/build.md`](../../../docs/build.md).

## Rules

- No `any` — type the payload from `IPCHandlers`.
- Keep security config intact (`contextIsolation`, `sandbox`, `nodeIntegration:false`).
- Business logic stays in the hook; components just render.
