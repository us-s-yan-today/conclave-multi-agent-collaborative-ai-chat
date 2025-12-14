import { produce } from 'immer';
import { LucideIcon, Bot, Beaker, Brush, Scale, Lightbulb, ThumbsDown, Smile, Hammer } from 'lucide-react';
export type AgentRole = 'Primary' | 'Observer';
export type AgentStatus = 'Ready' | 'Thinking' | 'Paused' | 'Has Feedback';
export type AgentParticipation = 'Always' | 'Relevant' | 'OnDemand';
export interface Agent {
  id: string;
  name: string;
  icon: string; // LucideIcon name as string for serialization
  color: string; // Tailwind bg color class
  personality: string;
  systemPrompt?: string;
  status: AgentStatus;
  isActive: boolean;
  role: AgentRole;
  model: string;
  apiConfig: {
    type: 'openai' | 'gemini' | 'anthropic';
    baseURL: string;
    apiKey: string;
    endpoint?: string; // 可选的自定义端点路径
    isValidated?: boolean; // Whether the API key has been validated
    lastValidated?: number; // Timestamp of last successful validation
  };
  config: {
    formality: number;
    detail: number;
    approach: number;
    creativity: number;
    participation: AgentParticipation;
  };
}
export type AgentTemplate = Omit<Agent, 'id' | 'status' | 'isActive' | 'role'> & { templateId: string };
const STORAGE_KEY = 'conclave:agents';

// Migrate old agent data to include apiConfig
const migrateAgent = (agent: any): Agent => {
  if (!agent.apiConfig) {
    // Add default empty API config for existing agents
    agent.apiConfig = {
      type: 'gemini' as const,
      baseURL: '',
      apiKey: '',
      endpoint: ''
    };
  }
  return agent as Agent;
};

export const getAgents = (): Agent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedAgents = JSON.parse(stored);
      // Migrate old agents that might not have apiConfig
      const migratedAgents = parsedAgents.map(migrateAgent);
      // Save migrated data back to storage
      saveAgents(migratedAgents);
      return migratedAgents;
    }
    const defaults = defaultAgents();
    saveAgents(defaults);
    return defaults;
  } catch (error) {
    console.error('Failed to load agents from localStorage:', error);
    return defaultAgents();
  }
};
export const saveAgents = (agents: Agent[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error('Failed to save agents to localStorage:', error);
  }
};
export const createAgent = (newAgent: Omit<Agent, 'id'>): Agent => {
  const agent: Agent = {
    ...newAgent,
    id: crypto.randomUUID(),
  };
  const agents = getAgents();
  saveAgents([...agents, agent]);
  return agent;
};
export const updateAgent = (updatedAgent: Agent): void => {
  const agents = getAgents();
  const index = agents.findIndex((a) => a.id === updatedAgent.id);
  if (index !== -1) {
    const newAgents = produce(agents, draft => {
      draft[index] = updatedAgent;
    });
    saveAgents(newAgents);
  }
};
export const deleteAgent = (agentId: string): void => {
  const agents = getAgents();
  saveAgents(agents.filter((a) => a.id !== agentId));
};
export const defaultAgents = (): Agent[] => [
  {
    id: 'agent-primary-facilitator',
    name: 'Facilitator',
    icon: 'Bot',
    color: 'bg-indigo-500',
    personality: 'A helpful and neutral facilitator that guides the conversation, asks clarifying questions, and summarizes key points. Aims to ensure a productive discussion.',
    systemPrompt: 'You are a helpful AI assistant. Your primary role is to facilitate the conversation between the user and other AI agents. Keep the discussion on track, summarize key points, and ask clarifying questions when needed.',
    status: 'Ready',
    isActive: true,
    role: 'Primary',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: {
      formality: 50,
      detail: 50,
      approach: 50,
      creativity: 30,
      participation: 'Always',
    },
  },
  {
    id: 'agent-observer-researcher',
    name: 'Researcher',
    icon: 'Beaker',
    color: 'bg-green-500',
    personality: 'A fact-focused researcher that provides data, evidence, and sources to support claims. Prioritizes accuracy and objectivity.',
    systemPrompt: 'You are an AI assistant specializing in research. When you contribute, provide factual, data-driven information. If possible, cite sources. Your goal is to ensure the conversation is well-informed.',
    status: 'Ready',
    isActive: true,
    role: 'Observer',
    model: 'gemini-2.5-pro',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: {
      formality: 70,
      detail: 80,
      approach: 30,
      creativity: 10,
      participation: 'Relevant',
    },
  },
  {
    id: 'agent-observer-creative',
    name: 'Creative',
    icon: 'Brush',
    color: 'bg-amber-500',
    personality: 'An imaginative and out-of-the-box thinker that suggests innovative ideas, alternative perspectives, and creative solutions.',
    systemPrompt: 'You are a creative AI assistant. Your role is to brainstorm, offer novel perspectives, and challenge conventional thinking. Don\'t be afraid to suggest unconventional ideas.',
    status: 'Ready',
    isActive: true,
    role: 'Observer',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: {
      formality: 20,
      detail: 60,
      approach: 80,
      creativity: 90,
      participation: 'Relevant',
    },
  },
];
export const TEMPLATE_PRESETS: AgentTemplate[] = [
  {
    templateId: 'researcher',
    name: 'Researcher',
    icon: 'Beaker',
    color: 'bg-green-500',
    personality: 'Fact-focused, provides data and evidence.',
    model: 'gemini-2.5-pro',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 70, detail: 80, approach: 30, creativity: 10, participation: 'Relevant' }
  },
  {
    templateId: 'analyst',
    name: 'Analyst',
    icon: 'Scale',
    color: 'bg-sky-500',
    personality: 'Data-driven and strategic, identifies trends.',
    model: 'gemini-2.5-pro',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 80, detail: 70, approach: 20, creativity: 20, participation: 'Relevant' }
  },
  {
    templateId: 'creative',
    name: 'Creative',
    icon: 'Lightbulb',
    color: 'bg-amber-500',
    personality: 'Generates out-of-the-box ideas.',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 20, detail: 60, approach: 80, creativity: 90, participation: 'Relevant' }
  },
  {
    templateId: 'critic',
    name: 'Critic',
    icon: 'ThumbsDown',
    color: 'bg-rose-500',
    personality: 'Plays devil\'s advocate, assesses risks.',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 60, detail: 50, approach: 90, creativity: 30, participation: 'Relevant' }
  },
  {
    templateId: 'optimist',
    name: 'Optimist',
    icon: 'Smile',
    color: 'bg-yellow-400',
    personality: 'Provides positive perspectives and encouragement.',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 30, detail: 40, approach: 70, creativity: 60, participation: 'Relevant' }
  },
  {
    templateId: 'pragmatist',
    name: 'Pragmatist',
    icon: 'Hammer',
    color: 'bg-gray-500',
    personality: 'Focuses on practical solutions and implementation.',
    model: 'gemini-2.5-flash',
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 50, detail: 70, approach: 40, creativity: 20, participation: 'Relevant' }
  },
];
export const getAgentTemplates = (): AgentTemplate[] => TEMPLATE_PRESETS;
export const loadAgentTemplate = (templateId: string): Agent | null => {
  const template = TEMPLATE_PRESETS.find(p => p.templateId === templateId);
  if (!template) return null;
  const { templateId: _, ...rest } = template;
  return {
    ...rest,
    id: crypto.randomUUID(),
    status: 'Ready',
    isActive: true,
    role: 'Observer',
  };
};
export const agentIcons: { [key: string]: LucideIcon } = {
  Bot,
  Beaker,
  Brush,
  Scale,
  Lightbulb,
  ThumbsDown,
  Smile,
  Hammer,
};
export const getAgentIcon = (iconName: string): LucideIcon => {
  return agentIcons[iconName] || Bot;
};

// Validate API configuration
export const validateApiConfig = (apiConfig?: Agent['apiConfig']): boolean => {
  if (!apiConfig) return false;
  if (!apiConfig.apiKey?.trim()) return false;
  if (!apiConfig.baseURL?.trim()) return false;
  if (apiConfig.type === 'gemini') {
    // For Gemini, check if it's a valid Google API key format
    return apiConfig.apiKey.startsWith('AI') && apiConfig.apiKey.length > 20;
  }
  return true;
};

// Check if agent has valid API configuration
export const isAgentConfigValid = (agent: Agent): boolean => {
  if (!agent.apiConfig) return false;
  return validateApiConfig(agent.apiConfig) && agent.apiConfig.isValidated === true;
};

// Validate API key by making a test call
export const validateApiKey = async (apiConfig: Agent['apiConfig']): Promise<boolean> => {
  if (!apiConfig || !apiConfig.apiKey?.trim() || !apiConfig.baseURL?.trim()) {
    return false;
  }

  try {
    if (apiConfig.type === 'gemini') {
      // Test Google AI Studio API
      const response = await fetch(`${apiConfig.baseURL}/v1/models?key=${apiConfig.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    }
    
    if (apiConfig.type === 'openai') {
      // Test OpenAI API
      const response = await fetch(`${apiConfig.baseURL}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    }
    
    return false;
  } catch (error) {
    console.error('API validation failed:', error);
    return false;
  }
};

// Mark API config as validated
export const markApiConfigValidated = (agent: Agent, isValid: boolean): Agent => {
  return {
    ...agent,
    apiConfig: {
      ...agent.apiConfig,
      isValidated: isValid,
      lastValidated: isValid ? Date.now() : undefined
    }
  };
};