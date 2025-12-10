import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Agent } from '@/lib/agents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, CircleDashed, MessageSquareQuote, ListTodo, BrainCircuit, BarChart2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { chatService, ExtendedMessage, getUsageMetrics } from '@/lib/chat';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
interface RightPanelProps {
  agents: Agent[];
  messages: ExtendedMessage[];
}
const StatusIndicator = ({ status }: { status: Agent['status'] }) => {
  switch (status) {
    case 'Ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'Thinking': return <BrainCircuit className="w-4 h-4 text-yellow-500 animate-pulse" />;
    case 'Paused': return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
    case 'Has Feedback': return <MessageSquareQuote className="w-4 h-4 text-blue-500" />;
    default: return null;
  }
};
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
export function RightPanel({ agents, messages }: RightPanelProps) {
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  useEffect(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0 && !isSummarizing) {
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      if (lastMessage.content.trim() !== '') {
        setIsSummarizing(true);
        chatService.summarizeConversation(messages.slice(-5))
          .then(setSummary)
          .finally(() => setIsSummarizing(false));
      }
    }
  }, [messages, isSummarizing]);
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
  return (
    <aside className="hidden md:flex flex-col gap-6 h-full p-4 bg-muted/30">
      <Tabs defaultValue="status" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="status"><Bot className="w-4 h-4 mr-2" />Status</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="flex-1 flex flex-col gap-4 min-h-0 mt-4">
          <Card className="flex-shrink-0">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg">Live Status</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {agents.map((agent) => (
                  <li key={agent.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${agent.color}`} /><span className="font-medium">{agent.name}</span><Badge variant={agent.role === 'Primary' ? 'default' : 'secondary'}>{agent.role}</Badge></div>
                    <div className="flex items-center gap-2 text-muted-foreground"><span>{agent.status}</span><StatusIndicator status={agent.status} /></div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageSquareQuote className="w-5 h-5" />Context</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 min-h-0 text-sm">
              <div className="flex-1 flex flex-col min-h-0"><h3 className="font-semibold mb-2">Live Summary</h3><ScrollArea className="flex-1 bg-muted/50 rounded-md p-3 text-muted-foreground">{isSummarizing && !summary ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-3/4" /></div> : <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{summary || 'Auto-summary will appear here.'}</motion.p>}</ScrollArea></div>
              <Separator />
              <div className="flex-1 flex flex-col min-h-0"><h3 className="font-semibold mb-2 flex items-center gap-2"><ListTodo className="w-4 h-4" />Action Items</h3>{actionItems.length > 0 ? <ScrollArea className="flex-1 bg-muted/50 rounded-md p-3 space-y-2">{actionItems.map((item, index) => (<div key={index} className="flex items-center gap-2"><span>{item}</span></div>))}</ScrollArea> : <div className="text-muted-foreground text-center py-4 bg-muted/50 rounded-md">No action items.</div>}</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="flex-1 flex flex-col gap-4 min-h-0 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Agent Participation</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={analytics.agentUsageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>{analytics.agentUsageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie>
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
        </TabsContent>
      </Tabs>
    </aside>
  );
}