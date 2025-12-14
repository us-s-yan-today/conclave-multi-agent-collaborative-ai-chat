import { Agent, getAgents, deleteAgent, loadAgentTemplate, getAgentTemplates } from '@/lib/agents';
import type { SessionInfo } from '../../worker/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2 } from 'lucide-react';
import { AgentCard } from '@/components/AgentCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
interface LeftPanelProps {
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onEditAgent: (agent: Agent | null) => void;
  onPromoteAgent: (agentId: string) => void;
}
export function LeftPanel({
  agents,
  setAgents,
  sessions,
  currentSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onEditAgent,
  onPromoteAgent,
}: LeftPanelProps) {
  return (
    <aside className="h-full min-h-0 flex flex-col bg-card border rounded-lg min-w-0 overflow-hidden">
      <div className="p-3 sm:p-4 border-b flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold font-display text-gradient truncate">Conclave</h1>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">Multi-Agent Collaborative AI</p>
      </div>
      <ScrollArea type="always" className="flex-1 min-h-0 chat-scroll overflow-auto">
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Agents</h2>
              <div className="flex items-center gap-1">
                <Select onValueChange={id => {
                  const templ = loadAgentTemplate(id);
                  if (templ) onEditAgent(templ);
                }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectTrigger className="h-7 w-auto text-xs px-2 border-dashed">
                        <SelectValue placeholder="Template" />
                      </SelectTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Add agent from template</TooltipContent>
                  </Tooltip>
                  <SelectContent>
                    {getAgentTemplates().map(t => <SelectItem key={t.templateId} value={t.templateId}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditAgent(null)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create New Agent</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {agents.map(agent => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: "easeInOut"
                    }}
                    layout
                  >
                    <AgentCard
                      agent={agent}
                      onEdit={() => onEditAgent(agent)}
                      onDelete={(id) => {
                        deleteAgent(id);
                        setAgents(getAgents());
                      }}
                      onPromote={onPromoteAgent}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Sessions</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewSession}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-1">
              {sessions.map(session => (
                <div key={session.id} className={cn("group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent dark:hover:bg-muted/50 min-w-0", currentSessionId === session.id && "bg-accent dark:bg-muted/50 border-l-2 border-primary")}>
                  <button onClick={() => onSwitchSession(session.id)} className="flex-1 text-left text-xs sm:text-sm truncate pr-2 font-medium min-w-0">
                    {session.title}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDeleteSession(session.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Session</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="p-3 sm:p-4 border-t text-xs text-muted-foreground flex-shrink-0">
        <p className="truncate">Built with ❤️ at Cloudflare</p>
      </div>
    </aside>
  );
}
