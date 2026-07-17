/**
 * Origin of a chat message. Absent = a visible free-form chat turn (default);
 * `"feedback"` = a hidden CV feedback-loop turn (regeneration/validation prompt
 * or its assistant reply). Hidden turns are filtered out of the rendered chat
 * (`ChatPage`) but are ALWAYS kept in the history sent to the model. The marker
 * carries no PII — it is an enum only.
 */
export type MessageOrigin = "chat" | "feedback";

/**
 * Renderer-display metadata for a full-success CV-validation chat message
 * (`buildResumeAttachmentMessage`, `shared/resumeAttachmentMessage.ts`). Purely
 * additive/optional — `content` remains the complete French sentence used for
 * LLM-facing history; `attachment` only lets `src/pages/chat.tsx` render a
 * distinct "attachment" card without re-parsing `content`.
 */
export interface ResumeAttachmentMeta {
  company: string;
  position: string;
  htmlPath?: string;
  pdfPath?: string;
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_call_id?: string;
  origin?: MessageOrigin;
  /**
   * Set ONLY on the one assistant message posted by a FULL `validate()`
   * success (`buildResumeAttachmentMessage`). Absent on every other message.
   */
  attachment?: ResumeAttachmentMeta;
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
