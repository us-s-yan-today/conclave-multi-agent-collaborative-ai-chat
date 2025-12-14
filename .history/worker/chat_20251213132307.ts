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
  private systemPrompt?: string;
  private personality?: string;

  constructor(model: string, apiConfig: ProviderConfig, systemPrompt?: string, personality?: string) {
    this.model = model;
    this.apiConfig = apiConfig;
    this.systemPrompt = systemPrompt;
    this.personality = personality;
    this.provider = this.createProvider();
    console.log("[ChatHandler] Provider initialized for model:", model, "type:", apiConfig.type);
    console.log("[ChatHandler] systemPrompt:", systemPrompt ? 'YES' : 'NO', "personality:", personality ? 'YES' : 'NO');
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
    console.log("[ChatHandler.processMessage] Calling provider with systemPrompt:", this.systemPrompt ? 'YES' : 'NO', "personality:", this.personality ? 'YES' : 'NO');
    return await this.provider.processMessage(
      message,
      conversationHistory,
      this.model,
      onChunk,
      this.systemPrompt,
      this.personality
    );
  }

  /**
   * Update the model and API configuration for this chat handler
   */
  updateModel(newModel: string, newApiConfig: ProviderConfig, systemPrompt?: string, personality?: string): void {
    this.model = newModel;
    this.apiConfig = newApiConfig;
    this.systemPrompt = systemPrompt;
    this.personality = personality;
    this.provider = this.createProvider();
  }
}