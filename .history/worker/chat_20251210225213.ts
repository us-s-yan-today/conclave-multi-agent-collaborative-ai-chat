
import type { Message, ToolCall } from './types';
import type { Env } from './core-utils';
import { getToolDefinitions, executeTool } from './tools';
import { ChatCompletionMessageFunctionToolCall } from 'openai/resources/index.mjs';
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

  private async handleStreamResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    message: string,
    conversationHistory: Message[],
    onChunk: (chunk: string) => void
  ) {
    let fullContent = '';
    const accumulatedToolCalls: ChatCompletionMessageFunctionToolCall[] = [];
    
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
        
        // Accumulate tool calls from streaming chunks
        if (delta?.tool_calls) {
          for (let i = 0; i < delta.tool_calls.length; i++) {
            const deltaToolCall = delta.tool_calls[i];
            if (!accumulatedToolCalls[i]) {
              accumulatedToolCalls[i] = {
                id: deltaToolCall.id || `tool_${Date.now()}_${i}`,
                type: 'function',
                function: {
                  name: deltaToolCall.function?.name || '',
                  arguments: deltaToolCall.function?.arguments || ''
                }
              };
            } else {
              // Append to existing tool call
              if (deltaToolCall.function?.name && !accumulatedToolCalls[i].function.name) {
                accumulatedToolCalls[i].function.name = deltaToolCall.function.name;
              }
              if (deltaToolCall.function?.arguments) {
                accumulatedToolCalls[i].function.arguments += deltaToolCall.function.arguments;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      throw new Error('Stream processing failed');
    }
    
    if (accumulatedToolCalls.length > 0) {
      const executedTools = await this.executeToolCalls(accumulatedToolCalls);
      const finalResponse = await this.generateToolResponse(message, conversationHistory, accumulatedToolCalls, executedTools);
      return { content: finalResponse, toolCalls: executedTools };
    }
    
    return { content: fullContent };
  }

  private async handleNonStreamResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    message: string,
    conversationHistory: Message[]
  ) {
    const responseMessage = completion.choices[0]?.message;
    
    if (!responseMessage) {
      return { content: 'I apologize, but I encountered an issue processing your request.' };
    }

    if (!responseMessage.tool_calls) {
      return { 
        content: responseMessage.content || 'I apologize, but I encountered an issue.' 
      };
    }

    const toolCalls = await this.executeToolCalls(responseMessage.tool_calls as ChatCompletionMessageFunctionToolCall[]);
    const finalResponse = await this.generateToolResponse(
      message, 
      conversationHistory, 
      responseMessage.tool_calls, 
      toolCalls
    );

    return { content: finalResponse, toolCalls };
  }

  /**
   * Execute all tool calls from OpenAI response
   */
  private async executeToolCalls(openAiToolCalls: ChatCompletionMessageFunctionToolCall[]): Promise<ToolCall[]> {
    return Promise.all(
      openAiToolCalls.map(async (tc) => {
        try {
          const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          const result = await executeTool(tc.function.name, args);
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: args,
            result
          };
        } catch (error) {
          console.error(`Tool execution failed for ${tc.function.name}:`, error);
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: {},
            result: { error: `Failed to execute ${tc.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}` }
          };
        }
      })
    );
  }

  /**
   * Generate final response after tool execution
   */
  private async generateToolResponse(
    userMessage: string, 
    history: Message[], 
    openAiToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[], 
    toolResults: ToolCall[]
  ): Promise<string> {
    const followUpCompletion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant. Respond naturally to the tool results.' },
        ...history.slice(-3).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
        { 
          role: 'assistant', 
          content: null,
          tool_calls: openAiToolCalls
        },
        ...toolResults.map((result, index) => ({
          role: 'tool' as const,
          content: JSON.stringify(result.result),
          tool_call_id: openAiToolCalls[index]?.id || result.id
        }))
      ],
      max_tokens: 16000
    });

    return followUpCompletion.choices[0]?.message?.content || 'Tool results processed successfully.';
  }

  /**
   * Build conversation messages for OpenAI API
   */
  private buildConversationMessages(userMessage: string, history: Message[]) {
    return [
      { 
        role: 'system' as const, 
        content: 'You are a helpful AI assistant that helps users build and deploy web applications. You provide clear, concise guidance on development, deployment, and troubleshooting. Keep responses practical and actionable.' 
      },
      ...history.slice(-5).map(m => ({ 
        role: m.role, 
        content: m.content 
      })),
      { role: 'user' as const, content: userMessage }
    ];
  }

  /**
   * Update the model for this chat handler
   */
  updateModel(newModel: string): void {
    this.model = newModel;
    this.provider = this.createProvider(newModel);
  }
}