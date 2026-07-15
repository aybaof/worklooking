/**
 * Tier 3 — renderer page. Covers AC-2: ChatPage renders ONLY non-flagged
 * messages. Feedback-loop turns (`origin: "feedback"`) — the internal
 * regeneration/validation prompts and their assistant replies — must be
 * filtered out of the rendered conversation, while free-form chat messages
 * (unflagged or `origin: "chat"`) stay visible.
 */
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import type { Message } from "@/../shared/chat-types";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import ChatPage from "./chat";

function renderChat(messages: Message[]) {
  installMockWindowApi();
  const scrollRef = createRef<HTMLDivElement>();
  return render(
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
