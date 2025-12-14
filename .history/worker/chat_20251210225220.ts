import type { Message, ToolCall } from './types';
import type { Env } from './core-utils';
import { AIProvider } from './providers/base-provider';
import { ProviderFactory } from './providers/provider-factory';

/**
 * ChatHandler - Handles all chat-related operations
 *
 * This class now supports multiple AI providers (OpenAI, Gemini, etc.)
 * and automatically routes requests to the appropriate provider based on the model.
 */
export class ChatHandler {
  private provider: AIProvider;
  private model: string;
  private env: Env;

  constructor(env: Env, model: string) {
    this.env = env;
    this.model = model;
    this.provider = this.createProvider(model);
    console.log("Provider initialized for model:", model);
  }

  private createProvider(model: string): AIProvider {
    const providerType = ProviderFactory.getProviderType(model);
    
    if (providerType === 'gemini') {
      return ProviderFactory.createProvider({
        baseURL: this.env.GEMINI_BASE_URL,
        apiKey: this.env.GEMINI_API_KEY,
        type: 'gemini'
      });
    } else {
      return ProviderFactory.createProvider({
        baseURL: this.env.CF_AI_BASE_URL,
        apiKey: this.env.CF_AI_API_KEY,
        type: 'openai'
      });
    }
  }

  /**
   * Process a user message and generate AI response
   */
  async processMessage(
    message: string,
    conversationHistory: Message[],
    onChunk?: (chunk: string) => void
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
  }> {
    const actualModel = ProviderFactory.getModelName(this.model);
    return await this.provider.processMessage(
      message,
      conversationHistory,
      actualModel,
      onChunk
    );
  }

  /**
   * Update the model for this chat handler
   */
  updateModel(newModel: string): void {
    this.model = newModel;
    this.provider = this.createProvider(newModel);
  }
}