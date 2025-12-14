import { FormEvent, RefObject } from 'react';
import { motion } from 'framer-motion';
import { Agent } from '@/lib/agents';
import { ExtendedMessage } from '@/lib/chat';
import type { SessionInfo } from '../../worker/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeftPanel } from '@/components/LeftPanel';
import { RightPanel } from '@/components/RightPanel';
import { Menu, Users, Send, User, AlertTriangle, X, MessageSquare, FileDown, Lock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/chat';
import { MAX_MESSAGES } from '@/lib/local-store';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
interface CenterPanelProps {
  isMobile: boolean;
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  messages: ExtendedMessage[];
  input: string;
  isProcessing: boolean;
  showLimitsNotice: boolean;
  showLengthWarning: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef?: RefObject<HTMLTextAreaElement>;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onEditAgent: (agent: Agent | null) => void;
  onPromoteAgent: (agentId: string) => void;
  setShowExportModal: (show: boolean) => void;
  setShowLimitsNotice: (show: boolean) => void;
  handleSubmit: (e: FormEvent) => void;
  setInput: (input: string) => void;
  isShareMode: boolean;
  onRetry: (messageId: string) => void;
  onAddObserverMessage?: (agentId: string, messageId: string) => void;
  onDismissObserverMessage?: (agentId: string, messageId: string) => void;
  onInsertObserverMessageToInput?: (agentId: string, messageId: string) => void;
  observerShortcuts?: Map<string, number>;
}
export function CenterPanel({
  isMobile,
  agents,
  setAgents,
  sessions,
  currentSessionId,
  messages,
  input,
  isProcessing,
  showLimitsNotice,
  showLengthWarning,
  messagesEndRef,
  inputRef,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onEditAgent,
  onPromoteAgent,
  setShowExportModal,
  setShowLimitsNotice,
  handleSubmit,
  setInput,
  isShareMode,
  onRetry,
  onAddObserverMessage = () => {},
  onDismissObserverMessage = () => {},
  onInsertObserverMessageToInput = () => {},
  observerShortcuts,
}: CenterPanelProps) {
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const activeAgents = agents.filter(a => a.isActive);
  const primaryAgent = activeAgents.find(a => a.role === 'Primary');
  const observerAgents = activeAgents.filter(a => a.role === 'Observer');
  return (
    <main className="flex flex-col h-full min-h-0 bg-background border rounded-lg overflow-hidden">
      <header className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button></SheetTrigger>
              <SheetContent side="left" className="p-0 w-full max-w-xs">
                <LeftPanel agents={agents} setAgents={setAgents} sessions={sessions} currentSessionId={currentSessionId} onNewSession={onNewSession} onSwitchSession={onSwitchSession} onDeleteSession={onDeleteSession} onEditAgent={onEditAgent} onPromoteAgent={onPromoteAgent} />
              </SheetContent>
            </Sheet>
          )}
          <div className="flex items-center -space-x-2">
            {activeAgents.slice(0, 3).map(a => (
              <div key={a.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-background ${a.color}`}>{a.name.charAt(0)}</div>
            ))}
          </div>
          <h2 className="font-semibold">{currentSession?.title || 'New Chat'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="transition-transform hover:scale-105" onClick={() => setShowExportModal(true)}>
            <FileDown className="w-4 h-4 mr-2" />Export
          </Button>
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon"><Users className="w-5 h-5" /></Button></SheetTrigger>
              <SheetContent side="right" className="p-0 w-full max-w-xs">
                <RightPanel 
                  agents={agents} 
                  messages={messages} 
                  isProcessing={isProcessing} 
                  onRetrySummary={() => {}} 
                  onAddObserverMessage={onAddObserverMessage}
                  onDismissObserverMessage={onDismissObserverMessage}
                  onInsertObserverMessageToInput={onInsertObserverMessageToInput}
                  observerShortcuts={observerShortcuts}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      <ScrollArea type="always" className="flex-1 min-h-0 chat-scroll overflow-auto">
        <div className="p-2 sm:p-4">
          <div className="w-full space-y-4 sm:space-y-6">
            {showLengthWarning && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-lg flex items-center gap-3 text-sm flex-shrink-0">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">Conversation is long. We keep only the latest {MAX_MESSAGES} messages locally. <Button variant="link" className="p-0 h-auto text-amber-800 dark:text-amber-300" onClick={() => setShowExportModal(true)}>Export</Button> or start a <Button variant="link" className="p-0 h-auto text-amber-800 dark:text-amber-300" onClick={onNewSession}>New Chat</Button>.</span>
              </motion.div>
            )}
            {showLimitsNotice && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 p-3 rounded-lg flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>There is a limit on AI requests across all user apps. Please be mindful of usage.</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setShowLimitsNotice(false)}><X className="w-4 h-4" /></Button>
              </div>
            )}
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0", msg.agentColor || 'bg-gray-400')}>{msg.agentName?.charAt(0) || 'A'}</div>}
                <div className={`max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-2xl break-words ${msg.isError ? 'bg-destructive/10 border border-destructive/20' : (msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none dark:bg-primary/90' : 'bg-muted rounded-bl-none dark:bg-muted/80')}`}>
                  {msg.role === 'assistant' && <p className="font-bold text-xs sm:text-sm mb-1">{msg.agentName}</p>}
                  <p className="whitespace-pre-wrap text-sm sm:text-base break-words overflow-wrap-anywhere">{msg.content}{isProcessing && messages[messages.length - 1].id === msg.id ? <span className="stream-cursor" /> : ''}</p>
                  {msg.isError && <div className="mt-2"><p className="text-xs text-destructive mb-1">Storage limit may have been reached.</p><Button variant="outline" size="sm" onClick={() => onRetry(msg.id)}><RotateCcw className="w-3 h-3 mr-2" />Retry</Button></div>}
                  <p className="text-xs opacity-60 text-right mt-1 sm:mt-2">{formatTime(msg.timestamp)}</p>
                </div>
                {msg.role === 'user' && <User className="w-6 h-6 sm:w-8 sm:h-8 p-1 sm:p-1.5 rounded-full bg-muted text-muted-foreground flex-shrink-0" />}
              </motion.div>
            ))}
            {isProcessing && messages.length > 0 && messages[messages.length-1].role === 'user' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 sm:gap-3 justify-start">
                <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
                <div className="max-w-[85%] sm:max-w-[80%] w-full space-y-2">
                  <div className="flex items-center gap-2">
                    {primaryAgent && <Badge variant="secondary">{primaryAgent.name} thinking...</Badge>}
                    {observerAgents.length > 0 && <Badge variant="outline">Observers waiting...</Badge>}
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </motion.div>
            )}
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-16">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">Welcome to Conclave</h3>
                <p>Start a conversation with your AI team. Use a template to create a new agent.</p>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="p-2 sm:p-4 border-t flex-shrink-0">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative">
            {isShareMode && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Badge variant="secondary"><Lock className="w-3 h-3 mr-2" />Read-Only Mode</Badge>
                </motion.div>
              </div>
            )}
            <Textarea 
              ref={inputRef}
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e); }} 
              placeholder="Message your AI team..." 
              className="pr-12 min-h-[48px] max-h-48 resize-none focus:ring-2 focus:ring-ring focus:border-ring" 
              rows={1} 
              disabled={isProcessing || isShareMode} 
            />
            <Button type="submit" size="icon" className="absolute right-2 bottom-2 transition-transform hover:scale-105 active:scale-95" disabled={!input.trim() || isProcessing || isShareMode}><Send className="w-4 h-4" /></Button>
          </div>
        </form>
      </div>
    </main>
  );
}
