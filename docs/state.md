# State Management

**Approach:** custom hooks + local React state + `localStorage`. No global state library.

- **Hooks** own state, side effects (IPC, `localStorage`).
- **Pages** consume hooks and pass data/callbacks down.
- **Components** are thin rendering layers.

## Hooks (`src/hooks/`)

| Hook | Responsibility |
| ---- | -------------- |
| `useChat` | Message history, typing state, AI stream handling |
| `useSettings` | API key, selected model, user data path |
| `useResume` | Load/save/update resume JSON |
| `useCandidatureConfig` | Job application criteria and history |
| `useOnboarding` | First-run onboarding flow |
| `useTemplateSelection` | Selected resume theme |

## Persistence

| Data | Storage key / location | Owner hook |
| ---- | ---------------------- | ---------- |
| API key | `localStorage` | `useSettings` |
| Model | `localStorage` | `useSettings` |
| User data path | `localStorage` | `useSettings` |
| Resume JSON | `localStorage` | `useResume` |
| Candidature config | `localStorage` | `useCandidatureConfig` |
| Selected theme | `localStorage` | `useTemplateSelection` |
| Chat messages | React `useState` | `useChat` |

## Data flow

1. Hook encapsulates state + effects (IPC calls, `localStorage` read/write).
2. Page calls the hook, wires data + callbacks to UI components.
3. Components render and raise events; they hold minimal/no business logic.

## Rules

- Prefer local state. Avoid prop drilling beyond 2 levels.
- Use Context only for truly app-wide concerns (theme, auth, app config).
- New business logic goes in a hook, not a component.
