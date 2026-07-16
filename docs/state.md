# State Management

**Approach:** custom hooks + local React state + `localStorage`. No global state library.

- **Hooks** own state, side effects (IPC, `localStorage`).
- **Pages** consume hooks and pass data/callbacks down.
- **Components** are thin rendering layers.

## Hooks (`src/hooks/`)

| Hook | Responsibility |
| ---- | -------------- |
| `useChat` | Message history, typing state, AI stream handling. Owns the authoritative feedback-loop conversation; exposes `sendFeedbackMessage` (continues the same conversation for regeneration/validation) and `onTailoredResume` (opens the feedback modal when `ai:chat` returns `updatedResume`). `runTurn(userMessage, origin)` tags each turn with a `Message.origin` marker; feedback turns are stamped `"feedback"` (user + assistant reply, streamed chunks via a `currentTurnOriginRef`) so `ChatPage` can hide them while the full history is still sent to the model |
| `useSettings` | API key, provider preset, base URL, model, custom wire protocol, user data path |
| `useResume` | Load/save/update resume JSON |
| `useCandidatureConfig` | Job application criteria and history |
| `useOnboarding` | First-run onboarding flow |
| `useTemplateSelection` | Selected resume theme (`selectedTheme`/`setSelectedTheme`, persisted to `localStorage`), `availableThemes`, and `renderPreview` (wraps `Channels.RESUME_RENDER_PREVIEW`). `availableThemes`/`renderPreview` are also reused, by injection (no import), by `useFeedbackLoop`/`ThemePickerRail` — no shape change to this hook |
| `useTheme` | App UI appearance mode (light/dark/system), `.dark` class + OS `matchMedia` subscription |
| `useFeedbackLoop` | CV feedback loop **as an in-app modal in the main window** (single-window design): holds the current tailored resume, draft per-section comments, round, themed preview, and the per-round leaf-field diff (`changes`, computed via the pure `shared/resumeDiff.ts` for in-modal display only — never sent into a prompt). On each round it applies a **deterministic section-scoped merge** (`shared/resumeMerge.ts`, `mergeScopedResume`) — only the commented sections come from the LLM output; every other section, all `basics` PII, `meta`, and unknown keys are restored verbatim from the pre-regen resume — so the raw `updatedResume` is never applied directly; the round diff is computed against the merged resume, and `lastRoundCommentedIds` flags LLM no-ops in the panel. Drives regeneration/validation by continuing the SAME conversation via `useChat.sendFeedbackMessage` — never calls `ai:chat` directly. A `seededRef` guards the reseed effect so a validation-returned `updatedResume` cannot re-open/re-seed the closed modal. The conversation history lives in `useChat`; the hook holds only ephemeral loop state (comments/round/preview/changes). **Owns a modal-local `selectedTheme`** (not a fixed prop): seeded from a `defaultTheme` option (the app-wide `templateSelection.selectedTheme` at the time) on the SAME `seededRef`-guarded reseed effect as comments/round/etc., so it tracks the current app-wide default each time a NEW tailored resume opens the modal but is otherwise free to diverge as the user picks themes in `ThemePickerRail`; the main preview effect and `validate()`'s `resume:generate-final` call both use this local value via an injected `renderPreview` (reused from `useTemplateSelection`, no duplicated `Channels.RESUME_RENDER_PREVIEW` call site). On a successful `validate()` only, it calls the injected `onThemeValidated(themeId)` callback (wired in `App.tsx` to `templateSelection.setSelectedTheme`) to promote the chosen theme to the app-wide default — a plain theme switch, a blocked/failed/rejected Valider, `submitComments`, or closing the modal never touch the app-wide default |

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
| Feedback-loop modal-local theme selection | React `useState` only (ephemeral; not `localStorage`); promoted to the persisted `Selected theme` entry above ONLY on a successful Valider (via `onThemeValidated` → `templateSelection.setSelectedTheme`) | `useFeedbackLoop` (main window modal) |
| Validated resume (after Valider) | persisted to `localStorage` via `setResumeByAi` | `useResume` |

## Data flow

1. Hook encapsulates state + effects (IPC calls, `localStorage` read/write).
2. Page calls the hook, wires data + callbacks to UI components.
3. Components render and raise events; they hold minimal/no business logic.

## Rules

- Prefer local state. Avoid prop drilling beyond 2 levels.
- Use Context only for truly app-wide concerns (theme, auth, app config).
- New business logic goes in a hook, not a component.
