import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Bot, FileText, Target } from "lucide-react";
import { Routes, Route, NavLink } from "react-router-dom";
import ChatPage from "./pages/chat";
import ConfigurationPage from "./pages/configuration";
import ResumeEditorPage from "./pages/resume-editor";
import CandidatureEditorPage from "./pages/candidature-editor";
import { useSettings } from "@/hooks/useSettings";
import { useChat } from "@/hooks/useChat";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  const settings = useSettings();
  const chat = useChat({ 
    apiKey: settings.apiKey, 
    selectedModel: settings.selectedModel 
  });
  const scrollRef = useRef<HTMLDivElement>(null);

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
              <ErrorBoundary>
                <ChatPage
                  scrollRef={scrollRef}
                  input={chat.input}
                  messages={chat.messages}
                  setInput={chat.setInput}
                  handleSend={chat.handleSend}
                  apiKey={settings.apiKey}
                  isTyping={chat.isTyping}
                  userDataPath={settings.userDataPath}
                  setMessages={chat.setMessages}
                  activeTool={chat.activeTool}
                />
              </ErrorBoundary>
            }
          />
          <Route
            path="/settings"
            element={
              <ErrorBoundary>
                <ConfigurationPage
                  apiKey={settings.apiKey}
                  setApiKey={settings.setApiKey}
                  setSelectedModel={settings.setSelectedModel}
                  selectedModel={settings.selectedModel}
                  userDataPath={settings.userDataPath}
                  onSelectFolder={settings.handleSelectFolder}
                />
              </ErrorBoundary>
            }
          />
          <Route 
            path="/resume-editor" 
            element={
              <ErrorBoundary>
                <ResumeEditorPage />
              </ErrorBoundary>
            } 
          />
          <Route
            path="/candidature-editor"
            element={
              <ErrorBoundary>
                <CandidatureEditorPage />
              </ErrorBoundary>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
