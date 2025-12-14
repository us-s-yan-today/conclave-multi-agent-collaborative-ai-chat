import type { Message, ToolCall } from './types';
import { AIProvider, ProviderConfig } from './providers/base-provider';
import { ProviderFactory } from './providers/provider-factory';

/**
 * ChatHandler - Handles all chat-related operations
 *
 * This class now supports multiple AI providers (OpenAI, Gemini, etc.)
 * using individual agent API configurations.
 */
export class ChatHandler {
  private provider: AIProvider;
  private model: string;
  private apiConfig: ProviderConfig;

  constructor(model: string, apiConfig: ProviderConfig) {
    this.model = model;
    this.apiConfig = apiConfig;
    this.provider = this.createProvider();
    console.log("Provider initialized for model:", model, "type:", apiConfig.type);
  }

  private createProvider(): AIProvider {
    return ProviderFactory.createProvider(this.apiConfig);
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
    return await this.provider.processMessage(
      message,
      conversationHistory,
      this.model,
      onChunk
    );
  }

  /**
   * Update the model and API configuration for this chat handler
   */
  updateModel(newModel: string, newApiConfig: ProviderConfig): void {
    this.model = newModel;
    this.apiConfig = newApiConfig;
    this.provider = this.createProvider();
  }
}