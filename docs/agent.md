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

The tool loop that executes these tools lives in `electron/main.ts` (`executeTool`, ~L533),
driven by the `ai:chat` channel. See `docs/ipc.md`.

## Tools (`electron/agent/tools.ts`)

Exactly 7 tools are defined, each with a **French** description:

| Tool | Purpose |
| ---- | ------- |
| `read_file` | Read a local file (relative or absolute path). |
| `write_file` | Create/update a file in the user data dir (auto-creates parent dirs). |
| `save_candidature_config` | Persist the full `CandidatureConfig` (profile/tracking). |
| `generate_resume_files` | Render resume JSON → HTML + PDF at given paths. |
| `save_source_resume` | Save the main source resume (base CV only). |
| `fetch_url` | Fetch text content of a URL (persistent session; may return `needsAuth`). |
| `read_pdf` | Extract text from a PDF (absolute path). |

Each has a matching `case` in `executeTool()` (`electron/main.ts`) — the switch handles
these exact 7 names and no others.

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
profiles, …) from the LLM context. Full personal data is **restored automatically** when
tools like `generate_resume_files` run, so generated HTML/PDF contain complete data. Don't
re-add PII to the prompt.
