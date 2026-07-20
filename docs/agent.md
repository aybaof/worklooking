# Shipped AI Agent (Product)

> This is the **product's** in-app assistant — a French job-search assistant that
> tailors resumes and manages applications. It is **not** the dev-workflow agent.
> Do not confuse `electron/agent/agent.md` with the root `AGENTS.md`.

## Files (`electron/agent/`)

| File | Role |
| ---- | ---- |
| `agent.md` | Instructions for the shipped assistant (French). Bundled via Forge `extraResource`. |
| `prompt.ts` | Builds the system prompt (injects source resume + config, strips PII). |
| `tools.ts` | OpenAI function-tool definitions the agent can call. |
| `aiClient.ts` | `AiClientRouter` — provider adapters (OpenAI Chat Completions + Anthropic Messages) behind one interface; runs the chat/tool loop and connection tests. |

The tools are executed by `executeTool()` in `electron/main.ts` (~L981). The chat loop
itself is driven by `AiClientRouter` (`aiClient.ts`), which `main.ts` calls from the
`ai:chat` handler and passes a `runTool` callback into. See `docs/ipc.md`.

`aiClient.ts` also exports a few pure helpers (used by the provider adapters and by
the unit tests): `normalizeAnthropicBaseURL`, `isAzureEndpoint`, and
`toAnthropicTools` (maps the OpenAI tool defs → Anthropic tool schema).

## Tools (`electron/agent/tools.ts`)

Exactly 10 tools are defined, each with a **French** description:

| Tool | Purpose |
| ---- | ------- |
| `read_file` | Read a local file (relative or absolute path). |
| `write_file` | Create/update a file in the user data dir (auto-creates parent dirs). |
| `save_candidature_config` | Persist the full `CandidatureConfig` (profile/tracking). |
| `render_resume_html` | **Propose** a tailored CV: render resume JSON → HTML **without writing any file**. Requires `company`/`position` (non-PII strings from the job-offer context) alongside `resumeJson` — they name the candidature folder automatically when the user later validates. Returns only a size/summary (not the full HTML) and sets `updatedResume` in-memory, which opens the feedback modal. The pre-validation proposal step. |
| `generate_resume_files` | Render resume JSON → HTML + PDF at given paths (write-only). The final step, called only after the user validates. Does **not** set `updatedResume`. |
| `save_source_resume` | Save the main source resume (base CV only). |
| `fetch_url` | Fetch text content of a URL (persistent session). On a stuck/likely-login page, falls back to a visible browser window so the user can log in; clicking "Continuer" closes that window and re-checks the original page, returning its content. If login still isn't complete after that one re-check, fails with `FETCH_LOGIN_INCOMPLETE` (one shot, no retry loop); `needsAuth`/`FETCH_NEEDS_AUTH` is no longer returned for these cases (only genuine hard failures return an error immediately). |
| `read_pdf` | Extract text from a PDF (absolute path). |
| `analyze_job_offer` | **Specialist** tool: extracts a compact structured summary (company/position/seniority/keyRequirements/keywords/summary) from a job offer given as `url` OR `text` (exactly one). Internally runs its own `runSubAgent()` loop with a narrow tool subset (`fetch_url`/`read_pdf`); never returns raw scraped text. See "Specialist sub-agent tools" below. |
| `write_motivation_letter` | **Specialist** tool: drafts French motivation-letter text (~250–400 words) from an already-available `resumeExcerpt`/`offer`/`company`/`position`. Returns letter text only (never a file); saving to disk is a separate, later `write_file` call. See "Specialist sub-agent tools" below. |

Each has a matching `case` in `executeTool()` (`electron/main.ts`) — the switch handles
these exact 10 names and no others.

Two families of tools coexist: **flat direct-execution tools** (the original 8 —
`read_file`, `write_file`, `save_candidature_config`, `render_resume_html`,
`generate_resume_files`, `save_source_resume`, `fetch_url`, `read_pdf`) run
synchronously in one `executeTool()` case with no nested LLM call; vs.
**specialist sub-agent tools** (`analyze_job_offer`, `write_motivation_letter`) each
internally run their own separate, narrow `runSubAgent()` tool-calling loop before
resolving. See below.

### Specialist sub-agent tools (`runSubAgent()`)

`runSubAgent()` (`electron/agent/subAgent.ts`) is a reusable helper for tools that need
their own short, silent, narrow tool-calling loop, layered on top of the same
`AiClientRouter` used by the main orchestrator loop:

- **Provider-agnostic:** delegates entirely to `AiClientRouter.getInstance().runChat()` —
  no provider-specific code of its own. `ChatRunOptions` gained two optional fields to
  make this possible: `maxRounds` (caps provider round-trips; `undefined` preserves the
  main loop's existing unbounded behavior) and `toolDefs` (an override of the tool
  schema list sent to the provider, defaulting to the full `tools` export when omitted).
  `ChatRunResult` gained `cappedOut?: boolean`.
- **5-round hard cap:** `SUB_AGENT_MAX_ROUNDS = 5`. If the specialist hasn't produced a
  final (non-tool-call) answer within 5 provider round-trips, `runSubAgent()` aborts
  before a 6th request is made and returns `{ success: false, error }`.
- **Never throws:** hard provider/network errors and hitting the round cap both resolve
  to a structured `{ success: false, error }` result — the calling `executeTool()` case
  never needs a try/catch around `runSubAgent()` itself to stay safe.
- **Isolated message history:** only the specialist's own single task input (built by
  the calling `executeTool()` case), never the full user-visible conversation.
- **Silent by design:** `SubAgentOptions` carries no `event`/`IpcMainInvokeEvent`/
  renderer-facing field at all, and `emitText` passed to the underlying provider call is
  a literal no-op — nested specialist rounds never reach `chat:update`/`tool:status`.
  Only the top-level orchestrator narrates to the user.
- **Narrow `allowedTools`:** each specialist's `runTool` is wrapped in a guard that
  rejects any tool name outside `allowedTools` (defense-in-depth alongside the
  `toolDefs` schema restriction), and neither specialist's `allowedTools` may include
  the other specialist's name (no specialist-to-specialist calling — exactly one level
  of nesting: orchestrator → specialist → base tool).
- Each specialist's own narrow French system prompt lives in
  `electron/agent/specialistPrompts.ts` (`buildAnalyzeJobOfferPrompt`,
  `buildWriteMotivationLetterPrompt`), kept separate from `prompt.ts` (the main
  orchestrator's system prompt builder).

### Resume-tailoring flow

The tailoring loop is a purely conversational, ephemeral proposal step — nothing is
written to disk until the user validates:

1. The agent **proposes** the tailored CV by calling `render_resume_html` (now with
   required `company`/`position`, in addition to `resumeJson`), which renders the HTML
   preview **without writing any file** and sets `updatedResume` (in-memory). The
   `company`/`position` values flow back to the renderer via `ai:chat`'s response.
2. `ai:chat` returns that `updatedResume` (+ `company`/`position`), which opens the
   in-app **feedback modal** where the user reviews the proposal and can leave
   per-section comments (regeneration rounds re-call `render_resume_html`, still
   write-free).
3. On **Valider**, the app writes the final HTML + PDF **deterministically** —
   directly from the renderer via the `resume:generate-final` IPC channel, with
   NO LLM involvement — using the `company`/`position` captured in step 1/2 to
   name the candidature folder; the resume is then persisted. `generate_resume_files`
   remains available and unchanged for OTHER, non-Valider "generate files" requests a
   user may make in free-form chat. See `docs/ipc.md` → "CV feedback loop".

## Adding an agent tool (workflow)

1. **Define** the tool schema in `electron/agent/tools.ts` (name, description, JSON-schema `parameters`, `required`).
2. **Implement** its execution inside `executeTool()` in `electron/main.ts`:
   - Match on the tool name, validate args, run it, return a result string.
   - If it mutates resume/config, return `updatedResume` / `updatedConfig`.
   - Sanitize any file paths (reuse `validateAndSanitizePath`).
3. **Document** it (if user-facing behavior) in `electron/agent/agent.md`, keeping the French tone.
4. Descriptions in `tools.ts` are French to match the assistant — keep it consistent.

> Building a **specialist** tool that needs its own scoped, capped, silent sub-loop
> instead of executing directly? Reuse `runSubAgent()` — see "Specialist sub-agent
> tools" above rather than hand-rolling a one-off tool-calling loop.

## PII handling

`prompt.ts` (`GenerateSystemPrompt`) rebuilds `basics` to keep **only** `summary` and
`label`, dropping every other `basics` field (name, email, phone, url, image, location,
profiles) from the LLM context. Don't re-add PII to the prompt.

**Restore after the model responds.** When `render_resume_html` (proposal/preview) and
`generate_resume_files` (final write) run, `restoreBasicsPii()` (in `electron/main.ts`,
list kept in sync with `prompt.ts`) restores **only the true PII fields** —
`name`, `email`, `phone`, `url`, `image`, `location`, `profiles` — from the source resume.
It **preserves** the model-tailored `summary` and `label` from the proposal (these are the
two fields intentionally kept in the model context so they can be adapted). This is why a
profile/summary comment in the feedback loop now takes effect: the tailored
`basics.summary`/`basics.label` are no longer reverted to the source. The same restore
logic runs in both tools so the preview and the final HTML/PDF stay consistent. Note the
restore only affects what the model receives *back*; the model still never *receives* PII.
