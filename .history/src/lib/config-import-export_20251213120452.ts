import yaml from 'js-yaml';
import type { Agent } from './agents';
import type { ApiConfig } from './api-configs';
import type { Message, SessionInfo } from '../../worker/types';
import type { AgentSessionState } from './local-store';

export interface ConfigExport {
  version: string;
  exportDate: string;
  agents: Agent[];
  apiConfigs: ApiConfig[];
}

export interface SessionExport {
  version: string;
  exportDate: string;
  session: {
    id: string;
    title: string;
    createdAt: number;
    lastActive: number;
  };
  messages: Message[];
  agentStates: Record<string, AgentSessionState>; // agentId -> session-specific state
  model: string;
}

const EXPORT_PATH_KEY = 'conclave:last-export-path';
const IMPORT_PATH_KEY = 'conclave:last-import-path';

/**
 * Get the last used export path from localStorage
 */
export const getLastExportPath = (): string | null => {
  try {
    return localStorage.getItem(EXPORT_PATH_KEY);
  } catch (error) {
    console.error('Failed to get last export path:', error);
    return null;
  }
};

/**
 * Save the export path to localStorage
 */
export const saveLastExportPath = (path: string): void => {
  try {
    localStorage.setItem(EXPORT_PATH_KEY, path);
  } catch (error) {
    console.error('Failed to save last export path:', error);
  }
};

/**
 * Get the last used import path from localStorage
 */
export const getLastImportPath = (): string | null => {
  try {
    return localStorage.getItem(IMPORT_PATH_KEY);
  } catch (error) {
    console.error('Failed to get last import path:', error);
    return null;
  }
};

/**
 * Save the import path to localStorage
 */
export const saveLastImportPath = (path: string): void => {
  try {
    localStorage.setItem(IMPORT_PATH_KEY, path);
  } catch (error) {
    console.error('Failed to save last import path:', error);
  }
};

/**
 * Format current date/time as YYYY-MM-DD-HH-MM-SS
 */
export const getTimestampString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
};

/**
 * Generate export filename with timestamp
 */
export const generateExportFilename = (): string => {
  return `conclave-config-${getTimestampString()}.yaml`;
};

/**
 * Export configuration to YAML format
 */
export const exportConfigToYAML = (agents: Agent[], apiConfigs: ApiConfig[]): string => {
  const exportData: ConfigExport = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    agents: agents,
    apiConfigs: apiConfigs,
  };

  return yaml.dump(exportData, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
};

/**
 * Parse YAML configuration file
 */
export const importConfigFromYAML = (yamlContent: string): ConfigExport => {
  try {
    const parsed = yaml.load(yamlContent) as ConfigExport;
    
    // Validate the import structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML format');
    }
    
    if (!parsed.version || !parsed.agents || !parsed.apiConfigs) {
      throw new Error('Invalid configuration file format - missing required fields');
    }
    
    if (!Array.isArray(parsed.agents) || !Array.isArray(parsed.apiConfigs)) {
      throw new Error('Invalid configuration file format - agents and apiConfigs must be arrays');
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML configuration: ${error.message}`);
    }
    throw new Error('Failed to parse YAML configuration');
  }
};

/**
 * Download YAML content as a file
 */
export const downloadYAMLFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Trigger file picker for import
 */
export const triggerFileImport = (onFileSelected: (file: File) => void): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.yaml,.yml';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };
  input.click();
};

/**
 * Read file as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
};
