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
    onChunk?: (chunk: string) => void
  ): Promise<{ content: string; toolCalls?: any[] }> {
    const apiKey = this.config.apiKey;
    
    // 构建对话历史
    const contents = [
      ...history.slice(-5).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];
    
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
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
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