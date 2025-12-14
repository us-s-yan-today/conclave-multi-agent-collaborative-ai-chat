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
    
    // 构建对话历史
    const contents = [];
    
    // 构建系统消息（如果有）
    let systemMessage = '';
    if (systemPrompt) {
      systemMessage = systemPrompt;
    }
    if (personality && !systemPrompt?.includes(personality)) {
      systemMessage = systemMessage ? `${systemMessage}\n\nYour personality: ${personality}` : `Your personality: ${personality}`;
    }
    
    // 先添加系统提示（如果有）
    if (systemMessage) {
      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these guidelines.' }]
      });
    }
    
    // 然后添加最近的对话历史（最多5条）
    const recentHistory = history.slice(-5);
    contents.push(
      ...recentHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))
    );
    
    // 最后添加当前用户消息
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
    
    // 构建 Gemini API 请求，支持自定义端点
    const endpoint = this.config.endpoint || `/v1/models/${model}:generateContent`;
    const url = `${this.config.baseURL}${endpoint.replace('{model}', model)}`;
    
    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.7
      }
    };
    
    // Log the request for debugging
    console.log('=== Gemini API Request ===');
    console.log('SystemPrompt received:', systemPrompt ? 'YES' : 'NO');
    console.log('Personality received:', personality ? 'YES' : 'NO');
    console.log('System message built:', systemMessage ? 'YES' : 'NO');
    console.log('Contents array length:', contents.length);
    console.log('First 2 items in contents:', JSON.stringify(contents.slice(0, 2), null, 2));
    console.log('Full request body:', JSON.stringify(requestBody, null, 2));
    console.log('========================');
    
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
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