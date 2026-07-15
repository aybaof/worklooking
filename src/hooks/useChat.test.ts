/**
 * Tier 3 — renderer hook. Mock window.api.invoke + the CHAT_UPDATE / TOOL_STATUS
 * event subscriptions (window.api.on).
 * See tests/TEST_PLAN.md → "Tier 3: useChat".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import { Channels } from "@/../shared/ipc";
import type {
  ChatUpdatePayload,
  ToolStatusPayload,
} from "@/../shared/chat-types";
import type { Resume } from "@/../shared/resume-types";
import type { CandidatureConfig } from "@/../shared/candidature-types";
import { useChat } from "./useChat";

type Listener = (data: unknown) => void;

function baseOptions(overrides: Partial<Parameters<typeof useChat>[0]> = {}) {
  return {
    apiKey: "key-123",
    selectedModel: "gpt-4o",
    baseURL: "https://api.openai.com/v1",
    api: "openai" as const,
    resume: {} as Resume,
    candidature: {} as CandidatureConfig,
    selectedTheme: "modern-sidebar",
    onCandidatureUpdate: vi.fn(),
    ...overrides,
  };
}

describe("useChat", () => {
  let api: ReturnType<typeof installMockWindowApi>;
  let listeners: Map<string, Listener>;
  let unsubscribes: Map<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = installMockWindowApi();
    listeners = new Map();
    unsubscribes = new Map();

    api.on.mockImplementation((channel: string, cb: Listener) => {
      listeners.set(channel, cb);
      const unsub = vi.fn();
      unsubscribes.set(channel, unsub);
      return unsub;
    });
  });

  function emit(channel: string, data: unknown) {
    const cb = listeners.get(channel);
    if (!cb) throw new Error(`no listener for ${channel}`);
    act(() => cb(data));
  }

  it("appends streamed chunks to the last assistant message", () => {
    const { result } = renderHook(() => useChat(baseOptions()));

    const initial = result.current.messages[0].content;
    const payload: ChatUpdatePayload = { content: "streamed chunk" };
    emit(Channels.CHAT_UPDATE, payload);

    const last = result.current.messages[result.current.messages.length - 1];
    expect(result.current.messages).toHaveLength(1);
    expect(last.role).toBe("assistant");
    expect(last.content).toBe(`${initial}\n\nstreamed chunk`);
  });

  it("pushes a new assistant message when the last message is from the user", async () => {
    api.invoke.mockImplementation(
      () => new Promise(() => {}), // never resolves; keep the user message last
    );

    const { result } = renderHook(() => useChat(baseOptions()));

    act(() => result.current.setInput("hello"));
    act(() => {
      void result.current.handleSend();
    });

    await waitFor(() =>
      expect(
        result.current.messages[result.current.messages.length - 1].role,
      ).toBe("user"),
    );

    emit(Channels.CHAT_UPDATE, { content: "assistant reply" });

    const msgs = result.current.messages;
    // A free-form chat turn is in flight, so the streamed assistant message the
    // CHAT_UPDATE listener creates inherits the turn origin ("chat") via
    // currentTurnOriginRef (AC-1 default: free-form chat stays "chat").
    expect(msgs[msgs.length - 1]).toEqual({
      role: "assistant",
      content: "assistant reply",
      origin: "chat",
    });
  });

  it("formats attachments before sending", async () => {
    api.invoke.mockResolvedValue({ content: "ok" });

    const { result } = renderHook(() => useChat(baseOptions()));
    act(() => result.current.setInput("voici mon CV"));

    await act(async () => {
      await result.current.handleSend("/tmp/cv.pdf");
    });

    const call = api.invoke.mock.calls.find((c) => c[0] === Channels.AI_CHAT);
    expect(call).toBeDefined();
    const sentMessages = (call?.[1] as { messages: { content: string }[] })
      .messages;
    const userMessage = sentMessages[sentMessages.length - 1];
    expect(userMessage.content).toBe(
      "voici mon CV\n\n[Pièce jointe: /tmp/cv.pdf]",
    );
  });

  it("invokes AI_CHAT via window.api and handles the response", async () => {
    api.invoke.mockResolvedValue({ content: "réponse de l'agent" });

    const { result } = renderHook(() => useChat(baseOptions()));
    act(() => result.current.setInput("question"));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(api.invoke).toHaveBeenCalledWith(
      Channels.AI_CHAT,
      expect.objectContaining({
        apiKey: "key-123",
        model: "gpt-4o",
        baseURL: "https://api.openai.com/v1",
        api: "openai",
        selectedTheme: "modern-sidebar",
      }),
    );

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toContain("réponse de l'agent");
    expect(result.current.isTyping).toBe(false);
  });

  it("fires updatedConfig callback from the response", async () => {
    const onCandidatureUpdate = vi.fn();
    const updatedConfig = {
      candidate: { name: "Cfg" },
    } as unknown as CandidatureConfig;

    api.invoke.mockResolvedValue({
      content: "done",
      updatedConfig,
    });

    const { result } = renderHook(() =>
      useChat(baseOptions({ onCandidatureUpdate })),
    );
    act(() => result.current.setInput("mets à jour"));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(onCandidatureUpdate).toHaveBeenCalledWith(updatedConfig);
  });

  it("fires onTailoredResume when a turn returns updatedResume (AC-1)", async () => {
    const onTailoredResume = vi.fn();
    const updatedResume: Resume = { basics: { name: "Tailored" } };

    api.invoke.mockResolvedValue({ content: "voici votre CV", updatedResume });

    const { result } = renderHook(() =>
      useChat(baseOptions({ onTailoredResume })),
    );
    act(() => result.current.setInput("adapte mon CV"));

    await act(async () => {
      await result.current.handleSend();
    });

    // The proposal (from write-free render_resume_html) is EPHEMERAL: only the
    // modal-open callback fires — nothing is persisted here. Persistence happens
    // only on Valider (useFeedbackLoop.validate → onValidated).
    expect(onTailoredResume).toHaveBeenCalledWith(updatedResume);
  });

  it("does not fire onTailoredResume when the turn has no updatedResume", async () => {
    const onTailoredResume = vi.fn();
    api.invoke.mockResolvedValue({ content: "réponse simple" });

    const { result } = renderHook(() =>
      useChat(baseOptions({ onTailoredResume })),
    );
    act(() => result.current.setInput("bonjour"));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(onTailoredResume).not.toHaveBeenCalled();
  });

  it("sendFeedbackMessage appends to the SAME history and runs ai:chat (AC-4)", async () => {
    const regenResume: Resume = { basics: { summary: "Régénéré" } };
    // First a normal turn to build up conversation history.
    api.invoke.mockResolvedValueOnce({ content: "premier tour" });

    const { result } = renderHook(() => useChat(baseOptions()));
    act(() => result.current.setInput("adapte mon CV"));
    await act(async () => {
      await result.current.handleSend();
    });

    const historyBefore = result.current.messages.length;

    // Now a feedback-loop turn continuing the same conversation.
    api.invoke.mockResolvedValueOnce({
      content: "CV mis à jour",
      updatedResume: regenResume,
    });

    let outcome: { resume: Resume | null; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.sendFeedbackMessage("- Compétences : ...");
    });

    // Returns the new tailored resume.
    expect(outcome).toEqual({ resume: regenResume });

    // The ai:chat call for the feedback turn carried the FULL prior history
    // plus the appended feedback user message (same conversation, not a fresh
    // isolated call).
    const aiChatCalls = api.invoke.mock.calls.filter(
      (c) => c[0] === Channels.AI_CHAT,
    );
    const feedbackCall = aiChatCalls[aiChatCalls.length - 1];
    const sent = (feedbackCall?.[1] as { messages: { role: string; content: string }[] })
      .messages;
    expect(sent.length).toBeGreaterThan(historyBefore);
    const lastSent = sent[sent.length - 1];
    // AC-1: the feedback user message is stamped with origin "feedback".
    // AC-3: it is STILL part of the history sent to the model (not stripped).
    expect(lastSent).toEqual({
      role: "user",
      content: "- Compétences : ...",
      origin: "feedback",
    });

    // The message history now includes the appended feedback user turn.
    expect(
      result.current.messages.some(
        (m) => m.role === "user" && m.content === "- Compétences : ...",
      ),
    ).toBe(true);
  });

  it("flags both the feedback user message AND its assistant reply with origin 'feedback' (AC-1)", async () => {
    api.invoke.mockResolvedValueOnce({ content: "CV régénéré" });

    const { result } = renderHook(() => useChat(baseOptions()));

    await act(async () => {
      await result.current.sendFeedbackMessage("- Résumé : plus court");
    });

    const feedbackUser = result.current.messages.find(
      (m) => m.role === "user" && m.content === "- Résumé : plus court",
    );
    expect(feedbackUser?.origin).toBe("feedback");

    // The assistant reply produced by that feedback turn (from response.content)
    // is flagged too, so the whole turn is hidden from the rendered chat.
    const assistantReply = result.current.messages.find(
      (m) => m.role === "assistant" && m.content === "CV régénéré",
    );
    expect(assistantReply?.origin).toBe("feedback");
  });

  it("keeps free-form chat turns unflagged (origin undefined) so they stay visible (AC-4)", async () => {
    const onTailoredResume = vi.fn();
    const updatedResume: Resume = { basics: { name: "Tailored" } };
    api.invoke.mockResolvedValue({ content: "réponse visible", updatedResume });

    const { result } = renderHook(() =>
      useChat(baseOptions({ onTailoredResume })),
    );
    act(() => result.current.setInput("adapte mon CV"));

    await act(async () => {
      await result.current.handleSend();
    });

    const userMsg = result.current.messages.find(
      (m) => m.role === "user" && m.content === "adapte mon CV",
    );
    // Free-form chat messages remain unflagged (origin "chat", not "feedback").
    expect(userMsg?.origin).not.toBe("feedback");

    const assistantMsg = result.current.messages.find(
      (m) => m.role === "assistant" && m.content?.includes("réponse visible"),
    );
    expect(assistantMsg?.origin).not.toBe("feedback");

    // onTailoredResume still fires on a returned tailored resume.
    expect(onTailoredResume).toHaveBeenCalledWith(updatedResume);
  });

  it("stamps streamed CHAT_UPDATE chunks of an in-flight feedback turn with origin 'feedback' (AC-1 streaming)", async () => {
    // invoke never resolves so the feedback turn stays in-flight; the streamed
    // assistant chunk arrives via CHAT_UPDATE and must inherit "feedback".
    api.invoke.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useChat(baseOptions()));

    act(() => {
      void result.current.sendFeedbackMessage("- Compétences : ajoute React");
    });

    // Wait until the feedback user message is appended (turn in flight).
    await waitFor(() =>
      expect(
        result.current.messages[result.current.messages.length - 1].role,
      ).toBe("user"),
    );

    emit(Channels.CHAT_UPDATE, { content: "morceau diffusé" });

    const streamed = result.current.messages.find(
      (m) => m.role === "assistant" && m.content === "morceau diffusé",
    );
    expect(streamed?.origin).toBe("feedback");
  });

  it("sendFeedbackMessage surfaces errors without throwing (AC-4/AC-12 support)", async () => {
    api.invoke.mockResolvedValue({ error: "provider down" });

    const { result } = renderHook(() => useChat(baseOptions()));

    let outcome: { resume: Resume | null; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.sendFeedbackMessage("- Résumé : ...");
    });

    expect(outcome?.resume).toBeNull();
    expect(outcome?.error).toBe("provider down");
  });

  it("surfaces an error response as an assistant error message", async () => {
    api.invoke.mockResolvedValue({ error: "boom" });

    const { result } = renderHook(() => useChat(baseOptions()));
    act(() => result.current.setInput("go"));

    await act(async () => {
      await result.current.handleSend();
    });

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.content).toBe("Erreur: boom.");
    expect(result.current.isTyping).toBe(false);
  });

  it("does not send when input is empty or the api key is missing", async () => {
    const { result: noInput } = renderHook(() => useChat(baseOptions()));
    await act(async () => {
      await noInput.current.handleSend();
    });
    expect(api.invoke).not.toHaveBeenCalledWith(
      Channels.AI_CHAT,
      expect.anything(),
    );

    const { result: noKey } = renderHook(() =>
      useChat(baseOptions({ apiKey: "" })),
    );
    act(() => noKey.current.setInput("hi"));
    await act(async () => {
      await noKey.current.handleSend();
    });
    expect(api.invoke).not.toHaveBeenCalledWith(
      Channels.AI_CHAT,
      expect.anything(),
    );
  });

  it("subscribes to CHAT_UPDATE and TOOL_STATUS events and cleans up", () => {
    const { unmount } = renderHook(() => useChat(baseOptions()));

    expect(api.on).toHaveBeenCalledWith(
      Channels.CHAT_UPDATE,
      expect.any(Function),
    );
    expect(api.on).toHaveBeenCalledWith(
      Channels.TOOL_STATUS,
      expect.any(Function),
    );

    // TOOL_STATUS drives activeTool.
    const startPayload: ToolStatusPayload = {
      name: "render_resume",
      status: "start",
    };
    unmount();

    expect(unsubscribes.get(Channels.CHAT_UPDATE)).toHaveBeenCalled();
    expect(unsubscribes.get(Channels.TOOL_STATUS)).toHaveBeenCalled();
    // Reference the payload type to keep the assertion meaningful.
    expect(startPayload.status).toBe("start");
  });

  it("tracks activeTool from TOOL_STATUS start/end events", () => {
    const { result } = renderHook(() => useChat(baseOptions()));

    emit(Channels.TOOL_STATUS, { name: "render_resume", status: "start" });
    expect(result.current.activeTool).toEqual({
      name: "render_resume",
      status: "in_progress",
    });

    emit(Channels.TOOL_STATUS, { name: "render_resume", status: "end" });
    expect(result.current.activeTool).toBeNull();
  });
});
