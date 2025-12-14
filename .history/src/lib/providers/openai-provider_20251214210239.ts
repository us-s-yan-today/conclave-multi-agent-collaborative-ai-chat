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
    console.log('=====================================');
    
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      maxRetries: 0,
      dangerouslyAllowBrowser: true, // Allow running in browser
      defaultHeaders: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
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
