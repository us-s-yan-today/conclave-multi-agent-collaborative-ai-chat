import { produce } from 'immer';
import type { Agent } from './agents';

export interface AgentConfiguration {
  id: string;
  name: string; // User-friendly name for this configuration set
  description?: string;
  createdAt: number;
  updatedAt: number;
  agents: Agent[];
}

const STORAGE_KEY = 'conclave:agent-configurations';
const ACTIVE_CONFIG_KEY = 'conclave:active-config-id';

/**
 * Get the initial empty configuration
 */
const getEmptyConfiguration = (): AgentConfiguration => {
  return {
    id: crypto.randomUUID(),
    name: 'Default Configuration',
    description: 'Your default agent configuration',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agents: []
  };
};

/**
 * Initialize agent configurations in localStorage if they don't exist
 */
export const initializeAgentConfigs = (): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Create empty initial configuration
      const emptyConfig = getEmptyConfiguration();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([emptyConfig]));
      // Set it as active
      localStorage.setItem(ACTIVE_CONFIG_KEY, emptyConfig.id);
    }
  } catch (error) {
    console.error('Failed to initialize agent configurations:', error);
  }
};

/**
 * Get all agent configurations
 */
export const getAgentConfigurations = (): AgentConfiguration[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // If no configs exist, initialize and return
    initializeAgentConfigs();
    const newStored = localStorage.getItem(STORAGE_KEY);
    return newStored ? JSON.parse(newStored) : [getEmptyConfiguration()];
  } catch (error) {
    console.error('Failed to load agent configurations:', error);
    return [getEmptyConfiguration()];
  }
};

/**
 * Save all agent configurations
 */
export const saveAgentConfigurations = (configs: AgentConfiguration[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Failed to save agent configurations:', error);
  }
};

/**
 * Get a specific configuration by ID
 */
export const getAgentConfiguration = (id: string): AgentConfiguration | undefined => {
  const configs = getAgentConfigurations();
  return configs.find(config => config.id === id);
};

/**
 * Get the active configuration ID
 */
export const getActiveConfigId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to get active config ID:', error);
    return null;
  }
};

/**
 * Set the active configuration ID
 */
export const setActiveConfigId = (id: string): void => {
  try {
    localStorage.setItem(ACTIVE_CONFIG_KEY, id);
  } catch (error) {
    console.error('Failed to set active config ID:', error);
  }
};

/**
 * Get the currently active configuration
 */
export const getActiveConfiguration = (): AgentConfiguration | undefined => {
  const activeId = getActiveConfigId();
  if (!activeId) {
    // No active config set, use the first one
    const configs = getAgentConfigurations();
    if (configs.length > 0) {
      setActiveConfigId(configs[0].id);
      return configs[0];
    }
    return undefined;
  }
  return getAgentConfiguration(activeId);
};

/**
 * Create a new agent configuration
 */
export const createAgentConfiguration = (config: Omit<AgentConfiguration, 'id' | 'createdAt' | 'updatedAt'>): AgentConfiguration => {
  const newConfig: AgentConfiguration = {
    ...config,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const configs = getAgentConfigurations();
  saveAgentConfigurations([...configs, newConfig]);
  return newConfig;
};

/**
 * Update an existing agent configuration
 */
export const updateAgentConfiguration = (updatedConfig: AgentConfiguration): void => {
  const configs = getAgentConfigurations();
  const index = configs.findIndex((c) => c.id === updatedConfig.id);
  if (index !== -1) {
    const newConfigs = produce(configs, draft => {
      draft[index] = {
        ...updatedConfig,
        updatedAt: Date.now()
      };
    });
    saveAgentConfigurations(newConfigs);
  }
};

/**
 * Delete an agent configuration
 */
export const deleteAgentConfiguration = (configId: string): void => {
  const configs = getAgentConfigurations();
  const filtered = configs.filter((c) => c.id !== configId);
  saveAgentConfigurations(filtered);
  
  // If we deleted the active config, set a new one
  if (getActiveConfigId() === configId && filtered.length > 0) {
    setActiveConfigId(filtered[0].id);
  }
};

/**
 * Import a configuration from JSON
 * Maps agents to existing API configs when possible to maintain referential integrity
 */
export const importAgentConfiguration = (configData: any, existingApiConfigs?: import('./api-configs').ApiConfig[]): AgentConfiguration => {
  // Create a mapping from old API config references to existing ones
  const apiConfigMap = new Map<string, string>();
  
  if (existingApiConfigs && Array.isArray(existingApiConfigs)) {
    // For each agent's apiConfigId, try to find a matching existing config
    if (Array.isArray(configData.agents)) {
      configData.agents.forEach((agent: any) => {
        const oldConfigId = agent.apiConfigId;
        if (oldConfigId && !apiConfigMap.has(oldConfigId)) {
          // Try to find existing config by matching characteristics
          // First try exact model match, then type match
          const matchingConfig = existingApiConfigs.find(existing => 
            existing.models.includes(agent.model) && existing.isValidated
          ) || existingApiConfigs.find(existing => 
            existing.type === (agent.apiConfig?.type || 'gemini') && existing.isValidated
          );
          
          if (matchingConfig) {
            apiConfigMap.set(oldConfigId, matchingConfig.id);
          }
        }
      });
    }
  }
  
  // Validate and sanitize the imported data
  const config: AgentConfiguration = {
    id: crypto.randomUUID(), // Always generate new ID on import
    name: configData.name || 'Imported Configuration',
    description: configData.description || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agents: Array.isArray(configData.agents) ? configData.agents.map((agent: any) => {
      // Map to existing API config if available, otherwise keep original
      const mappedApiConfigId = apiConfigMap.get(agent.apiConfigId) || agent.apiConfigId;
      
      return {
        ...agent,
        id: crypto.randomUUID(), // Regenerate agent IDs to avoid conflicts
        apiConfigId: mappedApiConfigId, // Use mapped config ID
        status: 'Ready', // Reset status
        isActive: agent.isActive !== false, // Default to active
        pendingMessages: [], // Clear pending messages
        handRaiseCount: 0 // Reset hand raise count
      };
    }) : []
  };
  
  const configs = getAgentConfigurations();
  saveAgentConfigurations([...configs, config]);
  return config;
};

/**
 * Export a configuration to JSON
 */
export const exportAgentConfiguration = (configId: string): string => {
  const config = getAgentConfiguration(configId);
  if (!config) {
    throw new Error('Configuration not found');
  }
  
  // Create a clean export without runtime state and legacy fields
  const exportData = {
    name: config.name,
    description: config.description,
    agents: config.agents.map(agent => {
      // Omit runtime state fields and legacy apiConfig object
      const { status, pendingMessages, handRaiseCount, apiConfig, ...cleanAgent } = agent;
      return cleanAgent; // Only keeps apiConfigId reference
    })
  };
  
  return JSON.stringify(exportData, null, 2);
};

/**
 * Duplicate an existing configuration
 */
export const duplicateAgentConfiguration = (configId: string): AgentConfiguration | undefined => {
  const config = getAgentConfiguration(configId);
  if (!config) {
    return undefined;
  }
  
  const duplicated: AgentConfiguration = {
    ...config,
    id: crypto.randomUUID(),
    name: `${config.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agents: config.agents.map(agent => ({
      ...agent,
      id: crypto.randomUUID() // Generate new IDs for duplicated agents
    }))
  };
  
  const configs = getAgentConfigurations();
  saveAgentConfigurations([...configs, duplicated]);
  return duplicated;
};
