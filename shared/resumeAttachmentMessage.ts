import { Message } from "./chat-types";

interface ResumeAttachmentInput {
  company: string;
  position: string;
  htmlPath: string;
  pdfPath: string;
}

/**
 * Build the one assistant message posted to the main conversation on a FULL
 * `validate()` success (AC-4/AC-5/AC-6). `content` is a complete French
 * sentence naming `company`/`position` and both generated paths — the sole
 * LLM/history-facing text, unaffected by `attachment`. No `origin` is set
 * (defaults to `undefined`), so the message is neither hidden by
 * `ChatPage`'s `origin !== "feedback"` filter nor excluded from the history
 * sent to the model.
 */
export function buildResumeAttachmentMessage({
  company,
  position,
  htmlPath,
  pdfPath,
}: ResumeAttachmentInput): Message {
  return {
    role: "assistant",
    content:
      `CV généré et validé pour ${position} chez ${company}. ` +
      `Fichiers écrits :\nPDF : ${pdfPath}\nHTML : ${htmlPath}`,
    attachment: { company, position, htmlPath, pdfPath },
  };
}
