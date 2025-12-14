import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { produce } from 'immer';
import { chatService, ExtendedMessage, generateSessionTitle } from '@/lib/chat';
import type { SessionInfo } from '../../worker/types';
import { Agent, AgentSeverity, getAgents, saveAgents, applySessionStateToAgents, extractSessionStateFromAgents, resetAgentSessionState } from '@/lib/agents';
import { MAX_MESSAGES, getSessionAgentStates, saveSessionAgentStates, clearSessionAgentStates, IDB_ISSUE_EVENT, resetLocalDatabase } from '@/lib/local-store';
import { getApiConfigs, initializeApiConfigs } from '@/lib/api-configs';
import { initializeAgentConfigs } from '@/lib/agent-configs';
import { exportConfigToYAML, exportSessionToYAML, generateExportFilename, generateSessionExportFilename, downloadYAMLFile } from '@/lib/config-import-export';
import { AgentConfigDrawer } from '@/components/AgentConfigDrawer';
import { RightPanel } from '@/components/RightPanel';
import { ExportModal } from '@/components/ExportModal';
import { ObserverMessagesDrawer } from '@/components/ObserverMessagesDrawer';
import { ConfigDrawer } from '@/components/ConfigDrawer';
import { Button } from '@/components/ui/button';
import { LeftPanel } from '@/components/LeftPanel';
import { CenterPanel } from '@/components/CenterPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { CONTAINER_WRAPPER, PAGE_SPACING } from './_workspaceStyles';

// Helper function to parse SEVERITY from observer response
const parseSeverity = (content: string): { severity: AgentSeverity; cleanContent: string } => {
  const severityMatch = content.match(/^SEVERITY:\s*(NONE|MINOR|IMPORTANT|CRITICAL)\s*\n?/i);
  if (severityMatch) {
    const severity = severityMatch[1].toUpperCase() as AgentSeverity;
    const cleanContent = content.substring(severityMatch[0].length).trim();
    return { severity, cleanContent };
  }
  return { severity: 'NONE', cleanContent: content };
};

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
  const [selectedObserverAgent, setSelectedObserverAgent] = useState<Agent | null>(null);
  const [isObserverDrawerOpen, setIsObserverDrawerOpen] = useState(false);
  const [isDbDrawerOpen, setIsDbDrawerOpen] = useState(false);
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  useTheme(); // Initialize theme
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Create observer shortcuts mapping (only for agents with pending messages)
  const observerShortcuts = useMemo(() => {
    const map = new Map<string, number>();
    agents.forEach((agent, index) => {
      if (agent.role === 'Observer' && agent.status === 'Hand Raised' && agent.pendingMessages && agent.pendingMessages.length > 0) {
        map.set(agent.id, index + 1);
      }
    });
    return map;
  }, [agents]);

  const handleEditAgent = useCallback((agent: Agent | null) => {
    setEditingAgent(agent);
    setIsDrawerOpen(true);
  }, []);

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
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setDbErrorMessage(detail?.message || 'IndexedDB is unavailable or incompatible with this version.');
      setIsDbDrawerOpen(true);
    };
    window.addEventListener(IDB_ISSUE_EVENT, handler);

    // If an issue was already flagged before the listener mounted, surface it now
    try {
      if (sessionStorage.getItem('conclave:idb-alerted') === 'true') {
        setDbErrorMessage('IndexedDB is unavailable or incompatible with this version.');
        setIsDbDrawerOpen(true);
      }
    } catch {
      // Ignore storage access issues; the live event will still open the drawer.
    }

    return () => window.removeEventListener(IDB_ISSUE_EVENT, handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (!(e.metaKey || e.ctrlKey)) return;

      // Cmd+0: Focus input and scroll to bottom
      if (e.key === '0') {
        e.preventDefault();
        inputRef.current?.focus();
        scrollToBottom();
        toast.info('Jump to input');
        return;
      }

      // Cmd+1-9: Open observer messages (only if they exist)
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const agent = agents[num - 1];
        if (agent && agent.role === 'Observer' && agent.status === 'Hand Raised' && agent.pendingMessages && agent.pendingMessages.length > 0) {
          setSelectedObserverAgent(agent);
          setIsObserverDrawerOpen(true);
          toast.info(`Opening ${agent.name}'s message`);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agents, scrollToBottom]);
  const handleSwitchSession = useCallback(async (sessionId: string) => {
    // Save current session's agent states before switching
    if (currentSessionId) {
      const currentStates = extractSessionStateFromAgents(agents);
      await saveSessionAgentStates(currentSessionId, currentStates);
    }
    
    chatService.switchSession(sessionId);
    setCurrentSessionId(sessionId);
    const res = await chatService.getMessages();
    setMessages(res.success && res.data ? res.data.messages : []);
    
    // Load the new session's agent states
    const newSessionStates = await getSessionAgentStates(sessionId);
    const baseAgents = getAgents(); // Get fresh agent configs
    const agentsWithSessionState = applySessionStateToAgents(baseAgents, newSessionStates);
    setAgents(agentsWithSessionState);
  }, [currentSessionId, agents]);
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
    // Save current session's agent states before creating new session
    if (currentSessionId) {
      const currentStates = extractSessionStateFromAgents(agents);
      await saveSessionAgentStates(currentSessionId, currentStates);
    }
    
    const res = await chatService.createSession(generateSessionTitle());
    if (res.success && res.data) {
      await loadSessions(res.data.sessionId);
      // Reset agents to clean state for new session
      const baseAgents = getAgents();
      const cleanAgents = baseAgents.map(resetAgentSessionState);
      setAgents(cleanAgents);
    }
  }, [loadSessions, currentSessionId, agents]);

  // Initialize API configurations on app load
  useEffect(() => {
    initializeApiConfigs();
    initializeAgentConfigs();
  }, []);

  // Save agent states to current session whenever agents change
  useEffect(() => {
    if (currentSessionId && agents.length > 0) {
      const sessionStates = extractSessionStateFromAgents(agents);
      saveSessionAgentStates(currentSessionId, sessionStates);
    }
  }, [agents, currentSessionId]);

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
    await clearSessionAgentStates(sessionId); // Clean up agent states for deleted session
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      // Reset agents to clean state
      const baseAgents = getAgents();
      const cleanAgents = baseAgents.map(resetAgentSessionState);
      setAgents(cleanAgents);
    }
    await loadSessions();
  };
  const handleQuickConfigExport = useCallback(() => {
    try {
      const yamlContent = exportConfigToYAML(agents, getApiConfigs());
      const filename = generateExportFilename();
      downloadYAMLFile(yamlContent, filename);
      toast.success(`Configuration exported for backup (${agents.length} agents, ${getApiConfigs().length} API configs).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to export configuration: ${message}`);
    }
  }, [agents]);
  const handleReformatLocalDb = useCallback(async () => {
    try {
      await resetLocalDatabase();
      toast.success('Local database cleared. Reloading to rebuild storage...');
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to reformat local DB: ${message}`);
    }
  }, []);
  const handleAgentUpdate = (updatedAgent: Agent) => {
    const newAgents = produce(agents, draft => {
      const index = draft.findIndex(a => a.id === updatedAgent.id);
      if (index !== -1) draft[index] = updatedAgent;
      else draft.push(updatedAgent);
    });
    setAgents(newAgents);
    saveAgents(newAgents);
  };
  const handlePromoteAgent = (agentId: string, newRole: 'Primary' | 'Summarizer' | 'Observer') => {
    const newAgents = produce(agents, draft => {
      // If promoting to Primary, demote current Primary to Observer
      if (newRole === 'Primary') {
        const currentPrimary = draft.find(a => a.role === 'Primary');
        if (currentPrimary) currentPrimary.role = 'Observer';
      }
      
      // If promoting to Summarizer, demote current Summarizer to Observer
      if (newRole === 'Summarizer') {
        const currentSummarizer = draft.find(a => a.role === 'Summarizer');
        if (currentSummarizer) currentSummarizer.role = 'Observer';
      }
      
      // Promote the selected agent
      const agent = draft.find(a => a.id === agentId);
      if (agent) agent.role = newRole;
    });
    setAgents(newAgents);
    saveAgents(newAgents);
  };

  const handleUpdateAgentStatus = (agentId: string, status: 'Thinking' | 'Ready') => {
    setAgents(prev => produce(prev, draft => {
      const agent = draft.find(a => a.id === agentId);
      if (agent) agent.status = status;
    }));
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
        
        const fullPrompt = `Previous context:\n${prunedHistory || 'New conversation.'}\n\nUser: ${userInput}`;
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
        
        const fullPrompt = `Previous context:\n${prunedHistory || 'New conversation.'}\n\nUser asked: ${userInput}\n\nPrimary agent responded:\n${primaryContext}\n\nProvide your perspective or feedback on the primary agent's response.`;
        
        try {
          let fullResponse = '';
          const response = await chatService.sendMessage(fullPrompt, agent, (chunk) => {
            fullResponse += chunk;
          });
          
          if (!response.success) {
            throw new Error(response.error || `Agent ${agent.name} failed to respond.`);
          }
          
          // Parse SEVERITY from response
          const { severity, cleanContent } = parseSeverity(fullResponse);
          
          // Store in agent's pending messages and update status based on severity
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === agent.id);
            if (agentToUpdate) {
              agentToUpdate.severity = severity;
              
              // If NONE, keep silent (no pending message, stay Ready)
              if (severity === 'NONE') {
                agentToUpdate.status = 'Ready';
                agentToUpdate.pendingMessages = [];
                agentToUpdate.handRaiseCount = 0;
              } else {
                // For MINOR, IMPORTANT, CRITICAL: store message and raise hand
                agentToUpdate.pendingMessages = [{
                  id: crypto.randomUUID(),
                  content: cleanContent, // Use cleaned content without SEVERITY: line
                  timestamp: Date.now(),
                }];
                agentToUpdate.handRaiseCount = 1;
                agentToUpdate.status = 'Hand Raised';
              }
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

    // Add the observer's message to chat history as a user message
    const observerMessage: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `${agent.name} (Observer): ${message.content}`,
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

    // Trigger primary agent response
    (async () => {
      if (isProcessing) return;
      
      setIsProcessing(true);
      const userInput = `${agent.name} (Observer): ${message.content}`;
      const activeAgents = agents.filter(a => a.isActive);
      const primaryAgents = activeAgents.filter(a => a.role === 'Primary');
      const observerAgents = activeAgents.filter(a => a.role === 'Observer');
      const prunedHistory = messages.slice(-15).map(m => `${m.agentName || m.role}: ${m.content}`).join('\nPrevious: ');
      
      try {
        // Process primary agents
        const primaryResponses: string[] = [];
        
        for (const primaryAgent of primaryAgents) {
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === primaryAgent.id);
            if (agentToUpdate) agentToUpdate.status = 'Thinking';
          }));
          
          const fullPrompt = `Previous context:\n${prunedHistory || 'New conversation.'}\n\nUser: ${userInput}`;
          const streamId = crypto.randomUUID();
          const assistantMessage: ExtendedMessage = {
            id: streamId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            agentId: primaryAgent.id,
            agentName: primaryAgent.name,
            agentColor: primaryAgent.color
          };
          setMessages(prev => [...prev, assistantMessage]);
          
          let fullPrimaryResponse = '';
          const response = await chatService.sendMessage(fullPrompt, primaryAgent, (chunk) => {
            fullPrimaryResponse += chunk;
            setMessages(prev => produce(prev, draft => {
              const msg = draft.find(m => m.id === streamId);
              if (msg) msg.content += chunk;
            }));
            scrollToBottom();
          });
          
          if (!response.success) {
            throw new Error(response.error || `Agent ${primaryAgent.name} failed to respond.`);
          }
          
          if (fullPrimaryResponse) {
            primaryResponses.push(`${primaryAgent.name}: ${fullPrimaryResponse}`);
          }
          
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === primaryAgent.id);
            if (agentToUpdate) agentToUpdate.status = 'Ready';
          }));
        }

        // Process observer agents in parallel
        const combinedContext = primaryResponses.length > 0 ? primaryResponses.join('\n\n') : userInput;
        const observerPromises = observerAgents.map(async (observerAgent) => {
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === observerAgent.id);
            if (agentToUpdate) agentToUpdate.status = 'Thinking';
          }));

          const observerPrompt = `Previous context:\n${prunedHistory || 'New conversation.'}\n\nUser: ${userInput}\n\nPrimary Agent Response:\n${combinedContext}\n\nDo you have additional insights? If yes, respond with your contribution. If no, respond with exactly 'PASS' or '✓'. Be concise.`;
          
          let fullResponse = '';
          const res = await chatService.sendMessage(observerPrompt, observerAgent, (chunk) => {
            fullResponse += chunk;
          });
          
          if (!res.success) {
            throw new Error(res.error || `Agent ${observerAgent.name} failed to respond.`);
          }
          
          // Parse SEVERITY from response
          const { severity, cleanContent } = parseSeverity(fullResponse);
          
          setAgents(prev => produce(prev, draft => {
            const agentToUpdate = draft.find(a => a.id === observerAgent.id);
            if (agentToUpdate) {
              agentToUpdate.severity = severity;
              
              // If NONE or PASS, keep silent
              const output = cleanContent.trim();
              if (severity === 'NONE' || output === 'PASS' || output === '✓' || output.length <= 5) {
                agentToUpdate.status = 'Ready';
                agentToUpdate.pendingMessages = [];
                agentToUpdate.handRaiseCount = 0;
              } else {
                // For MINOR, IMPORTANT, CRITICAL: store message and raise hand
                const newMessage = { id: crypto.randomUUID(), content: cleanContent, timestamp: Date.now() };
                agentToUpdate.pendingMessages = [newMessage];
                agentToUpdate.status = 'Hand Raised';
                agentToUpdate.handRaiseCount = (agentToUpdate.handRaiseCount || 0) + 1;
              }
            }
          }));
        });

        await Promise.allSettled(observerPromises);
      } catch (error) {
        console.error("Chat orchestration error:", error);
        toast.error("An agent failed to respond. Please check limits or try again.");
        const errorMessage: ExtendedMessage = { 
          id: crypto.randomUUID(), 
          role: 'assistant', 
          content: `Error: Could not generate a complete response. An agent failed.`, 
          timestamp: Date.now(), 
          isError: true 
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
    })();
  }, [agents, setAgents, setMessages, messages, isProcessing, scrollToBottom]);

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

  const handleInsertObserverMessageToInput = useCallback((agentId: string, messageId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !agent.pendingMessages) return;

    const message = agent.pendingMessages.find(m => m.id === messageId);
    if (!message) return;

    // Insert the message content into the input field
    const messageText = `${agent.name} (Observer): ${message.content}`;
    setInput(messageText);

    // Focus the input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    // Clear the observer's pending message
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

    toast.success(`${agent.name}'s message inserted to input`);
  }, [agents, setAgents, setInput, inputRef]);

  const handleExportSession = useCallback(async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        toast.error('Session not found');
        return;
      }

      // Get session messages
      const sessionState = await chatService.getSessionState(sessionId);
      const sessionMessages = sessionState?.messages || [];

      // Get session agent states
      const agentStates = await getSessionAgentStates(sessionId);

      // Get model from session state or first active agent
      const model = sessionState?.model || agents.find(a => a.isActive)?.model || 'gemini-2.5-flash';

      // Export to YAML
      const yamlContent = exportSessionToYAML(session.id, session.title, sessionMessages, agentStates, getApiConfigs());
      const filename = generateSessionExportFilename(session.title);
      
      downloadYAMLFile(yamlContent, filename);
      
      toast.success(`Session "${session.title}" exported successfully!`);
    } catch (error) {
      console.error('Failed to export session:', error);
      toast.error('Failed to export session');
    }
  }, [sessions, agents]);

  const handleImportSession = useCallback(async (sessionData: any) => {
    try {
      // Save current session's agent states before importing
      if (currentSessionId) {
        const currentStates = extractSessionStateFromAgents(agents);
        await saveSessionAgentStates(currentSessionId, currentStates);
      }

      // Create a new session with a unique ID
      const newSessionId = crypto.randomUUID();
      const newSession: SessionInfo = {
        ...sessionData.session,
        id: newSessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create the session with imported messages
      const res = await chatService.createSessionWithData(
        newSession.title,
        sessionData.messages || [],
        sessionData.model || 'gemini-2.5-flash'
      );

      if (res.success && res.data) {
        const createdSessionId = res.data.sessionId;
        
        // Save imported agent states to the new session
        if (sessionData.agentStates) {
          await saveSessionAgentStates(createdSessionId, sessionData.agentStates);
        }

        // Reload sessions list
        await loadSessions(createdSessionId);
        
        // Switch to the imported session
        await handleSwitchSession(createdSessionId);
      }
    } catch (error) {
      console.error('Failed to import session:', error);
      throw error; // Re-throw to let SettingsDrawer show the error
    }
  }, [currentSessionId, agents, loadSessions, handleSwitchSession]);

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
                inputRef={inputRef}
                onNewSession={handleNewSession}
                onSwitchSession={handleSwitchSession}
                onDeleteSession={handleDeleteSession}
                onExportSession={handleExportSession}
                onImportSession={handleImportSession}
                onEditAgent={handleEditAgent}
                onPromoteAgent={handlePromoteAgent}
                setShowExportModal={setShowExportModal}
                setShowLimitsNotice={setShowLimitsNotice}
                handleSubmit={handleSubmit}
                setInput={setInput}
                isShareMode={isShareMode}
                onRetry={handleRetryMessage}
                onAddObserverMessage={handleAddObserverMessageToChat}
                onDismissObserverMessage={handleDismissObserverMessage}
                onInsertObserverMessageToInput={handleInsertObserverMessageToInput}
                observerShortcuts={observerShortcuts}
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
                    onExportSession={handleExportSession}
                    onImportSession={handleImportSession}
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
                    inputRef={inputRef}
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
                    onInsertObserverMessageToInput={handleInsertObserverMessageToInput}
                    observerShortcuts={observerShortcuts}
                    onUpdateAgentStatus={handleUpdateAgentStatus}
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
        <ObserverMessagesDrawer
          isOpen={isObserverDrawerOpen}
          onClose={() => setIsObserverDrawerOpen(false)}
          agent={selectedObserverAgent}
          onAddToChat={handleAddObserverMessageToChat}
          onDismiss={handleDismissObserverMessage}
          onInsertToInput={handleInsertObserverMessageToInput}
        />
        <ExportModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          messages={messages}
        />
        <ConfigDrawer
          isOpen={isDbDrawerOpen}
          onClose={() => setIsDbDrawerOpen(false)}
          title="Local Database Update Needed"
          description="Your local chat storage looks incompatible with this version. We can reformat it after you back up your data."
          maxWidth="max-w-3xl"
          footerActions={
            <div className="flex flex-wrap justify-between items-center gap-2 w-full">
              <Button variant="ghost" onClick={() => setIsDbDrawerOpen(false)}>
                Keep running (use memory)
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleQuickConfigExport}>
                  Export configs (YAML)
                </Button>
                <Button onClick={handleReformatLocalDb}>
                  Reformat local DB
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-100">
                We detected an IndexedDB issue and temporarily fell back to in-memory storage. 
                {dbErrorMessage && (
                  <span className="block mt-1 text-xs text-amber-700 dark:text-amber-200">
                    Details: {dbErrorMessage}
                  </span>
                )}
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Export agents and API configs (including keys) before resetting.</li>
              <li>Export any sessions you want to keep from the session list’s download buttons.</li>
              <li>After reformatting, import your YAML backup to restore configs.</li>
              <li>Reformatting deletes the local IndexedDB and reloads the app with a clean schema.</li>
            </ul>
          </div>
        </ConfigDrawer>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
