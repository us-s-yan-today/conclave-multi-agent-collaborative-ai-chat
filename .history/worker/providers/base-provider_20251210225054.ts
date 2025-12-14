// 抽象 AI 提供商接口
export interface AIProvider {
  processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void
  ): Promise<{ content: string; toolCalls?: any[] }>;
}

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  type: 'openai' | 'gemini' | 'anthropic';
}