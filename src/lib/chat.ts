import type { Message, ChatState, ToolCall, WeatherResult, MCPResult, ErrorResult, SessionInfo } from '../../worker/types';
import type { Agent } from './agents';
export interface ChatResponse {
  success: boolean;
  data?: ChatState;
  error?: string;
}
export type ExtendedMessage = Message & { agentId?: string; agentName?: string; agentColor?: string; };
export const MODELS = [
  { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google-ai-studio/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google-ai-studio/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];
class ChatService {
  private sessionId: string;
  private baseUrl: string;
  constructor() {
    this.sessionId = crypto.randomUUID();
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  async sendMessage(
    message: string,
    model?: string,
    onChunk?: (chunk: string) => void,
    history?: Message[]
  ): Promise<ChatResponse> {
    try {
      let conversationHistory = history || [];
      if (conversationHistory.length > 20) {
        console.log('Pruning conversation history to last 10 messages.');
        conversationHistory = conversationHistory.slice(-10);
      }
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model, stream: !!onChunk, history: conversationHistory }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) onChunk(chunk);
          }
        } finally {
          reader.releaseLock();
        }
        return { success: true };
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to send message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }
  async getMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get messages:', error);
      return { success: false, error: 'Failed to load messages' };
    }
  }
  async clearMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/clear`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to clear messages:', error);
      return { success: false, error: 'Failed to clear messages' };
    }
  }
  getSessionId(): string {
    return this.sessionId;
  }
  newSession(): void {
    this.sessionId = crypto.randomUUID();
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.baseUrl = `/api/chat/${sessionId}`;
  }
  async createSession(title?: string, sessionId?: string, firstMessage?: string, agentSnapshot?: Agent[]): Promise<{ success: boolean; data?: { sessionId: string; title: string }; error?: string }> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sessionId, firstMessage, agentSnapshot: agentSnapshot ? JSON.stringify(agentSnapshot) : undefined })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to create session' };
    }
  }
  async listSessions(): Promise<{ success: boolean; data?: SessionInfo[]; error?: string }> {
    try {
      const response = await fetch('/api/sessions');
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to list sessions' };
    }
  }
  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to delete session' };
    }
  }
  async updateSessionTitle(sessionId: string, title: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to update session title' };
    }
  }
  async clearAllSessions(): Promise<{ success: boolean; data?: { deletedCount: number }; error?: string }> {
    try {
      const response = await fetch('/api/sessions', { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to clear all sessions' };
    }
  }
  async updateModel(model: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to update model:', error);
      return { success: false, error: 'Failed to update model' };
    }
  }
  async exportConversation(messages: ExtendedMessage[], format: 'json' | 'text' | 'markdown'): Promise<string> {
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
  async summarizeConversation(messages: ExtendedMessage[]): Promise<string> {
    const conversationText = messages.map(m => `${m.agentName || m.role}: ${m.content}`).join('\n');
    const prompt = `Summarize the following conversation concisely. Extract key points and any action items (prefix action items with "ACTION:").\n\nConversation:\n${conversationText}`;
    try {
      const response = await this.sendMessage(prompt, 'google-ai-studio/gemini-2.5-flash');
      if (response.success && response.data?.messages) {
        return response.data.messages[response.data.messages.length - 1].content;
      }
      return "Could not generate summary.";
    } catch (error) {
      console.error("Summarization failed:", error);
      return "Summarization failed.";
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