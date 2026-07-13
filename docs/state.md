# State Management

**Approach:** custom hooks + local React state + `localStorage`. No global state library.

- **Hooks** own state, side effects (IPC, `localStorage`).
- **Pages** consume hooks and pass data/callbacks down.
- **Components** are thin rendering layers.

## Hooks (`src/hooks/`)

| Hook | Responsibility |
| ---- | -------------- |
| `useChat` | Message history, typing state, AI stream handling. Owns the authoritative feedback-loop conversation; exposes `sendFeedbackMessage` (continues the same conversation for regeneration/validation) and `onTailoredResume` (opens the feedback modal when `ai:chat` returns `updatedResume`) |
| `useSettings` | API key, provider preset, base URL, model, custom wire protocol, user data path |
| `useResume` | Load/save/update resume JSON |
| `useCandidatureConfig` | Job application criteria and history |
| `useOnboarding` | First-run onboarding flow |
| `useTemplateSelection` | Selected resume theme |
| `useTheme` | App UI appearance mode (light/dark/system), `.dark` class + OS `matchMedia` subscription |
| `useFeedbackLoop` | CV feedback loop **as an in-app modal in the main window** (single-window design): holds the current tailored resume, draft per-section comments, round, and themed preview. Drives regeneration/validation by continuing the SAME conversation via `useChat.sendFeedbackMessage` — never calls `ai:chat` directly. The conversation history lives in `useChat`; the hook holds only ephemeral loop state (comments/round/preview) |

## Persistence

| Data | Storage key / location | Owner hook |
| ---- | ---------------------- | ---------- |
| API key | `localStorage` (`opencode_api_key`) | `useSettings` |
| Model | `localStorage` (`opencode_model`) | `useSettings` |
| Provider preset | `localStorage` (`worklooking_provider`) | `useSettings` |
| Base URL | `localStorage` (`worklooking_base_url`) | `useSettings` |
| Custom wire protocol | `localStorage` (`worklooking_custom_api`, `openai`\|`anthropic`) | `useSettings` |
| User data path | `localStorage` (`worklooking_data_path`) + main process | `useSettings` |
| Resume JSON | `localStorage` | `useResume` |
| Candidature config | `localStorage` | `useCandidatureConfig` |
| Selected theme | `localStorage` | `useTemplateSelection` |
| App theme | `localStorage` (`worklooking_theme`, `light`\|`dark`\|`system`) | `useTheme` |
| Chat messages / feedback-loop conversation history | React `useState` (ephemeral) | `useChat` |
| Feedback-loop draft comments + round + preview | React `useState` only (ephemeral; not persisted) | `useFeedbackLoop` (main window modal) |
| Validated resume (after Valider) | persisted to `localStorage` via `setResumeByAi` | `useResume` |

## Data flow

1. Hook encapsulates state + effects (IPC calls, `localStorage` read/write).
2. Page calls the hook, wires data + callbacks to UI components.
3. Components render and raise events; they hold minimal/no business logic.

## Rules

- Prefer local state. Avoid prop drilling beyond 2 levels.
- Use Context only for truly app-wide concerns (theme, auth, app config).
- New business logic goes in a hook, not a component.
