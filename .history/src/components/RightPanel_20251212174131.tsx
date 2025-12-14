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
import { chatService, ExtendedMessage, getUsageMetrics } from '@/lib/chat';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
interface RightPanelProps {
  agents: Agent[];
  messages: ExtendedMessage[];
  isProcessing: boolean;
  onRetrySummary: () => void;
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
export function RightPanel({ agents, messages, isProcessing, onRetrySummary }: RightPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleAgentClick = (agent: Agent) => {
    if (agent.role === 'Observer' && agent.status === 'Hand Raised' && agent.pendingMessages && agent.pendingMessages.length > 0) {
      setSelectedAgent(agent);
      setIsSheetOpen(true);
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
      <Tabs defaultValue="status" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="status" role="tab"><Bot className="w-4 h-4 mr-2" />Status</TabsTrigger>
          <TabsTrigger value="analytics" role="tab"><BarChart2 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="flex-1 min-h-0 mt-4 overflow-y-auto">
          <div className="flex flex-col gap-4 pb-4">
            <Card className="flex-shrink-0">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg">Live Status</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {agents.map((agent) => {
                    const hasRaisedHand = agent.status === 'Hand Raised';
                    const isClickable = agent.role === 'Observer' && hasRaisedHand && agent.pendingMessages && agent.pendingMessages.length > 0;
                    
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareQuote className="w-5 h-5" />
                  Context
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 text-sm px-6 py-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-base">Live Summary</h3>
                <div className="bg-muted/50 rounded-md p-4 min-h-[120px]">
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
                      className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
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
                      <div key={index} className="flex items-start gap-3">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span className="flex-1 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-8 bg-muted/50 rounded-md">
                    No action items.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="flex-1 flex flex-col gap-4 min-h-0 mt-4">
          {analytics.agentUsageData.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
              <BarChart2 className="w-12 h-12 mx-auto mb-4" />
              <p className="font-semibold">No data yet.</p>
              <p className="text-sm">Send some messages to see analytics.</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex-1 flex flex-col gap-4">
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
        </TabsContent>
      </Tabs>

      {/* Observer Messages Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Hand className="w-5 h-5 text-amber-500" />
              {selectedAgent?.name} - Raised Hand Messages
            </SheetTitle>
            <SheetDescription>
              This observer has messages that haven't been added to the chat yet.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-10rem)] mt-6">
            <div className="space-y-4 pr-4">
              {selectedAgent?.pendingMessages && selectedAgent.pendingMessages.length > 0 ? (
                selectedAgent.pendingMessages.map((msg, index) => (
                  <Card key={msg.id} className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Hand className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Message #{index + 1}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        Approve to Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pending messages
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </aside>
  );
}
