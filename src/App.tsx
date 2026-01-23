import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Bot, FileText, Target } from "lucide-react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ChatPage from "./pages/chat";
import ConfigurationPage from "./pages/configuration";
import ResumeEditorPage from "./pages/resume-editor";
import CandidatureEditorPage from "./pages/candidature-editor";
import { useSettings } from "@/hooks/useSettings";
import { useChat } from "@/hooks/useChat";
import { GuidanceManager } from "@/components/onboarding/GuidanceManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: -20,
  },
};

export default function App() {
  const settings = useSettings();
  const chat = useChat({
    apiKey: settings.apiKey,
    selectedModel: settings.selectedModel,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
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
            {({ isActive }) => {
              const shouldHighlight = !settings.apiKey.trim();
              return (
                <Button variant={isActive || shouldHighlight ? "default" : "ghost"}>
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres
                  {!isActive && shouldHighlight && (
                    <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">!</span>
                  )}
                </Button>
              );
            }}
          </NavLink>
        </div>
      </header>

       <main className="flex-1 relative overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full w-full"
          >
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <ErrorBoundary>
                    <GuidanceManager pageId="chat">
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
                    </GuidanceManager>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/settings"
                element={
                  <ErrorBoundary>
                    <GuidanceManager pageId="settings">
                      <ConfigurationPage
                        apiKey={settings.apiKey}
                        setApiKey={settings.setApiKey}
                        setSelectedModel={settings.setSelectedModel}
                        selectedModel={settings.selectedModel}
                        userDataPath={settings.userDataPath}
                        onSelectFolder={settings.handleSelectFolder}
                      />
                    </GuidanceManager>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/resume-editor"
                element={
                  <ErrorBoundary>
                    <GuidanceManager pageId="resume-editor">
                      <ResumeEditorPage />
                    </GuidanceManager>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/candidature-editor"
                element={
                  <ErrorBoundary>
                    <GuidanceManager pageId="candidature-editor">
                      <CandidatureEditorPage />
                    </GuidanceManager>
                  </ErrorBoundary>
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
