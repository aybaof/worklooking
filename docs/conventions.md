# Code Conventions

## TypeScript

- `strict: true` everywhere. **No `any`** — use `unknown` + type guards.
- Explicit return types on exported functions.
- Prefer `interface` for object shapes.
- Colocate types with usage; cross-process types go in `shared/`.

## Patterns

- Early returns over nested conditions.
- Small, focused functions (< 30 lines).
- Destructure props at the function signature.

```typescript
// Good
function getUser(id: string): User | null {
  if (!id) return null;
  if (!cache.has(id)) return null;
  return cache.get(id);
}
```

## File naming

| Type | Convention | Example |
| ---- | ---------- | ------- |
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase, `use` prefix | `useUser.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types | camelCase, `-types` suffix | `resume-types.ts` |
| IPC channels | `domain:action` | `file:read` |

## Renderer separation

- **Hooks** → state, effects, business rules (`src/hooks/`).
- **Components** → render + event handlers (`src/components/`).
- **Pages** → thin route-level composition (`src/pages/`).

## Main process security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Validate and sanitize every input from the renderer (path traversal).
- Return typed responses; throw typed errors (`IPCError` / `ErrorCodes`).

```typescript
ipcMain.handle(Channels.FILE_READ, async (_e, { filePath }) => {
  const safePath = validateAndSanitizePath(filePath, USER_DATA_PATH);
  if (!safePath) throw new IPCError(ErrorCodes.INVALID_PATH, "Path not allowed");
  // ...
});
```

## Error handling

- Route-level `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) + `ErrorFallback`.
- In hooks: catch async errors and expose them as state.

## Language note

The **product** (UI copy and the shipped agent in `electron/agent/`) is primarily **French**. Match existing language when editing product-facing text; keep code identifiers and dev docs in English.
