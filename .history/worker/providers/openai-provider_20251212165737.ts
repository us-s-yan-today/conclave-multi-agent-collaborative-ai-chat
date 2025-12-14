import OpenAI from 'openai';
import { AIProvider, ProviderConfig } from './base-provider';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      maxRetries: 0, // Disable automatic retries to prevent wild retry behavior
    });
  }

  async processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void
  ): Promise<{ content: string; toolCalls?: any[] }> {
    const messages = [
      { 
        role: 'system' as const, 
        content: 'You are a helpful AI assistant that helps users build and deploy web applications. You provide clear, concise guidance on development, deployment, and troubleshooting. Keep responses practical and actionable.' 
      },
      ...history.slice(-5).map(m => ({ 
        role: m.role, 
        content: m.content 
      })),
      { role: 'user' as const, content: message }
    ];

    if (onChunk) {
      // 流式响应
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

    // 非流式响应
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