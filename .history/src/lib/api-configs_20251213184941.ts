import { produce } from 'immer';

export interface ApiConfig {
  id: string;
  name: string; // User-friendly name like "OpenAI GPT-4", "Google Gemini Pro"
  type: 'openai' | 'gemini' | 'anthropic';
  baseURL: string;
  apiKey: string;
  endpoint?: string;
  isValidated: boolean;
  lastValidated?: number;
  models: string[]; // Available models for this API config
}

const STORAGE_KEY = 'conclave:api-configs';

export const getApiConfig = (id: string): ApiConfig | undefined => {
  const configs = getApiConfigs();
  return configs.find(config => config.id === id);
};

export const getApiConfigs = (): ApiConfig[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // If no configs exist, create and return empty array - default will be created when needed
    return [];
  } catch (error) {
    console.error('Failed to load API configs from localStorage:', error);
    return [];
  }
};

// Initialize API configs - no default configs created
export const initializeApiConfigs = (): void => {
  // Just ensure localStorage is initialized, but don't create any default configs
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize empty array
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  } catch (error) {
    console.error('Failed to initialize API configs:', error);
  }
};

export const saveApiConfigs = (configs: ApiConfig[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Failed to save API configs to localStorage:', error);
  }
};

export const createApiConfig = (config: Omit<ApiConfig, 'id'> | ApiConfig): ApiConfig => {
  // If config already has an id, use it (for default config), otherwise generate one
  const newConfig: ApiConfig = 'id' in config ? config as ApiConfig : {
    ...config,
    id: crypto.randomUUID(),
  };
  const configs = getApiConfigs();
  saveApiConfigs([...configs, newConfig]);
  return newConfig;
};

export const updateApiConfig = (updatedConfig: ApiConfig): void => {
  const configs = getApiConfigs();
  const index = configs.findIndex((c) => c.id === updatedConfig.id);
  if (index !== -1) {
    const newConfigs = produce(configs, draft => {
      draft[index] = updatedConfig;
    });
    saveApiConfigs(newConfigs);
  }
};

export const deleteApiConfig = (configId: string): void => {
  const configs = getApiConfigs();
  saveApiConfigs(configs.filter((c) => c.id !== configId));
};

export const getVerifiedApiConfigs = (): ApiConfig[] => {
  return getApiConfigs().filter(config => config.isValidated);
};

export const getApiConfigById = (id: string): ApiConfig | null => {
  const configs = getApiConfigs();
  return configs.find(config => config.id === id) || null;
};

interface ValidationResult {
  success: boolean;
  models: string[];
}

// Validate API key by making a test call
export const validateApiConfig = async (config: ApiConfig): Promise<ValidationResult> => {
  if (!config.apiKey?.trim() || !config.baseURL?.trim()) {
    return { success: false, models: [] };
  }

  try {
    if (config.type === 'gemini') {
      // Test Google AI Studio API
      const response = await fetch(`${config.baseURL}/v1/models?key=${config.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        // Parse available models from response
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name?.replace('models/', '') || m.name) || [];
        return { success: true, models };
      }
      return { success: false, models: [] };
    }
    
    if (config.type === 'openai') {
      // Test OpenAI API
      const response = await fetch(`${config.baseURL}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: any) => m.id) || [];
        return { success: true, models };
      }
      return { success: false, models: [] };
    }

    if (config.type === 'anthropic') {
      // Test Anthropic API with a minimal request
      const response = await fetch(`${config.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      });
      // For Anthropic, we assume standard models if API key is valid
      const success = response.status !== 401 && response.status !== 403;
      const models = success ? [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ] : [];
      return { success, models };
    }
    
    return { success: false, models: [] };
  } catch (error) {
    console.error('API validation failed:', error);
    return { success: false, models: [] };
  }
};

// Mark API config as validated and update available models
export const markApiConfigValidated = async (config: ApiConfig): Promise<ApiConfig> => {
  const validation = await validateApiConfig(config);
  return {
    ...config,
    isValidated: validation.success,
    lastValidated: validation.success ? Date.now() : undefined,
    models: validation.models || []
  };
};

export const getDefaultApiConfig = (type: 'openai' | 'gemini' | 'anthropic'): Omit<ApiConfig, 'id'> => {
  const defaults = {
    openai: {
      name: 'OpenAI',
      type: 'openai' as const,
      baseURL: 'https://api.openai.com',
      endpoint: '/v1/chat/completions',
      apiKey: '',
      isValidated: false,
      models: []
    },
    gemini: {
      name: 'Google Gemini',
      type: 'gemini' as const,
      baseURL: 'https://generativelanguage.googleapis.com',
      endpoint: '/v1/models/{model}:generateContent',
      apiKey: '',
      isValidated: false,
      models: []
    },
    anthropic: {
      name: 'Anthropic Claude',
      type: 'anthropic' as const,
      baseURL: 'https://api.anthropic.com',
      endpoint: '/v1/messages',
      apiKey: '',
      isValidated: false,
      models: []
    }
  };

  return defaults[type];
};