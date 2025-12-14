import { useState } from 'react';
import { Agent, getAgents, deleteAgent, loadAgentTemplate, getAgentTemplates } from '@/lib/agents';
import type { SessionInfo } from '../../worker/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Settings } from 'lucide-react';
import { AgentCard } from '@/components/AgentCard';
import { SettingsDrawer } from '@/components/SettingsDrawer';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  return (
    <aside className="h-full min-h-0 flex flex-col bg-card border rounded-lg w-full max-w-full overflow-hidden">
      <div className="p-2 sm:p-3 border-b flex-shrink-0">
        <h1 className="text-lg sm:text-xl font-bold font-display text-gradient truncate">Conclave</h1>
        <p className="text-xs text-muted-foreground truncate">Multi-Agent Collaborative AI</p>
      </div>
      <ScrollArea type="always" className="flex-1 min-h-0 chat-scroll overflow-hidden">
        <div className="p-2 sm:p-3 space-y-3 sm:space-y-4 w-full max-w-full overflow-hidden">
          <div className="w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between gap-1 mb-2 w-full">
              <h2 className="text-xs sm:text-sm font-semibold uppercase text-muted-foreground tracking-wider truncate flex-shrink">Agents</h2>
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <Select onValueChange={id => {
                  const templ = loadAgentTemplate(id);
                  if (templ) onEditAgent(templ);
                }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectTrigger className="h-6 sm:h-7 w-[70px] sm:w-[90px] text-[10px] sm:text-xs px-1 sm:px-2 border-dashed">
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => onEditAgent(null)}>
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create New Agent</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="space-y-1 w-full max-w-full overflow-hidden">
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
          <div className="w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between gap-1 mb-2 w-full">
              <h2 className="text-xs sm:text-sm font-semibold uppercase text-muted-foreground tracking-wider truncate flex-shrink">Sessions</h2>
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 sm:h-7 sm:px-2 text-[10px] sm:text-xs border-dashed border flex-shrink-0 whitespace-nowrap"
                  onClick={onNewSession}
                >
                  New Session
                </Button>
              </div>
            </div>
            <div className="space-y-1 w-full max-w-full overflow-hidden">
              {sessions.map(session => (
                <div key={session.id} className={cn("group flex items-center justify-between p-1.5 sm:p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent dark:hover:bg-muted/50 w-full max-w-full overflow-hidden", currentSessionId === session.id && "bg-accent dark:bg-muted/50 border-l-2 border-primary")}>
                  <button onClick={() => onSwitchSession(session.id)} className="flex-1 text-left text-[10px] sm:text-xs truncate pr-1 sm:pr-2 font-medium overflow-hidden">
                    {session.title}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDeleteSession(session.id)}>
                        <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-destructive" />
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
      <div className="p-2 sm:p-3 border-t flex-shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start text-xs sm:text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Settings
        </Button>
      </div>
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
}
