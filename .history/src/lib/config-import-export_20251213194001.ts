import * as YAML from 'js-yaml';
import type { Agent } from './agents';
import type { ApiConfig } from './api-configs';
import type { ChatState } from '../../worker/types';

export interface ConfigExport {
  version: string;
  exportedAt: string;
  agents: Agent[];
  apiConfigs: ApiConfig[];
}

export interface SessionExport {
  version: string;
  exportedAt: string;
  sessionId: string;
  title: string;
  messages: ChatState['messages'];
  agents: Agent[];
  apiConfigs: ApiConfig[];
}

export interface AgentConfigExport {
  version: string;
  exportedAt: string;
  name: string;
  description?: string;
  agents: Agent[];
}

/**
 * Export agents and API configurations to YAML
 */
export function exportConfigToYAML(agents: Agent[], apiConfigs: ApiConfig[]): string {
  const configData: ConfigExport = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    agents: agents.map(agent => {
      // Remove runtime state and legacy fields from export
      const { status, pendingMessages, handRaiseCount, apiConfig, ...cleanAgent } = agent;
      return {
        ...cleanAgent,
        status: 'Ready' as const, // Include required field with default
      };
    }),
    apiConfigs: apiConfigs // Export API configs including keys
  };
  
  return YAML.dump(configData);
}

/**
 * Export a session including messages, agents, and API configs
 */
export function exportSessionToYAML(
  sessionId: string,
  title: string,
  messages: ChatState['messages'],
  agents: Agent[],
  apiConfigs: ApiConfig[]
): string {
  const sessionData: SessionExport = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    sessionId,
    title,
    messages,
    agents: agents.map(agent => {
      // Remove runtime state and legacy fields from export
      const { status, pendingMessages, handRaiseCount, apiConfig, ...cleanAgent } = agent;
      return {
        ...cleanAgent,
        status: 'Ready' as const,
      };
    }),
    apiConfigs: apiConfigs // Export API configs including keys
  };
  
  return YAML.dump(sessionData);
}

/**
 * Export agent configuration to YAML (just agents with API config references)
 */
export function exportAgentConfigToYAML(name: string, description: string | undefined, agents: Agent[]): string {
  const configData: AgentConfigExport = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    name,
    description,
    agents: agents.map(agent => {
      // Remove runtime state and legacy fields from export
      const { status, pendingMessages, handRaiseCount, apiConfig, ...cleanAgent } = agent;
      return {
        ...cleanAgent,
        status: 'Ready' as const,
        // Only keep apiConfigId reference, not the full config object
      };
    })
  };
  
  return YAML.dump(configData);
}

/**
 * Import configuration from YAML
 */
export function importConfigFromYAML(yamlContent: string): { agents: Agent[]; apiConfigs: ApiConfig[] } {
  const parsed = YAML.load(yamlContent) as any;
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML format');
  }
  
  // Validate required fields
  if (!Array.isArray(parsed.agents)) {
    throw new Error('Invalid configuration: agents must be an array');
  }
  
  if (!Array.isArray(parsed.apiConfigs)) {
    throw new Error('Invalid configuration: apiConfigs must be an array');
  }
  
  // Regenerate IDs for imported data to avoid conflicts
  const agents: Agent[] = parsed.agents.map((agent: any) => ({
    ...agent,
    id: crypto.randomUUID(),
    status: 'Ready' as const,
    isActive: agent.isActive !== false,
    pendingMessages: [],
    handRaiseCount: 0,
  }));
  
  const apiConfigs: ApiConfig[] = parsed.apiConfigs.map((config: any) => ({
    ...config,
    id: crypto.randomUUID(),
    isValidated: false, // Force revalidation after import
    lastValidated: undefined,
  }));
  
  return { agents, apiConfigs };
}

/**
 * Import session from YAML
 */
export function importSessionFromYAML(yamlContent: string): SessionExport {
  const parsed = YAML.load(yamlContent) as any;
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML format');
  }
  
  // Validate required fields for session
  if (!parsed.sessionId || !parsed.title || !Array.isArray(parsed.messages)) {
    throw new Error('Invalid session format: missing required fields');
  }
  
  // Process agents and apiConfigs similar to config import
  const agents: Agent[] = Array.isArray(parsed.agents) ? parsed.agents.map((agent: any) => ({
    ...agent,
    id: crypto.randomUUID(),
    status: 'Ready' as const,
    isActive: agent.isActive !== false,
    pendingMessages: [],
    handRaiseCount: 0,
  })) : [];
  
  const apiConfigs: ApiConfig[] = Array.isArray(parsed.apiConfigs) ? parsed.apiConfigs.map((config: any) => ({
    ...config,
    id: crypto.randomUUID(),
    isValidated: false,
    lastValidated: undefined,
  })) : [];
  
  return {
    version: parsed.version || '1.0.0',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    sessionId: crypto.randomUUID(), // Generate new session ID
    title: parsed.title,
    messages: parsed.messages,
    agents,
    apiConfigs,
  };
}

/**
 * Import agent configuration from YAML
 */
export function importAgentConfigFromYAML(yamlContent: string): AgentConfigExport {
  const parsed = YAML.load(yamlContent) as any;
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML format');
  }
  
  if (!Array.isArray(parsed.agents)) {
    throw new Error('Invalid agent configuration: agents must be an array');
  }
  
  const agents: Agent[] = parsed.agents.map((agent: any) => ({
    ...agent,
    id: crypto.randomUUID(),
    status: 'Ready' as const,
    isActive: agent.isActive !== false,
    pendingMessages: [],
    handRaiseCount: 0,
  }));
  
  return {
    version: parsed.version || '1.0.0',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    name: parsed.name || 'Imported Configuration',
    description: parsed.description,
    agents,
  };
}

/**
 * Generate a filename with timestamp for export
 */
export function generateExportFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `conclave-config-${timestamp}.yaml`;
}

/**
 * Generate a filename for session export
 */
export function generateSessionExportFilename(title: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30);
  return `conclave-session-${sanitizedTitle}-${timestamp}.yaml`;
}

/**
 * Generate a filename for agent config export
 */
export function generateAgentConfigExportFilename(name: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const sanitizedName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30);
  return `conclave-agents-${sanitizedName}-${timestamp}.yaml`;
}

/**
 * Trigger browser download of YAML content
 */
export function downloadYAMLFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read file content as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
