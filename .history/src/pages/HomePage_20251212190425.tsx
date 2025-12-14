import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { produce } from 'immer';
import { chatService, ExtendedMessage, generateSessionTitle } from '@/lib/chat';
import { MAX_MESSAGES } from '@/lib/local-store';
import type { SessionInfo } from '../../worker/types';
import { Agent, getAgents, saveAgents } from '@/lib/agents';
import { initializeApiConfigs } from '@/lib/api-configs';
import { AgentConfigDrawer } from '@/components/AgentConfigDrawer';
import { RightPanel } from '@/components/RightPanel';
import { ExportModal } from '@/components/ExportModal';
import { LeftPanel } from '@/components/LeftPanel';
import { CenterPanel } from '@/components/CenterPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
  const [showLengthWarning, setShowLengthWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  useTheme(); // Initialize theme
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };
  useEffect(scrollToBottom, [messages]);
  useEffect(() => {
    const warningThreshold = Math.floor(MAX_MESSAGES * 0.8);
    if (messages.length > warningThreshold && !showLengthWarning) {
      setShowLengthWarning(true);
      toast.warning('Conversation is getting long.', {
        description: `History is stored locally and will be trimmed to the latest ${MAX_MESSAGES} messages. Export or start a new session to keep everything.`,
        duration: 8000,
      });
    } else if (messages.length < warningThreshold && showLengthWarning) {
      setShowLengthWarning(false);
    }
  }, [messages, showLengthWarning]);
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

  // Initialize API configurations on app load
  useEffect(() => {
    initializeApiConfigs();
  }, []);

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
    const activeAgents = agents.filter(a => a.isActive);
    const primaryAgents = activeAgents.filter(a => a.role === 'Primary');
    const observerAgents = activeAgents.filter(a => a.role === 'Observer');
    const prunedHistory = messages.slice(-15).map(m => `${m.agentName || m.role}: ${m.content}`).join('\nPrevious: ');
    
    try {
      // Process primary agents first (sequentially to maintain chat order)
      const primaryResponses: string[] = [];
      
      for (const agent of primaryAgents) {
        setAgents(prev => produce(prev, draft => {
          const agentToUpdate = draft.find(a => a.id === agent.id);
          if (agentToUpdate) agentToUpdate.status = 'Thinking';
        }));
        
        const fullPrompt = `[You are ${agent.name}. Personality: ${agent.personality}. Previous context:\n${prunedHistory || 'New conversation.'}]\n\nUser: ${userInput}`;
        const streamId = crypto.randomUUID();
        const assistantMessage: ExtendedMessage = {
          id: streamId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Capture the full response as it streams
        let fullPrimaryResponse = '';
        const response = await chatService.sendMessage(fullPrompt, agent, (chunk) => {
          fullPrimaryResponse += chunk;
          setMessages(prev => produce(prev, draft => {
            const msg = draft.find(m => m.id === streamId);
            if (msg) msg.content += chunk;
          }));
          scrollToBottom();
        });
        
        if (!response.success) {
          throw new Error(response.error || `Agent ${agent.name} failed to respond.`);
        }
        
        // Store the primary agent's complete response for observers
        if (fullPrimaryResponse) {
          primaryResponses.push(`${agent.name}: ${fullPrimaryResponse}`);
        }
        
        setAgents(prev => produce(prev, draft => {
          const agentToUpdate = draft.find(a => a.id === agent.id);
          if (agentToUpdate) agentToUpdate.status = 'Ready';
        }));
      }
      
      // Now start all observers in parallel (non-blocking), listening to primary agent responses
      const observerPromises = observerAgents.map(async (agent) => {
        setAgents(prev => produce(prev, draft => {
          const agentToUpdate = draft.find(a => a.id === agent.id);
          if (agentToUpdate) agentToUpdate.status = 'Thinking';
        }));
        
        // Observer agents respond to the primary agent's message, not the user's
        const primaryContext = primaryResponses.length > 0
          ? primaryResponses.join('\n')
          : 'No primary agent response yet.';
        
        const fullPrompt = `[You are ${agent.name}. Personality: ${agent.personality}. Previous context:\n${prunedHistory || 'New conversation.'}]\n\nUser asked: ${userInput}\n\nPrimary agent responded:\n${primaryContext}\n\nProvide your perspective or feedback on the primary agent's response.`;
        
        try {
          let fullResponse = '';
          const response = await chatService.sendMessage(fullPrompt, agent, (chunk) => {
            fullResponse += chunk;
          });
          
          if (!response.success) {
            throw new Error(response.error || `Agent ${agent.name} failed to respond.`);
          }
          
          // Store in agent's pending messages and update status to Hand Raised
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === agent.id);
            if (agentToUpdate) {
              if (!agentToUpdate.pendingMessages) {
                agentToUpdate.pendingMessages = [];
              }
              agentToUpdate.pendingMessages.push({
                id: crypto.randomUUID(),
                content: fullResponse,
                timestamp: Date.now(),
              });
              agentToUpdate.handRaiseCount = agentToUpdate.pendingMessages.length;
              agentToUpdate.status = 'Hand Raised';
            }
          }));
        } catch (error) {
          console.error(`Observer ${agent.name} failed:`, error);
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === agent.id);
            if (agentToUpdate) agentToUpdate.status = 'Ready';
          }));
        }
      });
      
      // Wait for all observers to complete (optional - they continue in background anyway)
      await Promise.allSettled(observerPromises);
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
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast.info("Please try sending your message again.");
  };
  const handleRetrySummary = () => {
    toast.info("Retrying summary generation...");
  };

  const handleAddObserverMessageToChat = useCallback((agentId: string, messageId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !agent.pendingMessages) return;

    const message = agent.pendingMessages.find(m => m.id === messageId);
    if (!message) return;

    // Add the observer's message to chat history
    const observerMessage: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `**${agent.name} (Observer):** ${message.content}`,
      timestamp: Date.now(),
      agentId: agent.id,
    };
    setMessages(prev => [...prev, observerMessage]);

    // Clear this message and reset hand raise
    setAgents(prev => produce(prev, draft => {
      const agentToUpdate = draft.find(a => a.id === agentId);
      if (agentToUpdate) {
        agentToUpdate.pendingMessages = agentToUpdate.pendingMessages?.filter(m => m.id !== messageId) || [];
        if (agentToUpdate.pendingMessages.length === 0) {
          agentToUpdate.status = 'Ready';
          agentToUpdate.handRaiseCount = 0;
        }
      }
    }));

    toast.success(`${agent.name}'s message added to chat`);
  }, [agents, setAgents, setMessages]);

  const handleDismissObserverMessage = useCallback((agentId: string, messageId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    // Remove the message and update status
    setAgents(prev => produce(prev, draft => {
      const agentToUpdate = draft.find(a => a.id === agentId);
      if (agentToUpdate) {
        agentToUpdate.pendingMessages = agentToUpdate.pendingMessages?.filter(m => m.id !== messageId) || [];
        if (agentToUpdate.pendingMessages.length === 0) {
          agentToUpdate.status = 'Ready';
          agentToUpdate.handRaiseCount = 0;
        }
      }
    }));

    toast.info(`${agent.name}'s message dismissed`);
  }, [agents, setAgents]);

  useEffect(() => {
    if (currentSessionId) {
      const primary = agents.find(a => a.role === 'Primary');
      const model = primary?.model || agents[0]?.model;
      (async () => {
        await chatService.persistSession(currentSessionId, messages, model);
      })();
    }
  }, [agents, currentSessionId, messages]);
  return (
    <TooltipProvider>
      <div className="h-screen w-screen bg-card text-foreground overflow-hidden">
        <ThemeToggle />
        <div className="w-full h-full max-w-none px-2 sm:px-4 min-h-0">
          <div className="py-2 h-full min-h-0">
            {isMobile ? (
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
                showLengthWarning={showLengthWarning}
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
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                <ResizablePanel defaultSize={25} minSize={18} maxSize={40} className="overflow-hidden">
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
                </ResizablePanel>
                
                <ResizableHandle withHandle className="w-1 mx-1 bg-border hover:bg-primary/20 transition-colors" />
                
                <ResizablePanel defaultSize={50} minSize={30} className="overflow-hidden">
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
                    showLengthWarning={showLengthWarning}
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
                </ResizablePanel>
                
                <ResizableHandle withHandle className="w-1 mx-1 bg-border hover:bg-primary/20 transition-colors" />
                
                <ResizablePanel defaultSize={25} minSize={18} maxSize={40} className="overflow-hidden">
                  <RightPanel 
                    agents={agents} 
                    messages={messages} 
                    isProcessing={isProcessing} 
                    onRetrySummary={handleRetrySummary}
                    onAddObserverMessage={handleAddObserverMessageToChat}
                    onDismissObserverMessage={handleDismissObserverMessage}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
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
