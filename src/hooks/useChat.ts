import { useState, useEffect, useCallback, useRef } from "react";
import { Channels } from "@/../shared/ipc";
import {
  Message,
  MessageOrigin,
  ChatUpdatePayload,
  ToolStatusPayload,
} from "@/../shared/chat-types";
import { Resume } from "@/../shared/resume-types";
import { CandidatureConfig } from "@/../shared/candidature-types";
import { ProviderApi } from "@/../shared/provider-types";

interface UseChatOptions {
  apiKey: string;
  selectedModel: string;
  baseURL: string;
  api?: ProviderApi;
  resume: Resume;
  candidature: CandidatureConfig;
  selectedTheme?: string;
  onCandidatureUpdate: (config: CandidatureConfig) => void;
  /**
   * Called when a tailoring turn returns an `updatedResume`. The main renderer
   * uses this to open the in-app CV feedback modal (single-window design — the
   * loop runs here, not in a second BrowserWindow).
   */
  onTailoredResume?: (resume: Resume) => void;
}

export function useChat({
  apiKey,
  selectedModel,
  baseURL,
  api,
  resume,
  candidature,
  selectedTheme,
  onCandidatureUpdate,
  onTailoredResume,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis votre agent de recherche d'emploi. Comment puis-je vous aider aujourd'hui ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTool, setActiveTool] = useState<{
    name: string;
    status: string;
  } | null>(null);

  /**
   * Origin of the turn currently in flight. Read synchronously by the
   * `CHAT_UPDATE` streaming listener (a `[]`-deps effect with no access to
   * `runTurn`'s closure) so newly-created assistant messages inherit the right
   * origin. A ref (not state) is deliberate: the listener must read the latest
   * value without a re-subscribe.
   */
  const currentTurnOriginRef = useRef<MessageOrigin>("chat");

  useEffect(() => {
    const onChatUpdate = (data: ChatUpdatePayload) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              content: (lastMsg.content || "") + "\n\n" + data.content,
            },
          ];
        }
        return [
          ...prev,
          {
            role: "assistant",
            content: data.content,
            origin: currentTurnOriginRef.current,
          },
        ];
      });
    };

    const onToolStatus = (data: ToolStatusPayload) => {
      if (data.status === "start") {
        setActiveTool({ name: data.name, status: "in_progress" });
      } else {
        setActiveTool(null);
      }
    };

    const chatUpdateCleanup = window.api.on(Channels.CHAT_UPDATE, onChatUpdate);
    const toolStatusCleanup = window.api.on(Channels.TOOL_STATUS, onToolStatus);

    return () => {
      chatUpdateCleanup();
      toolStatusCleanup();
    };
  }, []);

  /**
   * Run one chat turn: append `userMessage`, invoke `ai:chat` continuing the
   * CURRENT conversation history, stream the assistant reply back into
   * `messages`, and apply resume/config updates. Returns the tailored
   * `updatedResume` (if any) so callers can react (e.g. open the feedback
   * modal). Shared by free-form chat (`handleSend`) and the feedback loop
   * (`sendFeedbackMessage`) so there is a single turn implementation.
   *
   * `origin` marks the turn: `"chat"` (default) for visible free-form chat,
   * `"feedback"` for hidden CV feedback-loop turns. It is stamped on the
   * appended user message and the assistant reply (both the streamed chunks —
   * via `currentTurnOriginRef` — and the final `response.content`), so the
   * whole turn is filtered out of the rendered chat while STILL being sent to
   * the model as history.
   */
  const runTurn = useCallback(
    async (
      userMessage: Message,
      origin: MessageOrigin = "chat",
    ): Promise<Resume | null> => {
      currentTurnOriginRef.current = origin;
      const updatedMessages = [...messages, { ...userMessage, origin }];
      setMessages(updatedMessages);
      setIsTyping(true);

      try {
        const response = await window.api.invoke(Channels.AI_CHAT, {
          messages: updatedMessages,
          apiKey,
          model: selectedModel,
          baseURL,
          api,
          resume,
          candidature,
          selectedTheme,
        });

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.updatedConfig) {
          onCandidatureUpdate(response.updatedConfig);
        }

        if (response.content) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  content: (lastMsg.content || "") + "\n\n" + response.content,
                },
              ];
            }
            return [
              ...prev,
              { role: "assistant", content: response.content || "", origin },
            ];
          });
        }

        return response.updatedResume ?? null;
      } finally {
        setIsTyping(false);
        currentTurnOriginRef.current = "chat";
      }
    },
    [
      apiKey,
      baseURL,
      api,
      messages,
      selectedModel,
      resume,
      candidature,
      selectedTheme,
      onCandidatureUpdate,
    ],
  );

  const handleSend = useCallback(
    async (attachmentPath?: string) => {
      if (!input.trim() || !apiKey) return;

      let messageContent = input;
      if (attachmentPath) {
        messageContent += `\n\n[Pièce jointe: ${attachmentPath}]`;
      }

      const userMessage: Message = { role: "user", content: messageContent };
      setInput("");

      try {
        const tailored = await runTurn(userMessage);
        if (tailored) {
          // Open the feedback modal so the user can iterate on the proposal.
          // The proposal comes from the write-free `render_resume_html` tool and
          // is PURELY EPHEMERAL — nothing is persisted here. Persistence happens
          // only when the user clicks Valider (`useFeedbackLoop.validate` →
          // `onValidated`), which triggers the write-only `generate_resume_files`.
          onTailoredResume?.(tailored);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erreur: ${message}.` },
        ]);
      }
    },
    [input, apiKey, runTurn, onTailoredResume],
  );

  /**
   * Continue the SAME conversation with a feedback-loop message (regeneration
   * or validation). Returns the new tailored resume or an error string so the
   * feedback modal can update its preview / surface the error while preserving
   * the user's comments.
   */
  const sendFeedbackMessage = useCallback(
    async (
      content: string,
    ): Promise<{ resume: Resume | null; error?: string }> => {
      const userMessage: Message = { role: "user", content };
      try {
        const tailored = await runTurn(userMessage, "feedback");
        return { resume: tailored };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erreur: ${message}.` },
        ]);
        return { resume: null, error: message };
      }
    },
    [runTurn],
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
    isTyping,
    activeTool,
    handleSend,
    sendFeedbackMessage,
  };
}
