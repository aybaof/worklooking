import { useState, useEffect, useCallback } from 'react';
import { Channels } from '@/../shared/ipc';
import { Message, ChatUpdatePayload, ToolStatusPayload } from '@/../shared/chat-types';

interface UseChatOptions {
  apiKey: string;
  selectedModel: string;
}

export function useChat({ apiKey, selectedModel }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis votre agent de recherche d'emploi. Comment puis-je vous aider aujourd'hui ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTool, setActiveTool] = useState<{
    name: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    const onChatUpdate = (data: ChatUpdatePayload) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, content: (lastMsg.content || "") + "\n\n" + data.content },
          ];
        }
        return [...prev, { role: "assistant", content: data.content }];
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

  const handleSend = useCallback(async (attachmentPath?: string) => {
    if (!input.trim() || !apiKey) return;

    let messageContent = input;
    if (attachmentPath) {
      messageContent += `\n\n[Pièce jointe: ${attachmentPath}]`;
    }

    const userMessage: Message = { role: "user", content: messageContent };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      const resumeJson = localStorage.getItem("worklooking_resume") || "";
      const configJson = localStorage.getItem("worklooking_candidature_config") || "";
      
      const response = await window.api.invoke(Channels.AI_CHAT, {
        messages: updatedMessages,
        apiKey: apiKey,
        model: selectedModel,
        resumeJson: resumeJson,
        configJson: configJson,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.updatedResume) {
        localStorage.setItem(
          "worklooking_resume",
          JSON.stringify(response.updatedResume, null, 2),
        );
      }

      if (response.updatedConfig) {
        localStorage.setItem(
          "worklooking_candidature_config",
          JSON.stringify(response.updatedConfig, null, 2),
        );
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
            { role: "assistant", content: response.content || "" },
          ];
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur: ${message}.` },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [input, apiKey, messages, selectedModel]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isTyping,
    activeTool,
    handleSend,
  };
}
