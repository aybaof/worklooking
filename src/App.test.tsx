/**
 * Scoped App-level integration test (orchestrator decision, see
 * `.work/features/candidature-resume-path/plan.md` → "Orchestrator decision
 * (plan gate)"). This is NOT a full end-to-end app test suite — just enough
 * to pin AC-4 and AC-14 at the integration boundary unit tests structurally
 * cannot reach:
 *
 * - AC-4: driving a full-success `validate()` end-to-end increases the
 *   rendered chat's message count by exactly one, and that message is the
 *   resume attachment card.
 * - AC-14: `App.tsx` is the SOLE `useCandidatureConfig` integration point —
 *   verified by observing that the match-or-create write from the SAME flow
 *   lands on the `applications` list rendered by `CandidatureEditorPage`
 *   (i.e. not a second, disconnected `useCandidatureConfig` instance).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { installMockWindowApi } from "../tests/renderer/mockWindowApi";
import { Channels } from "@/../shared/ipc";
import App from "./App";

function mockChannels(api: ReturnType<typeof installMockWindowApi>) {
  api.invoke.mockImplementation((channel: string) => {
    switch (channel) {
      case Channels.APP_GET_USER_DATA_PATH:
        return Promise.resolve("/tmp/worklooking-data");
      case Channels.RESUME_RENDER_PREVIEW:
        return Promise.resolve({ html: "<div>preview</div>" });
      case Channels.RESUME_GENERATE_FINAL:
        return Promise.resolve({
          success: true,
          htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
          pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
        });
      case Channels.AI_CHAT:
        return Promise.resolve({
          content: "Voici votre CV adapté pour Doctolib.",
          updatedResume: { basics: { summary: "Profil adapté" } },
          company: "Doctolib",
          position: "Développeur Fullstack",
        });
      default:
        return Promise.resolve({});
    }
  });
}

describe("App (scoped integration — AC-4, AC-14)", () => {
  let api: ReturnType<typeof installMockWindowApi>;

  beforeEach(() => {
    localStorage.setItem("opencode_api_key", "test-api-key");
    api = installMockWindowApi();
    mockChannels(api);
  });

  it("posts exactly one new resume-attachment chat message and writes resume_path onto the SAME candidature.config.applications on a full validate() success", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    // Wait for the initial greeting message to render (chat mounted).
    await screen.findByText(/Comment puis-je vous aider/);

    // Drive a tailoring turn: type + send (Enter), producing a tailored
    // resume with company/position, which opens the feedback modal.
    const input = screen.getByPlaceholderText("Message à l'agent...");
    fireEvent.change(input, {
      target: { value: "Adapte mon CV pour Doctolib" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    // Modal opens once the tailoring turn resolves.
    await screen.findByText("Valider");

    // Message count just before Valider (greeting + user turn + assistant
    // reply — none of them carry an `attachment`).
    const messagesBeforeValidate = screen.getAllByTestId("chat-message").length;
    expect(
      screen.queryByTestId("resume-attachment-card"),
    ).toBeNull();

    // Click Valider — resolves via the mocked RESUME_GENERATE_FINAL full
    // success (both htmlPath and pdfPath present, no error).
    const validateButton = screen.getByText("Valider").closest("button");
    expect(validateButton).not.toBeNull();
    await waitFor(() => {
      fireEvent.click(validateButton as HTMLButtonElement);
    });

    // AC-1: the modal auto-closes on full success.
    await waitFor(() => expect(screen.queryByText("Valider")).toBeNull());

    // AC-4: exactly one new message appended, and it's the attachment card.
    await waitFor(() => {
      expect(screen.getAllByTestId("chat-message").length).toBe(
        messagesBeforeValidate + 1,
      );
    });
    const card = screen.getByTestId("resume-attachment-card");
    expect(
      within(card).getByText(/Doctolib/),
    ).not.toBeNull();
    expect(
      within(card).getByText(/Développeur Fullstack/),
    ).not.toBeNull();

    // AC-14: the match-or-create write landed on the SAME `useCandidatureConfig`
    // instance App.tsx owns — verified by navigating to the candidature editor
    // (which renders `config.applications` from that SAME hook instance) and
    // observing the new row with the generated `resume_path`.
    fireEvent.click(screen.getByText("Candidatures"));
    await screen.findByText("Configuration Candidature");

    // The page's own sidebar has a distinct "Candidatures" nav button (for
    // the `applications` section) — click it to reveal the applications list.
    const sectionButtons = screen.getAllByText("Candidatures");
    fireEvent.click(sectionButtons[sectionButtons.length - 1]);

    await waitFor(() => {
      expect(
        screen.getByText("/tmp/candidatures/doctolib_dev/resume.pdf"),
      ).not.toBeNull();
    });
  });
});
