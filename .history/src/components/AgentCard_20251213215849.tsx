import { Agent, getAgentIcon, isAgentConfigValid } from '@/lib/agents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Star, ArrowUpCircle, CheckCircle, BrainCircuit, CircleDashed, AlertTriangle, FileText, MessageSquareQuote, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  onPromote: (agentId: string, role: 'Primary' | 'Summarizer') => void;
}
const StatusIndicator = ({ hasValidConfig }: { hasValidConfig: boolean }) => {
  if (hasValidConfig) {
    return <CheckCircle className="w-3 h-3 text-green-500" />;
  }
  return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
};
export function AgentCard({ agent, onEdit, onDelete, onPromote }: AgentCardProps) {
  const IconComponent = getAgentIcon(agent.icon);
  const hasValidConfig = isAgentConfigValid(agent);
  
  return (
    <div className={cn(
      "flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-lg transition-all duration-200 hover:bg-accent w-full max-w-full overflow-hidden",
      (agent.role === 'Primary' || agent.role === 'Summarizer') && 'bg-accent'
    )}>
      <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0", agent.color)}>
        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
          <p className="text-xs sm:text-sm font-semibold truncate flex-1 min-w-0">{agent.name}</p>
          <StatusIndicator hasValidConfig={hasValidConfig} />
        </div>
        <Badge 
          variant={agent.role === 'Primary' ? 'default' : agent.role === 'Summarizer' ? 'secondary' : 'outline'} 
          className="h-4 text-[9px] sm:text-[10px] px-1 sm:px-1.5"
        >
          {agent.role === 'Primary' && <Star className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5" />}
          {agent.role === 'Summarizer' && <FileText className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5" />}
          {agent.role}
        </Badge>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 focus:ring-1 focus:ring-ring">
            <MoreVertical className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {agent.role !== 'Primary' && (
            <DropdownMenuItem onClick={() => onPromote(agent.id, 'Primary')}>
              <Star className="w-4 h-4 mr-2" />
              Set as Primary
            </DropdownMenuItem>
          )}
          {agent.role !== 'Summarizer' && (
            <DropdownMenuItem onClick={() => onPromote(agent.id, 'Summarizer')}>
              <FileText className="w-4 h-4 mr-2" />
              Set as Summarizer
            </DropdownMenuItem>
          )}
          {(agent.role === 'Primary' || agent.role === 'Summarizer') && agent.role !== 'Observer' && (
            <DropdownMenuItem onClick={() => onPromote(agent.id, 'Observer')}>
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Set as Observer
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(agent)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(agent.id)} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}