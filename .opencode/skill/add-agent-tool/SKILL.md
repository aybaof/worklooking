---
name: add-agent-tool
description: Use when adding or editing a tool for WorkLooking's SHIPPED in-app AI assistant — an OpenAI function tool in electron/agent/tools.ts wired into the executeTool loop in electron/main.ts. Front-load keywords: agent tool, OpenAI function tool, electron/agent/tools.ts, executeTool, ai:chat tool loop, function calling, read_file/write_file/generate_resume_files tool.
---

# Add an agent tool (shipped product assistant)

Full reference: [`docs/agent.md`](../../../docs/agent.md). This skill is the step list.

> This edits the **product's** shipped French job-search assistant in `electron/agent/`,
> NOT the dev-workflow `AGENTS.md`. Tool descriptions here are written in **French** to
> match the assistant.

## Steps

1. **Define the tool schema** in `electron/agent/tools.ts`:
   - Append an entry to the `tools` array (`OpenAI.Chat.ChatCompletionTool[]`).
   - Set `function.name`, a **French** `description`, JSON-schema `parameters`, and `required`.
   - Follow the existing entries (`read_file`, `write_file`, `generate_resume_files`, …).

2. **Implement execution** in `executeTool()` in `electron/main.ts` (~L533):
   - Add a `case "<tool_name>":` to the `switch (name)`.
   - Validate `args`; sanitize any file path with `validateAndSanitizePath(...)`.
   - Set `result` to what the model should see back.
   - If the tool changes the resume/config, also set `updatedResume` / `updatedConfig`
     (they are returned from the loop and propagate to the renderer).

3. **Document behavior** (if user-facing) in `electron/agent/agent.md`, in French,
   matching the surrounding tone and sections.

## PII rule

`electron/agent/prompt.ts` strips personal fields from the LLM context and restores them
when generating resume files. Do **not** re-add PII to the prompt or tool descriptions.

## Verify

- Type-check (`strict`) — no `any` in your handler logic where avoidable.
- `npm run dev`, open the chat, and confirm the model calls the tool and the
  `tool:status` / `chat:update` events fire. See [`docs/ipc.md`](../../../docs/ipc.md).
