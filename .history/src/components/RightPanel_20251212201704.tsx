import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Agent } from '@/lib/agents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, CircleDashed, MessageSquareQuote, ListTodo, BrainCircuit, BarChart2, AlertTriangle, Hand } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip as RechartsTooltip } from 'recharts';
import { chatService, ExtendedMessage, getUsageMetrics } from '@/lib/chat';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ObserverMessagesDrawer } from './ObserverMessagesDrawer';
interface RightPanelProps {
  agents: Agent[];
  messages: ExtendedMessage[];
  isProcessing: boolean;
  onRetrySummary: () => void;
  onAddObserverMessage: (agentId: string, messageId: string) => void;
  onDismissObserverMessage: (agentId: string, messageId: string) => void;
  observerShortcuts?: Map<string, number>; // agentId -> shortcut number (1-9)
}
const StatusIndicator = ({ status }: { status: Agent['status'] }) => {
  switch (status) {
    case 'Ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'Thinking': return <BrainCircuit className="w-4 h-4 text-yellow-500 animate-pulse" />;
    case 'Paused': return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'Has Feedback': return <MessageSquareQuote className="w-4 h-4 text-blue-500" />;
    case 'Hand Raised': return <Hand className="w-4 h-4 text-amber-500" />;
    default: return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
  }
};
export function RightPanel({ agents, messages, isProcessing, onRetrySummary, onAddObserverMessage, onDismissObserverMessage, observerShortcuts }: RightPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleAgentClick = (agent: Agent) => {
    if (agent.role === 'Observer' && agent.status === 'Hand Raised' && agent.pendingMessages && agent.pendingMessages.length > 0) {
      setSelectedAgent(agent);
      setIsDrawerOpen(true);
    }
  };

  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [lastSummaryFingerprint, setLastSummaryFingerprint] = useState<string | null>(null);
  useEffect(() => {
    if (isProcessing || isSummarizing) return;

    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return;

    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    if (!lastAssistant.content.trim()) return;

    const fingerprint = messages.map(m => m.id).join('|');
    if (fingerprint === lastSummaryFingerprint) return;

    setIsSummarizing(true);
    setLastSummaryFingerprint(fingerprint);
    chatService.summarizeConversation(messages.slice(-5))
      .then(setSummary)
      .catch(err => setSummary(`Error generating summary: ${err.message.slice(0, 50)}`))
      .finally(() => setIsSummarizing(false));
  }, [messages, isProcessing, isSummarizing, lastSummaryFingerprint]);

  const handleRetry = () => {
    setLastSummaryFingerprint(null);
    setSummary('');
    onRetrySummary();
  };
  const actionItems = useMemo(() => {
    return summary.split('\n').filter(line => line.toLowerCase().startsWith('action:')).map(line => line.substring(7).trim());
  }, [summary]);
  const analytics = useMemo(() => {
    const metrics = getUsageMetrics(messages);
    const agentUsageData = Object.entries(metrics.agentUsage).map(([agentId, count]) => ({
      name: agents.find(a => a.id === agentId)?.name || 'Unknown',
      value: count,
    }));
    return { ...metrics, agentUsageData };
  }, [messages, agents]);
  const hasSummaryError = summary.toLowerCase().startsWith('error');
  return (
    <aside className="hidden md:flex flex-col gap-6 h-full min-h-0 p-4 bg-muted/30 rounded-lg overflow-hidden">
      <Tabs defaultValue="status" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="status" role="tab"><Bot className="w-4 h-4 mr-2" />Status</TabsTrigger>
          <TabsTrigger value="analytics" role="tab"><BarChart2 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 flex-1 min-h-0 mt-4 overflow-y-auto">
            <Card className="flex-shrink-0">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg">Live Status</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {agents.map((agent) => {
                    const hasRaisedHand = agent.status === 'Hand Raised';
                    const isClickable = agent.role === 'Observer' && hasRaisedHand && agent.pendingMessages && agent.pendingMessages.length > 0;
                    const shortcutNumber = observerShortcuts?.get(agent.id);
                    
                    return (
                      <li
                        key={agent.id}
                        className={`flex items-center justify-between text-sm ${isClickable ? 'cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors' : ''}`}
                        onClick={() => isClickable && handleAgentClick(agent)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${agent.color}`} />
                          <span className="font-medium">{agent.name}</span>
                          <Badge variant={agent.role === 'Primary' ? 'default' : 'secondary'}>{agent.role}</Badge>
                          {shortcutNumber && (
                            <Badge variant="outline" className="bg-primary/10 text-primary text-xs px-1.5 py-0">
                              ⌘{shortcutNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{agent.status}</span>
                          {hasRaisedHand && agent.handRaiseCount && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                              {agent.handRaiseCount}
                            </Badge>
                          )}
                          <StatusIndicator status={agent.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareQuote className="w-5 h-5" />
                  Context
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-hidden px-6 py-4">
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-6 pr-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="font-semibold text-base">Live Summary</h3>
                      <div className="bg-muted/50 rounded-md p-4 min-h-[180px]">
                        {isSummarizing && !summary ? (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        ) : (
                          <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm"
                          >
                            {summary || 'Auto-summary will appear here.'}
                          </motion.p>
                        )}
                      </div>
                      {hasSummaryError && (
                        <Button variant="outline" size="sm" onClick={handleRetry} className="w-full">
                          Retry Summary
                        </Button>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="flex flex-col gap-3">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <ListTodo className="w-4 h-4" />
                        Action Items
                      </h3>
                      {actionItems.length > 0 ? (
                        <div className="bg-muted/50 rounded-md p-4 space-y-3">
                          {actionItems.map((item, index) => (
                            <div key={index} className="flex items-start gap-3 text-sm">
                              <span className="text-muted-foreground mt-1">•</span>
                              <span className="flex-1 leading-relaxed">{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-center py-8 bg-muted/50 rounded-md text-sm">
                          No action items.
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 flex-1 min-h-0 mt-4 overflow-y-auto">
            {analytics.agentUsageData.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <BarChart2 className="w-12 h-12 mx-auto mb-4" />
                <p className="font-semibold">No data yet.</p>
                <p className="text-sm">Send some messages to see analytics.</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Agent Participation</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={analytics.agentUsageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{analytics.agentUsageData.map((entry, index) => <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />)}</Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Message Metrics</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div><p className="text-2xl font-bold">{analytics.totalMessages}</p><p className="text-sm text-muted-foreground">Total Messages</p></div>
                      <div><p className="text-2xl font-bold">{analytics.avgResponseLength.toFixed(0)}</p><p className="text-sm text-muted-foreground">Avg. Response Chars</p></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Observer Messages Drawer */}
      <ObserverMessagesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agent={selectedAgent}
        onAddToChat={onAddObserverMessage}
        onDismiss={onDismissObserverMessage}
      />
    </aside>
  );
}
