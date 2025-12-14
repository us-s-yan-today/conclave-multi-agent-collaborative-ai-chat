import OpenAI from 'openai';
import { AIProvider, ProviderConfig } from './base-provider';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    
    console.log('=== OpenAI Provider Initialization ===');
    console.log('BaseURL:', config.baseURL);
    console.log('API Key configured:', config.apiKey ? 'YES' : 'NO');
    console.log('=====================================');
    
    // Detect API type based on baseURL
    const isOfficialOpenAI = config.baseURL.includes('api.openai.com');
    const isAzure = config.baseURL.includes('azure.com') || config.baseURL.includes('openai.azure.com');
    const isGrok = config.baseURL.includes('api.x.ai') || config.baseURL.includes('xai-api');
    const isGroq = config.baseURL.includes('api.groq.com');
    const isDeepSeek = config.baseURL.includes('api.deepseek.com');
    const isOllama = config.baseURL.includes('localhost') || config.baseURL.includes('127.0.0.1') || config.baseURL.includes('ollama');
    
    // Build headers based on API type
    const headers: Record<string, string> = {
      // Use browser's native User-Agent instead of OpenAI SDK's to avoid Cloudflare blocks
      'User-Agent': navigator.userAgent
    };
    
    if (isAzure) {
      // Azure OpenAI uses api-key header
      headers['api-key'] = config.apiKey;
      console.log('Detected Azure OpenAI - using api-key header');
    } else if (isGrok) {
      // xAI Grok uses standard Bearer token (OpenAI-compatible)
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      console.log('Detected xAI Grok API - using Authorization Bearer header');
    } else if (isGroq) {
      // Groq uses standard Bearer token (OpenAI-compatible)
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      console.log('Detected Groq API - using Authorization Bearer header');
    } else if (isDeepSeek) {
      // DeepSeek uses standard Bearer token (OpenAI-compatible)
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      console.log('Detected DeepSeek API - using Authorization Bearer header');
    } else if (isOllama) {
      // Ollama typically doesn't need authentication
      console.log('Detected Ollama (local) - no authentication needed');
    } else if (!isOfficialOpenAI) {
      // For other non-official APIs (proxies, custom gateways, etc.), try multiple auth methods
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['X-API-Key'] = config.apiKey;
      headers['api-key'] = config.apiKey;
      console.log('Detected generic OpenAI-compatible API - using multiple auth headers');
    } else {
      // Official OpenAI
      console.log('Detected official OpenAI API - using standard auth');
    }
    
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      maxRetries: 0,
      dangerouslyAllowBrowser: true, // Allow running in browser
      ...(Object.keys(headers).length > 0 && { defaultHeaders: headers }),
    });
  }

  async processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    systemPrompt?: string,
    personality?: string
  ): Promise<{ content: string; toolCalls?: any[] }> {
    // Build system message from systemPrompt and personality
    let systemMessage = '';
    if (systemPrompt) {
      systemMessage = systemPrompt;
    }
    if (personality && !systemPrompt?.includes(personality)) {
      systemMessage = systemMessage
        ? `${systemMessage}\n\nYour personality: ${personality}`
        : `Your personality: ${personality}`;
    }
    
    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage
      });
    }
    
    messages.push(
      ...history.slice(-5).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    );
    
    messages.push({
      role: 'user',
      content: message
    });

    console.log('=== OpenAI API Request ===');
    console.log('Model:', model);
    console.log('Messages count:', messages.length);
    console.log('BaseURL:', this.config.baseURL);
    console.log('=========================');

    if (onChunk) {
      const stream = await this.client.chat.completions.create({
        model: model,
        messages,
        max_completion_tokens: 16000,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
      }
      return { content: fullContent };
    }

    const completion = await this.client.chat.completions.create({
      model: model,
      messages,
      max_tokens: 16000,
      stream: false
    });

    const responseMessage = completion.choices[0]?.message;
    return { 
      content: responseMessage?.content || 'I apologize, but I encountered an issue.' 
    };
  }
}
