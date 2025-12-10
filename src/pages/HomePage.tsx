import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Send, Plus, Trash2, Settings, Menu, X, AlertTriangle, MessageSquare, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster, toast } from 'sonner';
import { produce } from 'immer';
import { chatService, formatTime } from '@/lib/chat';
import type { SessionInfo } from '../../worker/types';
import type { Message } from '../../worker/types';
import { Agent, getAgents, saveAgents, updateAgent, deleteAgent, defaultAgents } from '@/lib/agents';
import { AgentCard } from '@/components/AgentCard';
import { AgentConfigDrawer } from '@/components/AgentConfigDrawer';
import { RightPanel } from '@/components/RightPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
type ExtendedMessage = Message & { agentId?: string; agentName?: string; agentColor?: string; };
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);
  const loadSessions = useCallback(async () => {
    const res = await chatService.listSessions();
    if (res.success && res.data) {
      setSessions(res.data);
      if (!currentSessionId && res.data.length > 0) {
        handleSwitchSession(res.data[0].id);
      } else if (!currentSessionId && res.data.length === 0) {
        handleNewSession();
      }
    }
  }, [currentSessionId]);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  const handleNewSession = async () => {
    const res = await chatService.createSession();
    if (res.success && res.data) {
      chatService.switchSession(res.data.sessionId);
      setCurrentSessionId(res.data.sessionId);
      setMessages([]);
      await loadSessions();
    }
  };
  const handleSwitchSession = async (sessionId: string) => {
    chatService.switchSession(sessionId);
    setCurrentSessionId(sessionId);
    const res = await chatService.getMessages();
    if (res.success && res.data) {
      setMessages(res.data.messages);
    } else {
      setMessages([]);
    }
  };
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
      if (index !== -1) {
        draft[index] = updatedAgent;
      } else {
        draft.push({ ...updatedAgent, id: crypto.randomUUID() });
      }
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
    if (!input.trim() || isProcessing) return;
    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);
    const userMessage: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    if (messages.length === 0) {
      await chatService.createSession(undefined, chatService.getSessionId(), userInput);
      await loadSessions();
    }
    const activeAgents = agents.filter(a => a.isActive).sort((a, b) => (a.role === 'Primary' ? -1 : b.role === 'Primary' ? 1 : 0));
    for (const agent of activeAgents) {
      setAgents(prev => produce(prev, draft => {
        const agentToUpdate = draft.find(a => a.id === agent.id);
        if (agentToUpdate) agentToUpdate.status = 'Thinking';
      }));
      const personaPrefix = `[You are ${agent.name}. Personality: ${agent.personality}] User says: `;
      const fullPrompt = personaPrefix + userInput;
      const streamId = crypto.randomUUID();
      const assistantMessage: ExtendedMessage = {
        id: streamId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color,
      };
      setMessages(prev => [...prev, assistantMessage]);
      await chatService.sendMessage(fullPrompt, agent.model, (chunk) => {
        setMessages(prev => produce(prev, draft => {
          const msg = draft.find(m => m.id === streamId);
          if (msg) {
            msg.content += chunk;
          }
        }));
        scrollToBottom();
      });
      setAgents(prev => produce(prev, draft => {
        const agentToUpdate = draft.find(a => a.id === agent.id);
        if (agentToUpdate) agentToUpdate.status = 'Ready';
      }));
    }
    setIsProcessing(false);
  };
  const LeftPanel = () => (
    <aside className="h-full flex flex-col bg-card border-r">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold font-display">Conclave</h1>
        <p className="text-sm text-muted-foreground">Multi-Agent Chat</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Agents</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingAgent(defaultAgents()[0]); setIsDrawerOpen(true); }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() => { setEditingAgent(agent); setIsDrawerOpen(true); }}
                  onDelete={(id) => { deleteAgent(id); setAgents(getAgents()); }}
                  onPromote={handlePromoteAgent}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Sessions</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewSession}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {sessions.map(session => (
                <div key={session.id} className={cn("group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent", currentSessionId === session.id && "bg-accent")}>
                  <button onClick={() => handleSwitchSession(session.id)} className="flex-1 text-left text-sm truncate pr-2">
                    {session.title}
                  </button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteSession(session.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="p-4 border-t text-xs text-muted-foreground">
        <p>Built with ❤️ at Cloudflare</p>
      </div>
    </aside>
  );
  const CenterPanel = () => (
    <main className="flex flex-col h-full bg-background">
      <header className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-full max-w-xs"><LeftPanel /></SheetContent>
            </Sheet>
          )}
          <div className="flex items-center -space-x-2">
            {agents.filter(a => a.isActive).slice(0, 3).map(a => (
              <div key={a.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-background ${a.color}`}>
                {a.name.charAt(0)}
              </div>
            ))}
          </div>
          <h2 className="font-semibold">{sessions.find(s => s.id === currentSessionId)?.title || 'New Chat'}</h2>
        </div>
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Users className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-full max-w-xs"><RightPanel agents={agents} /></SheetContent>
          </Sheet>
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-4" ref={messagesEndRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {showLimitsNotice && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>There is a limit on AI requests across all user apps. Please be mindful of usage.</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setShowLimitsNotice(false)}><X className="w-4 h-4" /></Button>
            </div>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0", msg.agentColor || 'bg-gray-400')}>
                  {msg.agentName?.charAt(0) || 'A'}
                </div>
              )}
              <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                {msg.role === 'assistant' && <p className="font-bold text-sm mb-1">{msg.agentName}</p>}
                <p className="whitespace-pre-wrap">{msg.content}{isProcessing && messages[messages.length - 1].id === msg.id ? <span className="stream-cursor" /> : ''}</p>
                <p className="text-xs opacity-60 text-right mt-2">{formatTime(msg.timestamp)}</p>
              </div>
              {msg.role === 'user' && <User className="w-8 h-8 p-1.5 rounded-full bg-muted text-muted-foreground flex-shrink-0" />}
            </motion.div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-16">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">Welcome to Conclave</h3>
              <p>Start a conversation with your AI team.</p>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 border-t flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e); }}
              placeholder="Message your AI team..."
              className="pr-12 min-h-[48px] max-h-48 resize-none"
              rows={1}
              disabled={isProcessing}
            />
            <Button type="submit" size="icon" className="absolute right-2 bottom-2" disabled={!input.trim() || isProcessing}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
  return (
    <div className="h-screen w-screen bg-card text-foreground overflow-hidden">
      <div className="grid md:grid-cols-[280px,1fr,340px] h-full">
        {!isMobile && <LeftPanel />}
        <CenterPanel />
        {!isMobile && <RightPanel agents={agents} />}
      </div>
      <AgentConfigDrawer
        agent={editingAgent}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleAgentUpdate}
      />
      <Toaster />
    </div>
  );
}