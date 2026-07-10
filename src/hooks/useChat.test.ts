/**
 * Tier 3 — renderer hook. Mock window.api.invoke + the CHAT_UPDATE / TOOL_STATUS
 * event subscriptions (window.api.on).
 * See tests/TEST_PLAN.md → "Tier 3: useChat".
 */
import { describe, it } from "vitest";
// import { renderHook, act } from "@testing-library/react";
// import { useChat } from "./useChat";

describe("useChat", () => {
  it.todo("appends streamed chunks to the last assistant message");
  it.todo("pushes a new assistant message when appropriate");
  it.todo("formats attachments before sending");
  it.todo("invokes AI_CHAT via window.api and handles the response");
  it.todo("fires updatedResume / updatedConfig callbacks from the response");
  it.todo("subscribes to CHAT_UPDATE and TOOL_STATUS events and cleans up");
});
