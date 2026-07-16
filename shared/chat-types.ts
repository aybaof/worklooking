/**
 * Origin of a chat message. Absent = a visible free-form chat turn (default);
 * `"feedback"` = a hidden CV feedback-loop turn (regeneration/validation prompt
 * or its assistant reply). Hidden turns are filtered out of the rendered chat
 * (`ChatPage`) but are ALWAYS kept in the history sent to the model. The marker
 * carries no PII — it is an enum only.
 */
export type MessageOrigin = "chat" | "feedback";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_call_id?: string;
  origin?: MessageOrigin;
}

export interface ChatUpdatePayload {
  content: string;
}

export interface ToolStatusPayload {
  name: string;
  status: "start" | "end";
  args?: Record<string, unknown>;
  result?: unknown;
}
