import { Message } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import { Dispatch, RefObject, SetStateAction } from "react";

interface IChatPage {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: Message[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  handleSend: () => Promise<void>;
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
                  {msg.content}
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

      <div className="mt-4 flex gap-2 p-2 bg-card border rounded-xl shadow-sm">
        <Input
          placeholder="Message à l'agent..."
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button
          size="icon"
          onClick={handleSend}
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
      <p className="text-[10px] text-center mt-2 text-muted-foreground">
        Stockage : <span className="font-mono">{userDataPath}</span>
      </p>
    </div>
  );
}
