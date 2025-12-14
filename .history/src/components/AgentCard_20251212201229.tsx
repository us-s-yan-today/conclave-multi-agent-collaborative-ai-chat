import { Agent, getAgentIcon, isAgentConfigValid } from '@/lib/agents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Star, ArrowUpCircle, CheckCircle, BrainCircuit, CircleDashed, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  onPromote: (agentId: string) => void;
}
const StatusIndicator = ({ status, hasValidConfig }: { status: Agent['status']; hasValidConfig: boolean }) => {
  // If config is invalid, always show warning regardless of status
  if (!hasValidConfig) {
    return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
  }
  
  switch (status) {
    case 'Ready':
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    case 'Thinking':
      return <BrainCircuit className="w-3 h-3 text-yellow-500 animate-pulse" />;
    case 'Paused':
      return <CircleDashed className="w-3 h-3 text-muted-foreground" />;
    default:
      return null;
  }
};
export function AgentCard({ agent, onEdit, onDelete, onPromote }: AgentCardProps) {
  const IconComponent = getAgentIcon(agent.icon);
  const hasValidConfig = isAgentConfigValid(agent);
  
  return (
    <div className={cn(
      "flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-lg transition-all duration-200 hover:bg-accent w-full max-w-full overflow-hidden",
      agent.role === 'Primary' && 'bg-accent'
    )}>
      <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 relative", agent.color)}>
        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        {shortcutNumber !== undefined && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold">
            {shortcutNumber}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
          <p className="text-xs sm:text-sm font-semibold truncate flex-1 min-w-0">{agent.name}</p>
          <StatusIndicator status={agent.status} hasValidConfig={hasValidConfig} />
        </div>
        <Badge variant={agent.role === 'Primary' ? 'default' : 'secondary'} className="h-4 text-[9px] sm:text-[10px] px-1 sm:px-1.5">
          {agent.role === 'Primary' && <Star className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5" />}
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
            <DropdownMenuItem onClick={() => onPromote(agent.id)}>
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Promote to Primary
            </DropdownMenuItem>
          )}
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