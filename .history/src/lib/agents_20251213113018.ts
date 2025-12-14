import { produce } from 'immer';
import { LucideIcon, Bot, Beaker, Brush, Scale, Lightbulb, ThumbsDown, Smile, Hammer } from 'lucide-react';
import { getApiConfig } from '@/lib/api-configs';
import type { AgentSessionState } from '@/lib/local-store';

export type AgentRole = 'Primary' | 'Observer';
export type AgentStatus = 'Ready' | 'Thinking' | 'Paused' | 'Has Feedback' | 'Hand Raised';
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
  apiConfigId: string; // Reference to global API configuration
  pendingMessages?: Array<{
    id: string;
    content: string;
    timestamp: number;
  }>;
  handRaiseCount?: number;
  // Legacy field for migration - will be removed after migration
  apiConfig?: {
    type: 'openai' | 'gemini' | 'anthropic';
    baseURL: string;
    apiKey: string;
    endpoint?: string;
    isValidated?: boolean;
    lastValidated?: number;
  };
  config: {
    formality: number;
    detail: number;
    approach: number;
    creativity: number;
    participation: AgentParticipation;
  };
}
export type AgentTemplate = Omit<Agent, 'id' | 'status' | 'isActive' | 'role' | 'apiConfig'> & { templateId: string };
const STORAGE_KEY = 'conclave:agents';

// Migrate old agent data to use apiConfigId
const migrateAgent = (agent: any): Agent => {
  // If agent has old apiConfig but no apiConfigId, set a default
  if (agent.apiConfig && !agent.apiConfigId) {
    agent.apiConfigId = 'default-api-config'; // Will need to be created in settings
  }
  // If agent has neither, set default
  if (!agent.apiConfig && !agent.apiConfigId) {
    agent.apiConfigId = 'default-api-config';
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
    apiConfigId: 'default-api-config',
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
    apiConfigId: 'default-api-config',
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
    apiConfigId: 'default-api-config',
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
    apiConfigId: 'default-api-config',
    config: { formality: 70, detail: 80, approach: 30, creativity: 10, participation: 'Relevant' }
  },
  {
    templateId: 'analyst',
    name: 'Analyst',
    icon: 'Scale',
    color: 'bg-sky-500',
    personality: 'Data-driven and strategic, identifies trends.',
    model: 'gemini-2.5-pro',
    apiConfigId: 'default-api-config',
    config: { formality: 80, detail: 70, approach: 20, creativity: 20, participation: 'Relevant' }
  },
  {
    templateId: 'creative',
    name: 'Creative',
    icon: 'Lightbulb',
    color: 'bg-amber-500',
    personality: 'Generates out-of-the-box ideas.',
    model: 'gemini-2.5-flash',
    apiConfigId: 'default-api-config',
    config: { formality: 20, detail: 60, approach: 80, creativity: 90, participation: 'Relevant' }
  },
  {
    templateId: 'critic',
    name: 'Critic',
    icon: 'ThumbsDown',
    color: 'bg-rose-500',
    personality: 'Plays devil\'s advocate, assesses risks.',
    model: 'gemini-2.5-flash',
    apiConfigId: 'default-api-config',
    config: { formality: 60, detail: 50, approach: 90, creativity: 30, participation: 'Relevant' }
  },
  {
    templateId: 'optimist',
    name: 'Optimist',
    icon: 'Smile',
    color: 'bg-yellow-400',
    personality: 'Provides positive perspectives and encouragement.',
    model: 'gemini-2.5-flash',
    apiConfigId: 'default-api-config',
    config: { formality: 30, detail: 40, approach: 70, creativity: 60, participation: 'Relevant' }
  },
  {
    templateId: 'pragmatist',
    name: 'Pragmatist',
    icon: 'Hammer',
    color: 'bg-gray-500',
    personality: 'Focuses on practical solutions and implementation.',
    model: 'gemini-2.5-flash',
    apiConfigId: 'default-api-config',
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

// Check if agent has valid API configuration
export const isAgentConfigValid = (agent: Agent): boolean => {
  const apiConfig = getApiConfig(agent.apiConfigId);
  return !!apiConfig && apiConfig.isValidated === true;
};

// Get agent's API configuration
export const getAgentApiConfig = (agent: Agent) => {
  return getApiConfig(agent.apiConfigId);
};

// Helper functions for session-based agent state management
export const applySessionStateToAgents = (agents: Agent[], sessionStates: Record<string, AgentSessionState>): Agent[] => {
  return agents.map(agent => ({
    ...agent,
    status: sessionStates[agent.id]?.status || 'Ready',
    pendingMessages: sessionStates[agent.id]?.pendingMessages || [],
    handRaiseCount: sessionStates[agent.id]?.handRaiseCount || 0,
  }));
};

export const extractSessionStateFromAgents = (agents: Agent[]): Record<string, AgentSessionState> => {
  const states: Record<string, AgentSessionState> = {};
  agents.forEach(agent => {
    // Only save if there's actual session-specific state
    if (agent.status !== 'Ready' || (agent.pendingMessages && agent.pendingMessages.length > 0) || (agent.handRaiseCount && agent.handRaiseCount > 0)) {
      states[agent.id] = {
        status: agent.status,
        pendingMessages: agent.pendingMessages,
        handRaiseCount: agent.handRaiseCount,
      };
    }
  });
  return states;
};

export const resetAgentSessionState = (agent: Agent): Agent => {
  return {
    ...agent,
    status: 'Ready',
    pendingMessages: [],
    handRaiseCount: 0,
  };
};
