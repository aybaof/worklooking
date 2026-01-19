import { useState, useEffect, useRef } from "react";
const { ipcRenderer } = window.require("electron");
import { Button } from "@/components/ui/button";
import { Settings, Bot, FileText, Target } from "lucide-react";
import { Routes, Route, NavLink } from "react-router-dom";
import ChatPage from "./pages/chat";
import ConfigurationPage from "./pages/configuration";
import ResumeEditorPage from "./pages/resume-editor";
import CandidatureEditorPage from "./pages/candidature-editor";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis votre agent de recherche d'emploi. Comment puis-je vous aider aujourd'hui ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("opencode_api_key") || "",
  );
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("opencode_model") || "gemini-3-flash-preview",
  );
  const [userDataPath, setUserDataPath] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedPath = localStorage.getItem("worklooking_data_path");
    if (savedPath) {
      ipcRenderer.invoke("set-user-data-path", savedPath).then((res: any) => {
        if (res.success) {
          setUserDataPath(savedPath);
        } else {
          ipcRenderer.invoke("get-user-data-path").then(setUserDataPath);
        }
      });
    } else {
      ipcRenderer.invoke("get-user-data-path").then(setUserDataPath);
    }
  }, []);

  const handleSelectFolder = async () => {
    const path = await ipcRenderer.invoke("select-folder");
    if (path) {
      const res = await ipcRenderer.invoke("set-user-data-path", path);
      if (res.success) {
        setUserDataPath(path);
        localStorage.setItem("worklooking_data_path", path);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      const resumeJson = localStorage.getItem("worklooking_resume") || "";
      const response = await ipcRenderer.invoke("ai-chat", {
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        apiKey: apiKey,
        model: selectedModel,
        resumeJson: resumeJson,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content || "" },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur: ${error.message}.` },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            WorkLooking Agent
          </h1>
        </div>
        <div className="flex gap-2">
          <NavLink to="/">
            {({ isActive }) => (
              <Button variant={isActive ? "default" : "ghost"}>
                Communication
              </Button>
            )}
          </NavLink>
          <NavLink to="/resume-editor">
            {({ isActive }) => (
              <Button variant={isActive ? "default" : "ghost"}>
                <FileText className="w-4 h-4 mr-2" />
                Mon CV
              </Button>
            )}
          </NavLink>
          <NavLink to="/candidature-editor">
            {({ isActive }) => (
              <Button variant={isActive ? "default" : "ghost"}>
                <Target className="w-4 h-4 mr-2" />
                Candidatures
              </Button>
            )}
          </NavLink>
          <NavLink to="/settings">
            {({ isActive }) => (
              <Button variant={isActive ? "default" : "ghost"}>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </Button>
            )}
          </NavLink>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <Routes>
          <Route
            path="/"
            element={
              <ChatPage
                scrollRef={scrollRef}
                input={input}
                messages={messages}
                setInput={setInput}
                handleSend={handleSend}
                apiKey={apiKey}
                isTyping={isTyping}
                userDataPath={userDataPath}
                setMessages={setMessages}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <ConfigurationPage
                apiKey={apiKey}
                setApiKey={setApiKey}
                setSelectedModel={setSelectedModel}
                selectedModel={selectedModel}
                userDataPath={userDataPath}
                onSelectFolder={handleSelectFolder}
              />
            }
          />
          <Route path="/resume-editor" element={<ResumeEditorPage />} />
          <Route path="/candidature-editor" element={<CandidatureEditorPage />} />
        </Routes>
      </main>
    </div>
  );
}
