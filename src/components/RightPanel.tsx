import { Agent } from '@/lib/agents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, CircleDashed, MessageSquareQuote, ListTodo, BrainCircuit } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
interface RightPanelProps {
  agents: Agent[];
}
const StatusIndicator = ({ status }: { status: Agent['status'] }) => {
  switch (status) {
    case 'Ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'Thinking':
      return <BrainCircuit className="w-4 h-4 text-yellow-500 animate-pulse" />;
    case 'Paused':
      return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
    default:
      return null;
  }
};
export function RightPanel({ agents }: RightPanelProps) {
  return (
    <aside className="hidden md:flex flex-col gap-6 h-full">
      <Card className="flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5" />
            Live Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {agents.map((agent) => (
              <li key={agent.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${agent.color}`} />
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant={agent.role === 'Primary' ? 'default' : 'secondary'}>
                    {agent.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{agent.status}</span>
                  <StatusIndicator status={agent.status} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquareQuote className="w-5 h-5" />
            Context
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 min-h-0 text-sm">
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold mb-2">Live Summary</h3>
            <ScrollArea className="flex-1 bg-muted/50 rounded-md p-3 text-muted-foreground">
              <p>Auto-summary will appear here as the conversation progresses.</p>
            </ScrollArea>
          </div>
          <Separator />
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Action Items
            </h3>
            <div className="text-muted-foreground text-center py-4 bg-muted/50 rounded-md">
              No action items identified yet.
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}