import type { Message, ChatState, ToolCall, WeatherResult, MCPResult, ErrorResult, SessionInfo } from '../../worker/types';
import type { Agent } from './agents';
import { toast } from 'sonner';
import { getAgents, isAgentConfigValid, getAgentApiConfig } from './agents';
import { ChatHandler } from './chat-handler';
import { ProviderConfig } from './providers/base-provider';
import {
  clearAllSessions as clearAllLocalSessions,
  createSessionMeta,
  deleteSession as deleteLocalSession,
  getSessionState,
  listSessions as listLocalSessions,
  saveSessionMeta,
  saveSessionState,
  touchSession,
  updateSessionTitle as updateLocalSessionTitle
} from './local-store';

export interface ChatResponse {
  success: boolean;
  data?: ChatState;
  error?: string;
}

export type ExtendedMessage = Message & {
  id: string;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  isError?: boolean;
};

export const MODELS = [
  { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google-ai-studio/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google-ai-studio/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

const CURRENT_SESSION_KEY = 'conclave:current-session';
const DEFAULT_MODEL = MODELS[0].id;

const normalizeModel = (model: string) => model.replace('google-ai-studio/', '');

class ChatService {
  private sessionId: string;

  constructor() {
    this.sessionId = localStorage.getItem(CURRENT_SESSION_KEY) || crypto.randomUUID();
    localStorage.setItem(CURRENT_SESSION_KEY, this.sessionId);
  }

  private persistSessionId() {
    localStorage.setItem(CURRENT_SESSION_KEY, this.sessionId);
  }

  private resolveAgent(agentOrModel?: Agent | string): Agent | null {
    if (agentOrModel && typeof agentOrModel !== 'string') {
      if (!isAgentConfigValid(agentOrModel)) {
        toast.error('Agent API配置无效，请先在设置里验证 API Key。');
        return null;
      }
      return agentOrModel;
    }

    const agents = getAgents();
    const primary = agents.find(a => a.role === 'Primary' && isAgentConfigValid(a));
    const fallback = agents.find(a => isAgentConfigValid(a));
    const chosen = primary || fallback;
    if (!chosen) {
      toast.error('未找到已验证的 Agent，请先配置并验证 API Key。');
      return null;
    }
    if (typeof agentOrModel === 'string') {
      return { ...chosen, model: agentOrModel };
    }
    return chosen;
  }

  private async callModel(message: string, agent: Agent, history: Message[], onChunk?: (chunk: string) => void): Promise<string> {
    const config = getAgentApiConfig(agent);
    if (!config || !config.isValidated) {
      throw new Error('Invalid or unvalidated API configuration');
    }

    // Create provider config
    const providerConfig: ProviderConfig = {
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      type: config.type,
      endpoint: config.endpoint,
      systemPrompt: agent.systemPrompt,
      personality: agent.personality
    };

    // Create chat handler and process message
    const chatHandler = new ChatHandler(
      agent.model,
      providerConfig,
      agent.systemPrompt,
      agent.personality
    );

    const response = await chatHandler.processMessage(message, history, onChunk);
    return response.content;
  }

  async sendMessage(
    message: string,
    agentOrModel?: Agent | string,
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    const agent = this.resolveAgent(agentOrModel);
    if (!agent) {
      return { success: false, error: 'Missing valid agent configuration' };
    }

    const currentState = await getSessionState(this.sessionId, agent.model || DEFAULT_MODEL);
    const userMessage: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    
    const workingState = await saveSessionState(this.sessionId, {
      ...currentState,
      model: agent.model,
      messages: [...currentState.messages, userMessage],
      isProcessing: true
    });
    
    await touchSession(this.sessionId);

    try {
      const content = await this.callModel(message, agent, workingState.messages, onChunk);
      const assistantMessage: ExtendedMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color,
      };
      
      const finalState = await saveSessionState(this.sessionId, {
        ...workingState,
        messages: [...workingState.messages, assistantMessage],
        isProcessing: false
      });
      return { success: true, data: finalState };
    } catch (error) {
      console.error('Failed to call model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      const errorMsg: ExtendedMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
        isError: true,
      };
      
      const finalState = await saveSessionState(this.sessionId, {
        ...workingState,
        messages: [...workingState.messages, errorMsg],
        isProcessing: false
      });
      toast.error('发送失败，请检查 API Key 或网络连接。');
      return { success: false, error: errorMessage, data: finalState };
    }
  }

  // New method for Observer agents - doesn't persist to session
  async sendObserverMessage(
    message: string,
    agent: Agent,
    onChunk?: (chunk: string) => void
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.resolveAgent(agent)) {
      return { success: false, error: 'Invalid agent configuration' };
    }

    try {
      // Get current session messages for context, but don't modify them
      const currentState = await getSessionState(this.sessionId, agent.model || DEFAULT_MODEL);
      const content = await this.callModel(message, agent, currentState.messages, onChunk);
      return { success: true, content };
    } catch (error) {
      console.error('Failed to call observer model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send observer message';
      return { success: false, error: errorMessage };
    }
  }

  async getMessages(): Promise<ChatResponse> {
    const state = await getSessionState(this.sessionId, DEFAULT_MODEL);
    return { success: true, data: state };
  }

  async clearMessages(): Promise<ChatResponse> {
    const nextState = await saveSessionState(this.sessionId, {
      messages: [],
      sessionId: this.sessionId,
      isProcessing: false,
      model: DEFAULT_MODEL,
      streamingMessage: ''
    });
    return { success: true, data: nextState };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  newSession(): void {
    this.sessionId = crypto.randomUUID();
    this.persistSessionId();
  }

  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.persistSessionId();
  }

  async createSession(title?: string, sessionId?: string, firstMessage?: string, agentSnapshot?: Agent[]): Promise<{ success: boolean; data?: { sessionId: string; title: string }; error?: string }> {
    const meta = createSessionMeta(title, sessionId, firstMessage);
    await saveSessionMeta(meta);
    if (agentSnapshot) {
      try {
        localStorage.setItem(`conclave:session:${meta.id}:agents`, JSON.stringify(agentSnapshot));
      } catch (error) {
        console.warn('Failed to persist agent snapshot:', error);
      }
    }
    return { success: true, data: { sessionId: meta.id, title: meta.title } };
  }

  async createSessionWithData(title: string, messages: ExtendedMessage[], model: string): Promise<{ success: boolean; data?: { sessionId: string }; error?: string }> {
    try {
      const sessionId = crypto.randomUUID();
      const meta = createSessionMeta(title, sessionId);
      
      // Save session metadata
      await saveSessionMeta(meta);
      
      // Save messages to the new session
      const state: ChatState = {
        sessionId,
        messages,
        model,
        isProcessing: false,
      };
      await saveSessionState(sessionId, state);
      
      return { success: true, data: { sessionId } };
    } catch (error) {
      console.error('Failed to create session with data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async listSessions(): Promise<{ success: boolean; data?: SessionInfo[]; error?: string }> {
    return { success: true, data: await listLocalSessions() };
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const deleted = await deleteLocalSession(sessionId);
    if (deleted && this.sessionId === sessionId) {
      this.newSession();
    }
    return { success: true };
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<{ success: boolean; error?: string }> {
    const updated = await updateLocalSessionTitle(sessionId, title);
    return updated ? { success: true } : { success: false, error: 'Session not found' };
  }

  async clearAllSessions(): Promise<{ success: boolean; data?: { deletedCount: number }; error?: string }> {
    const deletedCount = await clearAllLocalSessions();
    this.newSession();
    return { success: true, data: { deletedCount } };
  }

  async updateModel(model: string): Promise<ChatResponse> {
    const state = await getSessionState(this.sessionId, model);
    const nextState = await saveSessionState(this.sessionId, {
      ...state,
      model
    });
    return { success: true, data: nextState };
  }

  async exportConversation(messages: ExtendedMessage[], format: 'json' | 'text' | 'markdown'): Promise<string> {
    if (!messages || messages.length === 0) {
      return 'No messages to export.';
    }
    if (messages.length > 100) {
      toast.warning('Long conversation exported - consider archiving older sessions.');
    }
    return new Promise((resolve) => {
      switch (format) {
        case 'json':
          resolve(JSON.stringify(messages, null, 2));
          break;
        case 'text':
          resolve(messages.map(m => `${m.agentName || m.role.toUpperCase()}: ${m.content}`).join('\n\n'));
          break;
        case 'markdown':
          resolve(messages.map(m => {
            const author = m.role === 'user' ? '**You**' : `**${m.agentName || 'Assistant'}**`;
            const time = `*${new Date(m.timestamp).toLocaleTimeString()}*`;
            return `${author} (${time}):\n\n${m.content}\n\n---\n`;
          }).join(''));
          break;
      }
    });
  }

  async summarizeConversation(messages: ExtendedMessage[], updateAgentStatus?: (agentId: string, status: 'Thinking' | 'Ready') => void): Promise<string> {
    // Use all messages from the messages array (which is already the single source of truth)
    // Find the Summarizer agent first
    const agents = getAgents();
    const summarizerAgent = agents.find(a => a.role === 'Summarizer' && isAgentConfigValid(a));
    
    // Fall back to first available validated agent if no Summarizer
    const agentToUse = summarizerAgent || agents.find(a => isAgentConfigValid(a));
    
    if (!agentToUse) {
      return 'No valid agent available for summarization. Please configure and validate an agent.';
    }
    
    // Update agent status to Thinking (only if it's a designated Summarizer)
    if (summarizerAgent && updateAgentStatus) {
      updateAgentStatus(summarizerAgent.id, 'Thinking');
    }
    
    const conversationText = messages.slice(-15).map(m => `${m.agentName || m.role}: ${m.content}`).join('\n');
    
    // Build the summarization request message
    const summaryRequest = `Please summarize the following conversation:\n\n${conversationText}`;
    
    try {
      let content: string;
      
      if (summarizerAgent) {
        // Use Summarizer agent with its configured system prompt
        // The agent's systemPrompt already contains instructions for how to summarize
        content = await this.callModel(summaryRequest, summarizerAgent, messages.slice(-10));
      } else {
        // Use fallback agent with default summarization behavior
        const fallbackAgent = { ...agentToUse };
        const config = getAgentApiConfig(fallbackAgent);
        if (!config || !config.isValidated) {
          throw new Error('Invalid or unvalidated API configuration');
        }
        
        const providerConfig: ProviderConfig = {
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          type: config.type,
          endpoint: config.endpoint,
          systemPrompt: 'You are a helpful assistant that summarizes conversations concisely. Extract key points and any action items (prefix action items with "ACTION:").',
          personality: ''
        };
        
        const chatHandler = new ChatHandler(
          fallbackAgent.model,
          providerConfig,
          'You are a helpful assistant that summarizes conversations concisely. Extract key points and any action items (prefix action items with "ACTION:").',
          ''
        );
        
        const response = await chatHandler.processMessage(summaryRequest, messages.slice(-10));
        content = response.content;
      }
      
      // Update agent status back to Ready (only if it's a designated Summarizer)
      if (summarizerAgent && updateAgentStatus) {
        updateAgentStatus(summarizerAgent.id, 'Ready');
      }
      return content || 'Auto-summary unavailable.';
    } catch (error) {
      console.error("Summarization failed:", error);
      // Update agent status back to Ready on error (only if it's a designated Summarizer)
      if (summarizerAgent && updateAgentStatus) {
        updateAgentStatus(summarizerAgent.id, 'Ready');
      }
      const fallback = messages.slice(-3).map(m => m.content).join(' ').substring(0, 200);
      return `Summary generation failed. Recent topics include: ${fallback}...`;
    }
  }

  async persistSession(sessionId: string, messages: ExtendedMessage[], model = DEFAULT_MODEL): Promise<void> {
    if (!sessionId) return;
    await saveSessionState(sessionId, {
      messages,
      sessionId,
      isProcessing: false,
      model,
      streamingMessage: ''
    });
    await touchSession(sessionId);
  }

  async getSessionState(sessionId: string): Promise<ChatState | null> {
    try {
      const state = await getSessionState(sessionId, DEFAULT_MODEL);
      return state;
    } catch (error) {
      console.error('Failed to get session state:', error);
      return null;
    }
  }
}

export const chatService = new ChatService();

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const renderToolCall = (toolCall: ToolCall): string => {
  const result = toolCall.result as WeatherResult | MCPResult | ErrorResult | undefined;
  if (!result) return `⚠️ ${toolCall.name}: No result`;
  if ('error' in result) return `❌ ${toolCall.name}: ${result.error}`;
  if ('content' in result) return `🔧 ${toolCall.name}: Executed`;
  if (toolCall.name === 'get_weather') {
    const weather = result as WeatherResult;
    return `🌤️ Weather in ${weather.location}: ${weather.temperature}°C, ${weather.condition}`;
  }
  return `🔧 ${toolCall.name}: Done`;
};

export const getUsageMetrics = (messages: ExtendedMessage[]) => {
  const agentMessages = messages.filter(m => m.role === 'assistant' && m.agentId);
  const agentUsage = agentMessages.reduce((acc, m) => {
    const id = m.agentId!;
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalResponseLength = agentMessages.reduce((sum, m) => sum + m.content.length, 0);
  const avgResponseLength = agentMessages.length > 0 ? totalResponseLength / agentMessages.length : 0;
  return {
    agentUsage,
    totalMessages: messages.length,
    avgResponseLength,
  };
};

export const generateSessionTitle = (firstMessage?: string): string => {
  if (!firstMessage || !firstMessage.trim()) {
    return `Chat ${new Date().toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  }
  const cleanMessage = firstMessage.trim().replace(/\s+/g, ' ');
  const truncated = cleanMessage.length > 40 ? cleanMessage.slice(0, 37) + '...' : cleanMessage;
  return `${truncated} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

