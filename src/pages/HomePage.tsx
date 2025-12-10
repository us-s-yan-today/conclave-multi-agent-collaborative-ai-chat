import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { produce } from 'immer';
import { chatService, ExtendedMessage, generateSessionTitle } from '@/lib/chat';
import type { SessionInfo } from '../../worker/types';
import { Agent, getAgents, saveAgents } from '@/lib/agents';
import { AgentConfigDrawer } from '@/components/AgentConfigDrawer';
import { RightPanel } from '@/components/RightPanel';
import { ExportModal } from '@/components/ExportModal';
import { LeftPanel } from '@/components/LeftPanel';
import { CenterPanel } from '@/components/CenterPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CONTAINER_WRAPPER, PAGE_SPACING } from './_workspaceStyles';
export function HomePage() {
  const [agents, setAgents] = useState<Agent[]>(getAgents);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showLimitsNotice, setShowLimitsNotice] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isShareMode, setIsShareMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  useTheme(); // Initialize theme
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };
  useEffect(scrollToBottom, [messages]);
  const handleSwitchSession = useCallback(async (sessionId: string) => {
    chatService.switchSession(sessionId);
    setCurrentSessionId(sessionId);
    const res = await chatService.getMessages();
    setMessages(res.success && res.data ? res.data.messages : []);
  }, []);
  const loadSessions = useCallback(async (switchToId?: string) => {
    const res = await chatService.listSessions();
    if (res.success && res.data) {
      setSessions(res.data);
      const targetSessionId = switchToId || currentSessionId;
      if (targetSessionId && res.data.some(s => s.id === targetSessionId)) {
        if (currentSessionId !== targetSessionId) {
          await handleSwitchSession(targetSessionId);
        }
      } else if (res.data.length > 0) {
        await handleSwitchSession(res.data[0].id);
      } else {
        const newRes = await chatService.createSession(generateSessionTitle());
        if (newRes.success && newRes.data) {
          await handleSwitchSession(newRes.data.sessionId);
          const newList = await chatService.listSessions();
          if (newList.success && newList.data) setSessions(newList.data);
        }
      }
    }
  }, [currentSessionId, handleSwitchSession]);
  const handleNewSession = useCallback(async () => {
    const res = await chatService.createSession(generateSessionTitle());
    if (res.success && res.data) {
      await loadSessions(res.data.sessionId);
    }
  }, [loadSessions]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const sessionId = params.get('session');
    const mode = params.get('mode');
    if (sessionId) {
      handleSwitchSession(sessionId);
      if (mode === 'read-only') {
        setIsShareMode(true);
      }
    } else {
      loadSessions();
    }
  }, [handleSwitchSession, loadSessions]);
  const handleDeleteSession = async (sessionId: string) => {
    await chatService.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    await loadSessions();
  };
  const handleAgentUpdate = (updatedAgent: Agent) => {
    const newAgents = produce(agents, draft => {
      const index = draft.findIndex(a => a.id === updatedAgent.id);
      if (index !== -1) draft[index] = updatedAgent;
      else draft.push(updatedAgent);
    });
    setAgents(newAgents);
    saveAgents(newAgents);
  };
  const handlePromoteAgent = (agentId: string) => {
    const newAgents = produce(agents, draft => {
      const currentPrimary = draft.find(a => a.role === 'Primary');
      if (currentPrimary) currentPrimary.role = 'Observer';
      const newPrimary = draft.find(a => a.id === agentId);
      if (newPrimary) newPrimary.role = 'Primary';
    });
    setAgents(newAgents);
    saveAgents(newAgents);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || isShareMode) return;
    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);
    const userMessage: ExtendedMessage = { id: crypto.randomUUID(), role: 'user', content: userInput, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    if (messages.length === 0 && currentSessionId) {
      const agentSnapshot = agents.filter(a => a.isActive);
      const title = generateSessionTitle(userInput);
      await chatService.updateSessionTitle(currentSessionId, title);
      await chatService.createSession(title, currentSessionId, userInput, agentSnapshot);
      await loadSessions();
    }
    const activeAgents = agents.filter(a => a.isActive).sort((a, b) => (a.role === 'Primary' ? -1 : b.role === 'Primary' ? 1 : 0));
    const prunedHistory = messages.slice(-10).map(m => `${m.agentName || m.role}: ${m.content}`).join('\nPrevious: ');
    try {
      for (const agent of activeAgents) {
        setAgents(prev => produce(prev, draft => {
          const agentToUpdate = draft.find(a => a.id === agent.id);
          if (agentToUpdate) agentToUpdate.status = 'Thinking';
        }));
        const fullPrompt = `[You are ${agent.name}. Personality: ${agent.personality}. Previous context:\n${prunedHistory || 'New conversation.'}]\n\nUser: ${userInput}`;
        const streamId = crypto.randomUUID();
        const assistantMessage: ExtendedMessage = { id: streamId, role: 'assistant', content: '', timestamp: Date.now(), agentId: agent.id, agentName: agent.name, agentColor: agent.color };
        setMessages(prev => [...prev, assistantMessage]);
        const response = await chatService.sendMessage(fullPrompt, agent.model, (chunk) => {
          setMessages(prev => produce(prev, draft => {
            const msg = draft.find(m => m.id === streamId);
            if (msg) msg.content += chunk;
          }));
          scrollToBottom();
        });
        if (!response.success) {
          throw new Error(response.error || `Agent ${agent.name} failed to respond.`);
        }
        setAgents(prev => produce(prev, draft => {
          const agentToUpdate = draft.find(a => a.id === agent.id);
          if (agentToUpdate) agentToUpdate.status = 'Ready';
        }));
      }
    } catch (error) {
      console.error("Chat orchestration error:", error);
      toast.error("An agent failed to respond. Please check limits or try again.");
      const errorMessage: ExtendedMessage = { id: crypto.randomUUID(), role: 'assistant', content: `Error: Could not generate a complete response. An agent failed.`, timestamp: Date.now(), isError: true };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleEditAgent = (agent: Agent | null) => {
    setEditingAgent(agent);
    setIsDrawerOpen(true);
  };
  const handleRetryMessage = (messageId: string) => {
    // This is a simplified retry - for a full implementation, you'd resend the original prompt.
    // For now, we'll just remove the error and let the user try again.
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast.info("Please try sending your message again.");
  };
  const handleRetrySummary = () => {
    // This would trigger a re-summarization call in a real scenario.
    // For now, it's a placeholder.
    toast.info("Retrying summary generation...");
  };
  return (
    <TooltipProvider>
      <div className="h-screen w-screen bg-card text-foreground overflow-hidden">
        <ThemeToggle />
        <div className={`${CONTAINER_WRAPPER} h-full`}>
          <div className={`${PAGE_SPACING} h-full`}>
            <div className="grid grid-cols-1 md:grid-cols-[300px,1fr,380px] h-full gap-4">
              {!isMobile && (
                <LeftPanel
                  agents={agents}
                  setAgents={setAgents}
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onNewSession={handleNewSession}
                  onSwitchSession={handleSwitchSession}
                  onDeleteSession={handleDeleteSession}
                  onEditAgent={handleEditAgent}
                  onPromoteAgent={handlePromoteAgent}
                />
              )}
              <CenterPanel
                isMobile={isMobile}
                agents={agents}
                setAgents={setAgents}
                sessions={sessions}
                currentSessionId={currentSessionId}
                messages={messages}
                input={input}
                isProcessing={isProcessing}
                showLimitsNotice={showLimitsNotice}
                messagesEndRef={messagesEndRef}
                onNewSession={handleNewSession}
                onSwitchSession={handleSwitchSession}
                onDeleteSession={handleDeleteSession}
                onEditAgent={handleEditAgent}
                onPromoteAgent={handlePromoteAgent}
                setShowExportModal={setShowExportModal}
                setShowLimitsNotice={setShowLimitsNotice}
                handleSubmit={handleSubmit}
                setInput={setInput}
                isShareMode={isShareMode}
                onRetry={handleRetryMessage}
              />
              {!isMobile && <RightPanel agents={agents} messages={messages} onRetrySummary={handleRetrySummary} />}
            </div>
          </div>
        </div>
        <AgentConfigDrawer
          agent={editingAgent}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSave={handleAgentUpdate}
        />
        <ExportModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          messages={messages}
        />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}