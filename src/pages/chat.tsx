import { Message } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  User,
  X,
  FileText,
} from "lucide-react";
import { useState, Dispatch, RefObject, SetStateAction } from "react";
import Markdown from "react-markdown";

const { ipcRenderer } = window.require("electron");

interface IChatPage {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: Message[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  handleSend: (attachment?: string) => Promise<void>;
  apiKey: string;
  isTyping: boolean;
  userDataPath: string;
  setMessages: Dispatch<SetStateAction<Message[]>>;
}

export default function ChatPage({
  scrollRef,
  messages,
  input,
  setInput,
  handleSend,
  apiKey,
  isTyping,
  userDataPath,
  setMessages,
}: IChatPage) {
  const [attachment, setAttachment] = useState<string | null>(null);

  const handleSelectFile = async () => {
    try {
      const filePath = await ipcRenderer.invoke("select-file", {
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });
      if (filePath) {
        setAttachment(filePath);
      }
    } catch (err) {
      console.error("Failed to select file:", err);
    }
  };

  const onSend = async () => {
    await handleSend(attachment || undefined);
    setAttachment(null);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex gap-3 max-w-[85%] ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                  msg.role === "user" ? "bg-primary" : "bg-muted border"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <Card
                className={`${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card"
                }`}
              >
                <CardContent className="p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  <Markdown>{msg.content}</Markdown>
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 px-3 py-2 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              L'agent réfléchit...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 p-2 bg-card border rounded-xl shadow-sm">
        {attachment && (
          <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-lg w-fit text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span className="truncate max-w-[200px]">
              {attachment.split(/[\\/]/).pop()}
            </span>
            <button
              onClick={() => setAttachment(null)}
              className="hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSelectFile}
            className="shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Message à l'agent..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!apiKey || !input.trim() || isTyping}
          >
            <Send className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              setMessages([{ role: "assistant", content: "Chat réinitialisé." }])
            }
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-center mt-2 text-muted-foreground">
        Stockage : <span className="font-mono">{userDataPath}</span>
      </p>
    </div>
  );
}
