// AI Provider Interface
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
  endpoint?: string;
  systemPrompt?: string;
  personality?: string;
}
