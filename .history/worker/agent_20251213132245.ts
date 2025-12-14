import { Agent } from 'agents';
import type { Env } from './core-utils';
import type { ChatState, Message } from './types';
import { ChatHandler } from './chat';
import { API_RESPONSES } from './config';
import { createMessage, createStreamResponse, createEncoder } from './utils';
import { getAgents, getAgentApiConfig } from '../src/lib/agents';
const MAX_MESSAGES = 200; // Keep more history before pruning
/**
 * ChatAgent - Main agent class using Cloudflare Agents SDK
 *
 * This class extends the Agents SDK Agent class and handles all chat operations.
 */
export class ChatAgent extends Agent<Env, ChatState> {
  private chatHandler?: ChatHandler;
  // Initial state for new chat sessions
  initialState: ChatState = {
    messages: [],
    sessionId: crypto.randomUUID(),
    isProcessing: false,
    model: 'google-ai-studio/gemini-2.5-flash'
  };
  /**
   * Custom setState wrapper to prune message history and prevent storage errors.
   */
  private setPrunedState(newState: ChatState): void {
    const originalCount = newState.messages.length;
    if (originalCount > MAX_MESSAGES) {
      const prunedMessages = newState.messages.slice(-MAX_MESSAGES);
      const prunedCount = originalCount - prunedMessages.length;
      console.warn(`[ChatAgent] Pruned ${prunedCount} old messages from session ${this.name} to fit storage limits.`);
      this.setState({ ...newState, messages: prunedMessages });
    } else {
      this.setState(newState);
    }
  }
  /**
   * Initialize chat handler when agent starts
   */
  async onStart(): Promise<void> {
    // Get agent configuration from storage based on the session
    const agents = getAgents();
    // Normalize model string for comparison (remove provider prefix if present)
    const normalizeModel = (model: string) => model.replace(/^[^/]+\//, '');
    const normalizedStateModel = normalizeModel(this.state.model);
    const agent = agents.find(a => normalizeModel(a.model) === normalizedStateModel) || agents[0];
    const apiConfig = agent ? getAgentApiConfig(agent) : null;
    
    if (!apiConfig) {
      console.error(`No API configuration found for agent with model ${this.state.model}`);
      throw new Error('No valid API configuration found');
    }
    
    console.log(`[ChatAgent.onStart] Found agent: ${agent?.name}, systemPrompt: ${agent?.systemPrompt ? 'YES' : 'NO'}, personality: ${agent?.personality ? 'YES' : 'NO'}`);
    
    this.chatHandler = new ChatHandler(
      this.state.model,
      apiConfig,
      agent?.systemPrompt,
      agent?.personality
    );
    console.log(`ChatAgent ${this.name} initialized with session ${this.state.sessionId}`);
  }
  /**
   * Handle incoming requests - clean routing with error handling
   */
  async onRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method;
      // Route to appropriate handler
      if (method === 'GET' && url.pathname === '/messages') {
        return this.handleGetMessages();
      }
      if (method === 'POST' && url.pathname === '/chat') {
        return this.handleChatMessage(await request.json());
      }
      if (method === 'DELETE' && url.pathname === '/clear') {
        return this.handleClearMessages();
      }
      if (method === 'POST' && url.pathname === '/model') {
        return this.handleModelUpdate(await request.json());
      }
      return Response.json({
        success: false,
        error: API_RESPONSES.NOT_FOUND
      }, { status: 404 });
    } catch (error) {
      console.error('Request handling error:', error);
      return Response.json({
        success: false,
        error: API_RESPONSES.INTERNAL_ERROR
      }, { status: 500 });
    }
  }
  /**
   * Get current conversation messages
   */
  private handleGetMessages(): Response {
    return Response.json({
      success: true,
      data: this.state
    });
  }
  /**
   * Process new chat message
   */
  private async handleChatMessage(body: { message: string; model?: string; stream?: boolean }): Promise<Response> {
    const { message, model, stream } = body;
    // Validate input
    if (!message?.trim()) {
      return Response.json({
        success: false,
        error: API_RESPONSES.MISSING_MESSAGE
      }, { status: 400 });
    }
    // Update model if provided
    if (model && model !== this.state.model) {
      this.setPrunedState({ ...this.state, model });
      
      // Get updated agent configuration for the new model
      const agents = getAgents();
      const normalizeModel = (model: string) => model.replace(/^[^/]+\//, '');
      const normalizedModel = normalizeModel(model);
      const agent = agents.find(a => normalizeModel(a.model) === normalizedModel) || agents[0];
      const apiConfig = agent ? getAgentApiConfig(agent) : null;
      
      if (apiConfig) {
        console.log(`[ChatAgent.handleChatMessage] Updating model to ${model}, agent: ${agent?.name}, systemPrompt: ${agent?.systemPrompt ? 'YES' : 'NO'}`);
        this.chatHandler?.updateModel(model, apiConfig, agent?.systemPrompt, agent?.personality);
      }
    }
    const userMessage = createMessage('user', message.trim());
    this.setPrunedState({
      ...this.state,
      messages: [...this.state.messages, userMessage],
      isProcessing: true
    });
    try {
      // Process message through chat handler
      if (!this.chatHandler) {
        throw new Error('Chat handler not initialized');
      }
      if (stream) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = createEncoder();
        // Start processing in background
        (async () => {
          try {
            this.setPrunedState({ ...this.state, streamingMessage: '' });
            const response = await this.chatHandler!.processMessage(
              message,
              this.state.messages,
              (chunk: string) => {
                try {
                  this.setPrunedState({
                    ...this.state,
                    streamingMessage: (this.state.streamingMessage || '') + chunk
                  });
                  writer.write(encoder.encode(chunk));
                } catch (writeError) {
                  console.error('Write error:', writeError);
                }
              }
            );
            const assistantMessage = createMessage('assistant', response.content, response.toolCalls);
            // Update state with final response
            this.setPrunedState({
              ...this.state,
              messages: [...this.state.messages, assistantMessage],
              isProcessing: false,
              streamingMessage: ''
            });
          } catch (error) {
            console.error('Streaming error:', error);
            // Write error to stream
            try {
              const errorMessage = 'Sorry, I encountered an error processing your request.';
              writer.write(encoder.encode(errorMessage));
              const errorMsg = createMessage('assistant', errorMessage);
              this.setPrunedState({
                ...this.state,
                messages: [...this.state.messages, errorMsg],
                isProcessing: false,
                streamingMessage: ''
              });
            } catch (writeError) {
              console.error('Error writing error message:', writeError);
            }
          } finally {
            try {
              writer.close();
            } catch (closeError) {
              console.error('Error closing writer:', closeError);
            }
          }
        })();
        return createStreamResponse(readable);
      }
      // Non-streaming response
      const response = await this.chatHandler.processMessage(
        message,
        this.state.messages
      );
      const assistantMessage = createMessage('assistant', response.content, response.toolCalls);
      // Update state with response
      this.setPrunedState({
        ...this.state,
        messages: [...this.state.messages, assistantMessage],
        isProcessing: false
      });
      return Response.json({
        success: true,
        data: this.state
      });
    } catch (error) {
      console.error('Chat processing error:', error);
      this.setPrunedState({ ...this.state, isProcessing: false });
      return Response.json({
        success: false,
        error: API_RESPONSES.PROCESSING_ERROR
      }, { status: 500 });
    }
  }
  /**
   * Clear conversation history
   */
  private handleClearMessages(): Response {
    this.setPrunedState({
      ...this.state,
      messages: []
    });
    return Response.json({
      success: true,
      data: this.state
    });
  }
  /**
   * Update selected AI model
   */
  private handleModelUpdate(body: { model: string }): Response {
    const { model } = body;
    this.setPrunedState({ ...this.state, model });
    
    // Get updated agent configuration for the new model
    const agents = getAgents();
    const normalizeModel = (model: string) => model.replace(/^[^/]+\//, '');
    const normalizedModel = normalizeModel(model);
    const agent = agents.find(a => normalizeModel(a.model) === normalizedModel) || agents[0];
    const apiConfig = agent ? getAgentApiConfig(agent) : null;
    
    if (apiConfig) {
      console.log(`[ChatAgent.handleModelUpdate] Updating model to ${model}, agent: ${agent?.name}, systemPrompt: ${agent?.systemPrompt ? 'YES' : 'NO'}`);
      this.chatHandler?.updateModel(model, apiConfig, agent?.systemPrompt, agent?.personality);
    }
    
    return Response.json({
      success: true,
      data: this.state
    });
  }
}
