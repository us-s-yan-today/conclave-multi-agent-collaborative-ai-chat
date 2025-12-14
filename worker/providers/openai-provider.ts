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
    
    // Build messages array - system message first (if present), then recent history, then current message
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    // Add system message if present
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage
      });
    }
    
    // Add recent conversation history (last 5 messages)
    messages.push(
      ...history.slice(-5).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    );
    
    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

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