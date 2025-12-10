import type { Message, ChatState, ToolCall, WeatherResult, MCPResult, ErrorResult, SessionInfo } from '../../worker/types';
import type { Agent } from './agents';
export interface ChatResponse {
  success: boolean;
  data?: ChatState;
  error?: string;
}
export type ExtendedMessage = Message & { id: string; agentId?: string; agentName?: string; agentColor?: string; isError?: boolean; };
export const MODELS = [
  { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google-ai-studio/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google-ai-studio/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
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
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, model, stream: !!onChunk }), // REMOVED history from body
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown server error'}`);
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
        console.error(`Failed to send message (attempt ${attempt}/${MAX_RETRIES}):`, error);
        if (attempt === MAX_RETRIES) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
        }
        await delay(100 * attempt); // Exponential backoff
      }
    }
    return { success: false, error: 'Failed to send message after multiple retries.' };
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
    if (!messages || messages.length === 0) {
      return 'No messages to export.';
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
  async summarizeConversation(messages: ExtendedMessage[]): Promise<string> {
    const conversationText = messages.map(m => `${m.agentName || m.role}: ${m.content}`).join('\n');
    const prompt = `Summarize the following conversation concisely. Extract key points and any action items (prefix action items with "ACTION:").\n\nConversation:\n${conversationText}`;
    try {
      const response = await this.sendMessage(prompt, 'google-ai-studio/gemini-2.5-flash');
      if (response.success && response.data?.messages) {
        return response.data.messages[response.data.messages.length - 1].content;
      }
      throw new Error(response.error || "Could not generate summary.");
    } catch (error) {
      console.error("Summarization failed:", error);
      return "Summary unavailable - conversation in progress.";
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