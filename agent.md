# WorkLooking - Technical Conventions

Electron application with TypeScript. React renderer, secure main process.

## Architecture Overview

```
├── electron/           # Main process (Node.js)
│   ├── main.ts         # Entry point, window management, IPC handlers
│   └── preload.ts      # contextBridge API (renderer ↔ main)
├── shared/             # Shared types (imported by both processes)
│   └── ipc.ts          # Channel names, request/response contracts
├── src/                # Renderer process (React)
│   ├── components/     # UI components (render + UX)
│   ├── hooks/          # Business logic
│   ├── pages/          # Route-level components
│   ├── lib/            # Utilities, domain types
│   └── styles/         # Global styles, Tailwind
```

---

## Main Process Security

### BrowserWindow Configuration

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,      // Required
    nodeIntegration: false,      // Required
    preload: path.join(__dirname, 'preload.js'),
    sandbox: true                // Recommended
  }
})
```

### IPC Handler Guidelines

- Validate all inputs from renderer
- Sanitize file paths (prevent directory traversal)
- Never trust renderer data implicitly
- Return typed responses, throw typed errors

```typescript
ipcMain.handle('file:read', async (_, filePath: string) => {
  const safePath = validateAndSanitizePath(filePath);
  if (!safePath) throw new IPCError('INVALID_PATH', 'Path not allowed');
  return fs.readFile(safePath, 'utf-8');
});
```

---

## Shared Types (`shared/ipc.ts`)

Single source of truth for IPC contracts.

```typescript
// Channel definitions
export const Channels = {
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  DIALOG_OPEN: 'dialog:open',
} as const;

// Type-safe request/response mapping
export interface IPCHandlers {
  'file:read': { request: { path: string }; response: string };
  'file:write': { request: { path: string; content: string }; response: void };
  'dialog:open': { request: { type: 'file' | 'folder' }; response: string | null };
}

// Error contract
export interface IPCError {
  code: string;
  message: string;
}
```

### Channel Naming Convention

Pattern: `domain:action`

| Domain | Actions |
|--------|---------|
| `file` | `read`, `write`, `delete` |
| `dialog` | `open`, `save` |
| `app` | `get-path`, `quit` |
| `ai` | `chat`, `cancel` |

---

## Preload Script

Expose typed API via contextBridge.

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IPCHandlers } from '../shared/ipc';

const api = {
  invoke: <K extends keyof IPCHandlers>(
    channel: K,
    payload: IPCHandlers[K]['request']
  ): Promise<IPCHandlers[K]['response']> => {
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
    return () => ipcRenderer.removeListener(channel, callback);
  }
};

contextBridge.exposeInMainWorld('api', api);
```

```typescript
// src/lib/electron.d.ts
declare global {
  interface Window {
    api: typeof import('../../electron/preload').api;
  }
}
```

---

## Renderer Process (React)

### Core Principle

**Separation of concerns:**
- **Hooks** → Business logic, state, side effects
- **Components** → Render output, UX interactions

### Hook Conventions

Hooks own the logic. Components consume the result.

```typescript
// hooks/useUser.ts
export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.api.invoke('user:get', { id })
      .then(setUser)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [id]);

  return { user, error, isLoading };
}
```

### Component Conventions

Components handle rendering and user interactions only.

```typescript
// components/UserCard.tsx
export function UserCard({ userId }: { userId: string }) {
  const { user, error, isLoading } = useUser(userId);

  if (error) return <ErrorFallback error={error} />;
  if (isLoading) return <Skeleton />;

  return (
    <Card>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </Card>
  );
}
```

### State Management

**Prefer local state.** Each component manages its own state via hooks.

Avoid:
- Prop drilling beyond 2 levels
- Provider-heavy architectures
- Global state for local concerns

Use Context only for:
- Theme/appearance
- Authentication state
- App-wide configuration

```typescript
// Acceptable: minimal context for truly global state
const ThemeContext = createContext<'light' | 'dark'>('light');

// Avoid: over-contextualized local state
const FormContext = createContext<FormState>(null); // Don't do this
```

---

## Error Handling

### ErrorBoundary (Route Level)

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
```

### Async Error Pattern

```typescript
// In hooks - catch and expose errors
const [error, setError] = useState<IPCError | null>(null);

try {
  const result = await window.api.invoke('file:read', { path });
  return result;
} catch (e) {
  setError(e as IPCError);
}
```

### IPC Error Handling (Main Process)

```typescript
class IPCError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Handler
ipcMain.handle('file:read', async (_, { path }) => {
  if (!isValidPath(path)) {
    throw new IPCError('INVALID_PATH', 'Access denied');
  }
  // ...
});
```

---

## Code Style

### TypeScript

- `strict: true` in all tsconfig files
- No `any` types (use `unknown` + type guards)
- Explicit return types on exported functions
- Prefer `interface` over `type` for object shapes

### Patterns

- Early returns over nested conditions
- Small, focused functions (< 30 lines)
- Destructure props at function signature
- Colocate types with usage

```typescript
// Good: early return
function getUser(id: string): User | null {
  if (!id) return null;
  if (!cache.has(id)) return null;
  return cache.get(id);
}

// Avoid: nested conditions
function getUser(id: string): User | null {
  if (id) {
    if (cache.has(id)) {
      return cache.get(id);
    }
  }
  return null;
}
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useUser.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types | camelCase with `-types` suffix | `resume-types.ts` |
| IPC Channels | kebab-case domain:action | `file:read` |

---

## Summary

| Concern | Location | Responsibility |
|---------|----------|----------------|
| Security | `electron/main.ts` | contextIsolation, input validation |
| IPC Types | `shared/ipc.ts` | Channel contracts, type safety |
| API Bridge | `electron/preload.ts` | contextBridge exposure |
| Logic | `src/hooks/` | State, effects, business rules |
| Render | `src/components/` | UI output, event handlers |
| Errors | `ErrorBoundary` + typed errors | Graceful degradation |
