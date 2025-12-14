import OpenAI from 'openai';
import { AIProvider, ProviderConfig } from './base-provider';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    
    console.log('=== OpenAI Provider Initialization ===');
    console.log('BaseURL:', config.baseURL);
    console.log('API Key present:', config.apiKey ? 'YES' : 'NO');
    console.log('API Key length:', config.apiKey?.length);
    console.log('API Key (first 10 chars):', config.apiKey?.substring(0, 10));
    console.log('=====================================');
    
    // Detect if this is official OpenAI or a compatible API
    const isOfficialOpenAI = config.baseURL.includes('api.openai.com');
    const isAzure = config.baseURL.includes('azure.com') || config.baseURL.includes('openai.azure.com');
    
    // Build headers based on API type
    const headers: Record<string, string> = {};
    
    if (isAzure) {
      // Azure OpenAI uses api-key header
      headers['api-key'] = config.apiKey;
      console.log('Detected Azure OpenAI - using api-key header');
    } else if (!isOfficialOpenAI) {
      // For non-official APIs (proxies, local, etc.), try multiple auth methods
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['X-API-Key'] = config.apiKey;
      headers['api-key'] = config.apiKey;
      console.log('Detected OpenAI-compatible API - using multiple auth headers');
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
    console.log('API Key being used:', this.config.apiKey ? 'YES' : 'NO');
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
