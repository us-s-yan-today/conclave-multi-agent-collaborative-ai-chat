import { AIProvider, ProviderConfig } from './base-provider';

export class GeminiProvider implements AIProvider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    systemPrompt?: string,
    personality?: string
  ): Promise<{ content: string; toolCalls?: any[] }> {
    const apiKey = this.config.apiKey;
    
    // 构建对话历史，在开头添加系统提示
    const contents = [];
    
    // 如果有 systemPrompt，作为系统消息添加
    if (systemPrompt || personality) {
      let systemMessage = '';
      if (systemPrompt) {
        systemMessage = systemPrompt;
      }
      if (personality && !systemPrompt?.includes(personality)) {
        // 如果 personality 不在 systemPrompt 中，则作为用户消息添加
        systemMessage = systemMessage ? `${systemMessage}\n\nYour personality: ${personality}` : `Your personality: ${personality}`;
      }
      
      if (systemMessage) {
        contents.push({
          role: 'System',
          parts: [{ text: systemMessage }]
        });
        contents.push({
          role: 'Assistant',
          parts: [{ text: 'Understood. I will follow these guidelines.' }]
        });
      }
    }
    
    // 添加对话历史
    contents.push(
      ...history.slice(-5).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    );
    
    // 构建 Gemini API 请求，支持自定义端点
    const endpoint = this.config.endpoint || `/v1/models/${model}:generateContent`;
    const url = `${this.config.baseURL}${endpoint.replace('{model}', model)}`;
    
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0.7
        }
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout, no retries
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Don't retry - throw error immediately
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (onChunk) {
      // 对于流式响应，我们可以将完整内容分块发送
      for (const char of content) {
        onChunk(char);
      }
    }

    return { content };
  }
}