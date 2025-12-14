// 抽象 AI 提供商接口
export interface AIProvider {
  processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    systemPrompt?: string,
    personality?: string
  ): Promise<{ content: string; toolCalls?: any[] }>;
}

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  type: 'openai' | 'gemini' | 'anthropic';
  endpoint?: string; // 可选的自定义端点路径
  systemPrompt?: string; // Agent's system prompt
  personality?: string; // Agent's personality description
}