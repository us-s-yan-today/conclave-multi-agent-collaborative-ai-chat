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
      "flex items-center gap-3 p-2 rounded-lg transition-all duration-200 hover:bg-accent w-full max-w-full overflow-hidden",
      agent.role === 'Primary' && 'bg-accent'
    )}>
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", agent.color)}>
        <IconComponent className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <p className="text-sm font-semibold truncate flex-1 min-w-0">{agent.name}</p>
          <StatusIndicator status={agent.status} hasValidConfig={hasValidConfig} />
        </div>
        <Badge variant={agent.role === 'Primary' ? 'default' : 'secondary'} className="h-5 text-xs">
          {agent.role === 'Primary' && <Star className="w-3 h-3 mr-1" />}
          {agent.role}
        </Badge>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 focus:ring-2 focus:ring-ring">
            <MoreVertical className="w-4 h-4" />
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