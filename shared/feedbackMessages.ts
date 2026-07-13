import { getResumeSectionLabel } from "./resume-sections";

/**
 * A single per-section comment collected in the feedback loop.
 *
 * `sectionId` maps to a `RESUME_SECTIONS` id; `comment` is the user's free-text
 * French note. These are the ONLY fields ever serialized into the regeneration
 * prompt — no resume PII field values are included, consistent with the
 * PII-stripping design in `docs/agent.md`.
 *
 * Lives in `shared/` because both the main process (which compiles the message
 * and appends it to the authoritative conversation history) and tests import it.
 */
export interface SectionComment {
  sectionId: string;
  comment: string;
}

/**
 * Build the structured French regeneration message appended to the conversation
 * history and run through the `ai:chat` tool loop.
 *
 * Only section labels + user comment text are included. Never pass resume field
 * values (name, email, phone, location, profiles, image, etc.) to this
 * function — doing so would leak PII into the prompt (AC-8, AC-15).
 */
export function buildRegenerationMessage(comments: SectionComment[]): string {
  const meaningful = comments.filter((c) => c.comment.trim().length > 0);

  const lines = meaningful.map(
    (c) => `- ${getResumeSectionLabel(c.sectionId)} : ${c.comment.trim()}`,
  );

  return [
    "Ajuste les sections suivantes de mon CV selon mes retours, " +
      "en conservant le format JSON Resume et sans inventer d'informations :",
    "",
    ...lines,
    "",
    "Renvoie le CV mis à jour.",
  ].join("\n");
}

/**
 * Build the French validation message run through the `ai:chat` tool loop to
 * trigger the agent's `generate_resume_files` tool and produce the final
 * HTML + PDF.
 */
export function buildValidationMessage(): string {
  return (
    "Le CV me convient. Génère les fichiers finaux (HTML et PDF) " +
    "avec l'outil de génération, puis confirme-moi que c'est terminé."
  );
}
