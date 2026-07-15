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

The tools are executed by `executeTool()` in `electron/main.ts` (~L535). The chat loop
itself is driven by `AiClientRouter` (`aiClient.ts`), which `main.ts` calls from the
`ai:chat` handler and passes a `runTool` callback into. See `docs/ipc.md`.

`aiClient.ts` also exports a few pure helpers (used by the provider adapters and by
the unit tests): `normalizeAnthropicBaseURL`, `isAzureEndpoint`, and
`toAnthropicTools` (maps the OpenAI tool defs → Anthropic tool schema).

## Tools (`electron/agent/tools.ts`)

Exactly 8 tools are defined, each with a **French** description:

| Tool | Purpose |
| ---- | ------- |
| `read_file` | Read a local file (relative or absolute path). |
| `write_file` | Create/update a file in the user data dir (auto-creates parent dirs). |
| `save_candidature_config` | Persist the full `CandidatureConfig` (profile/tracking). |
| `render_resume_html` | **Propose** a tailored CV: render resume JSON → HTML **without writing any file**. Returns only a size/summary (not the full HTML) and sets `updatedResume` in-memory, which opens the feedback modal. The pre-validation proposal step. |
| `generate_resume_files` | Render resume JSON → HTML + PDF at given paths (write-only). The final step, called only after the user validates. Does **not** set `updatedResume`. |
| `save_source_resume` | Save the main source resume (base CV only). |
| `fetch_url` | Fetch text content of a URL (persistent session; may return `needsAuth`). |
| `read_pdf` | Extract text from a PDF (absolute path). |

Each has a matching `case` in `executeTool()` (`electron/main.ts`) — the switch handles
these exact 8 names and no others.

### Resume-tailoring flow

The tailoring loop is a purely conversational, ephemeral proposal step — nothing is
written to disk until the user validates:

1. The agent **proposes** the tailored CV by calling `render_resume_html`, which renders
   the HTML preview **without writing any file** and sets `updatedResume` (in-memory).
2. `ai:chat` returns that `updatedResume`, which opens the in-app **feedback modal** where
   the user reviews the proposal and can leave per-section comments (regeneration rounds
   re-call `render_resume_html`, still write-free).
3. On **Valider**, a confirmation message drives the agent to call `generate_resume_files`,
   which writes the final HTML + PDF to disk; the resume is then persisted. See
   `docs/ipc.md` → "CV feedback loop".

## Adding an agent tool (workflow)

1. **Define** the tool schema in `electron/agent/tools.ts` (name, description, JSON-schema `parameters`, `required`).
2. **Implement** its execution inside `executeTool()` in `electron/main.ts`:
   - Match on the tool name, validate args, run it, return a result string.
   - If it mutates resume/config, return `updatedResume` / `updatedConfig`.
   - Sanitize any file paths (reuse `validateAndSanitizePath`).
3. **Document** it (if user-facing behavior) in `electron/agent/agent.md`, keeping the French tone.
4. Descriptions in `tools.ts` are French to match the assistant — keep it consistent.

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
