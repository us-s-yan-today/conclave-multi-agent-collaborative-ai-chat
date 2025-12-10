import { produce } from 'immer';
import { LucideIcon, Bot, Beaker, Brush } from 'lucide-react';
export type AgentRole = 'Primary' | 'Observer';
export type AgentStatus = 'Ready' | 'Thinking' | 'Paused' | 'Has Feedback';
export type AgentParticipation = 'Always' | 'Relevant' | 'OnDemand';
export interface Agent {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; // LucideIcon name as string for serialization
  color: string; // Tailwind bg color class
  personality: string;
  systemPrompt?: string;
  status: AgentStatus;
  isActive: boolean;
  role: AgentRole;
  model: string;
  config: {
    formality: number;
    detail: number;
    approach: number;
    creativity: number;
    participation: AgentParticipation;
  };
}
const STORAGE_KEY = 'conclave:agents';
export const getAgents = (): Agent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
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
export const createAgent = (newAgent: Omit<Agent, 'id' | 'status' | 'isActive' | 'role'>): Agent => {
  const agent: Agent = {
    ...newAgent,
    id: crypto.randomUUID(),
    status: 'Ready',
    isActive: true,
    role: 'Observer',
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
    model: 'google-ai-studio/gemini-2.5-flash',
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
    model: 'google-ai-studio/gemini-2.5-pro',
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
    model: 'google-ai-studio/gemini-2.5-flash',
    config: {
      formality: 20,
      detail: 60,
      approach: 80,
      creativity: 90,
      participation: 'Relevant',
    },
  },
];
export const getAgentIcon = (iconName: string): LucideIcon => {
  const icons: { [key: string]: LucideIcon } = {
    Bot,
    Beaker,
    Brush,
  };
  return icons[iconName] || Bot;
};
export const agentIcons: { [key: string]: LucideIcon } = {
  Bot,
  Beaker,
  Brush,
};