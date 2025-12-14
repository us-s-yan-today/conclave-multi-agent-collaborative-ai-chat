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
    
    // If no custom system message, use default
    if (!systemMessage) {
      systemMessage = 'You are a helpful AI assistant that helps users build and deploy web applications. You provide clear, concise guidance on development, deployment, and troubleshooting. Keep responses practical and actionable.';
    }
    
    // OpenAI uses native 'system' role
    const messages = [
      {
        role: 'system' as const,
        content: systemMessage
      },
      ...history.slice(-5).map(m => ({
        role: m.role,  // 'assistant' role works directly with OpenAI
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