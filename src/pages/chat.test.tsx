/**
 * Tier 3 — renderer page. Covers AC-2: ChatPage renders ONLY non-flagged
 * messages. Feedback-loop turns (`origin: "feedback"`) — the internal
 * regeneration/validation prompts and their assistant replies — must be
 * filtered out of the rendered conversation, while free-form chat messages
 * (unflagged or `origin: "chat"`) stay visible.
 *
 * Also covers AC-6/AC-7/AC-8: a message carrying `attachment` renders as a
 * distinct "resume-attachment-card" (not the plain Markdown bubble path) with
 * a working "reveal in folder" control.
 */
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { Message } from "@/../shared/chat-types";
import { Channels } from "@/../shared/ipc";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import ChatPage from "./chat";

function renderChat(messages: Message[]) {
  const api = installMockWindowApi();
  const scrollRef = createRef<HTMLDivElement>();
  const view = render(
    <ChatPage
      scrollRef={scrollRef}
      messages={messages}
      input=""
      setInput={vi.fn()}
      handleSend={vi.fn()}
      apiKey="key-123"
      isTyping={false}
      userDataPath="/tmp/data"
      setMessages={vi.fn()}
      activeTool={null}
    />,
  );
  return { ...view, api };
}

describe("ChatPage (AC-2 hidden feedback turns)", () => {
  it("renders unflagged and chat-origin messages but hides feedback-origin turns", () => {
    const messages: Message[] = [
      { role: "assistant", content: "Bonjour visible" },
      { role: "user", content: "Question utilisateur visible", origin: "chat" },
      {
        role: "user",
        content: "PROMPT INTERNE Ajuste les sections suivantes",
        origin: "feedback",
      },
      {
        role: "assistant",
        content: "REPONSE MACHINE Génère les fichiers finaux",
        origin: "feedback",
      },
      { role: "assistant", content: "Réponse assistant visible" },
    ];

    renderChat(messages);

    // Visible (unflagged / origin:"chat") messages are present.
    expect(screen.getByText("Bonjour visible")).not.toBeNull();
    expect(screen.getByText("Question utilisateur visible")).not.toBeNull();
    expect(screen.getByText("Réponse assistant visible")).not.toBeNull();

    // Hidden (origin:"feedback") turns are absent from the DOM.
    expect(
      screen.queryByText(/PROMPT INTERNE Ajuste les sections suivantes/),
    ).toBeNull();
    expect(
      screen.queryByText(/REPONSE MACHINE Génère les fichiers finaux/),
    ).toBeNull();
  });

  it("renders every message when none are flagged", () => {
    const messages: Message[] = [
      { role: "assistant", content: "Un" },
      { role: "user", content: "Deux" },
      { role: "assistant", content: "Trois" },
    ];

    renderChat(messages);

    expect(screen.getByText("Un")).not.toBeNull();
    expect(screen.getByText("Deux")).not.toBeNull();
    expect(screen.getByText("Trois")).not.toBeNull();
  });
});

describe("ChatPage (AC-6/AC-7 resume-attachment card)", () => {
  it("renders a message with `attachment` as the resume-attachment-card, not a plain Markdown bubble (AC-7)", () => {
    const messages: Message[] = [
      { role: "user", content: "Adapte mon CV pour Doctolib" },
      {
        role: "assistant",
        content:
          "CV généré et validé pour Développeur Fullstack chez Doctolib. " +
          "Fichiers écrits :\nPDF : /tmp/candidatures/doctolib/resume.pdf\n" +
          "HTML : /tmp/candidatures/doctolib/resume.html",
        attachment: {
          company: "Doctolib",
          position: "Développeur Fullstack",
          htmlPath: "/tmp/candidatures/doctolib/resume.html",
          pdfPath: "/tmp/candidatures/doctolib/resume.pdf",
        },
      },
    ];

    renderChat(messages);

    const card = screen.getByTestId("resume-attachment-card");
    expect(within(card).getByText(/Doctolib/)).not.toBeNull();
    expect(within(card).getByText(/Développeur Fullstack/)).not.toBeNull();
    expect(
      within(card).getByText(/\/tmp\/candidatures\/doctolib\/resume\.pdf/),
    ).not.toBeNull();
    expect(
      within(card).getByText(/\/tmp\/candidatures\/doctolib\/resume\.html/),
    ).not.toBeNull();

    // Exactly one attachment card, and only ONE chat-message wrapper carries it
    // (the plain user turn above renders through the ordinary Markdown path).
    expect(screen.getAllByTestId("resume-attachment-card")).toHaveLength(1);
    expect(screen.getAllByTestId("chat-message")).toHaveLength(2);
  });

  it("clicking the reveal button invokes SHELL_SHOW_ITEM_IN_FOLDER with pdfPath when present", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "CV généré et validé pour Développeur chez Acme.",
        attachment: {
          company: "Acme",
          position: "Développeur",
          htmlPath: "/tmp/acme/resume.html",
          pdfPath: "/tmp/acme/resume.pdf",
        },
      },
    ];

    const { api } = renderChat(messages);
    const card = screen.getByTestId("resume-attachment-card");
    fireEvent.click(within(card).getByText("Afficher dans le dossier"));

    expect(api.invoke).toHaveBeenCalledTimes(1);
    expect(api.invoke).toHaveBeenCalledWith(
      Channels.SHELL_SHOW_ITEM_IN_FOLDER,
      { path: "/tmp/acme/resume.pdf" },
    );
  });

  it("clicking the reveal button invokes SHELL_SHOW_ITEM_IN_FOLDER with htmlPath when pdfPath is absent", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "CV généré et validé pour Développeur chez Acme.",
        attachment: {
          company: "Acme",
          position: "Développeur",
          htmlPath: "/tmp/acme/resume.html",
        },
      },
    ];

    const { api } = renderChat(messages);
    const card = screen.getByTestId("resume-attachment-card");
    fireEvent.click(within(card).getByText("Afficher dans le dossier"));

    expect(api.invoke).toHaveBeenCalledTimes(1);
    expect(api.invoke).toHaveBeenCalledWith(
      Channels.SHELL_SHOW_ITEM_IN_FOLDER,
      { path: "/tmp/acme/resume.html" },
    );
  });
});
