import { AIProvider, ProviderConfig } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { GeminiProvider } from './gemini-provider';

export class ProviderFactory {
  static createProvider(config: ProviderConfig): AIProvider {
    switch (config.type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'gemini':
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
