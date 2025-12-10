import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Agent } from '@/lib/agents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, CircleDashed, MessageSquareQuote, ListTodo, BrainCircuit } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { chatService } from '@/lib/chat';
import type { ExtendedMessage } from '@/lib/chat';
interface RightPanelProps {
  agents: Agent[];
  messages: ExtendedMessage[];
}
const StatusIndicator = ({ status }: { status: Agent['status'] }) => {
  switch (status) {
    case 'Ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'Thinking':
      return <BrainCircuit className="w-4 h-4 text-yellow-500 animate-pulse" />;
    case 'Paused':
      return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
    case 'Has Feedback':
      return <MessageSquareQuote className="w-4 h-4 text-blue-500" />;
    default:
      return null;
  }
};
export function RightPanel({ agents, messages }: RightPanelProps) {
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  useEffect(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0 && !isSummarizing) {
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      // Trigger summary if the last message is from an assistant and is not empty
      if (lastMessage.content.trim() !== '') {
        setIsSummarizing(true);
        chatService.summarizeConversation(messages.slice(-5))
          .then(setSummary)
          .finally(() => setIsSummarizing(false));
      }
    }
  }, [messages, isSummarizing]);
  const actionItems = useMemo(() => {
    return summary
      .split('\n')
      .filter(line => line.toLowerCase().startsWith('action:'))
      .map(line => line.substring(7).trim());
  }, [summary]);
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
              {isSummarizing && !summary ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  {summary || 'Auto-summary will appear here as the conversation progresses.'}
                </motion.p>
              )}
            </ScrollArea>
          </div>
          <Separator />
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Action Items
            </h3>
            {actionItems.length > 0 ? (
              <ScrollArea className="flex-1 bg-muted/50 rounded-md p-3 space-y-2">
                {actionItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span>{item}</span>
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="text-muted-foreground text-center py-4 bg-muted/50 rounded-md">
                No action items identified yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}