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
    
    // 构建 Gemini API 请求
    const response = await fetch(`${this.config.baseURL}/v1/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: message }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { content };
  }
}