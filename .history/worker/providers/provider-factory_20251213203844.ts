import { AIProvider, ProviderConfig } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { GeminiProvider } from './gemini-provider';

export class ProviderFactory {
  static createProvider(config: ProviderConfig): AIProvider {
    console.log('[ProviderFactory] Creating provider with type:', config.type);
    console.log('[ProviderFactory] Config:', { type: config.type, baseURL: config.baseURL, hasApiKey: !!config.apiKey });
    
    switch (config.type) {
      case 'openai':
        console.log('[ProviderFactory] Creating OpenAIProvider');
        return new OpenAIProvider(config);
      case 'gemini':
        console.log('[ProviderFactory] Creating GeminiProvider');
        return new GeminiProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }

  static getProviderType(model: string): 'openai' | 'gemini' {
    if (model.startsWith('google-ai-studio/') || model.startsWith('gemini')) {
      return 'gemini';
    }
    return 'openai';
  }

  static getModelName(model: string): string {
    if (model.startsWith('google-ai-studio/')) {
      return model.replace('google-ai-studio/', '');
    }
    return model;
  }
}