import { useState, useEffect, useRef } from 'react';
import { ConfigDrawer } from '@/components/ConfigDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, Plus, CheckCircle, AlertTriangle, Edit, X, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { 
  ApiConfig, 
  getApiConfigs, 
  createApiConfig, 
  updateApiConfig, 
  deleteApiConfig, 
  validateApiConfig,
  getDefaultApiConfig
} from '@/lib/api-configs';
import { Agent, getAgents, saveAgents } from '@/lib/agents';
import { produce } from 'immer';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfigExport {
  version: string;
  exportDate: string;
  agents: Agent[];
  apiConfigs: ApiConfig[];
}

const DEFAULT_MODEL_SUGGESTIONS: Record<ApiConfig['type'], string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  gemini: ['gemini-2.0-pro-exp-02-05', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
};

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelInputValue, setModelInputValue] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [availableModelOptions, setAvailableModelOptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setApiConfigs(getApiConfigs());
    }
  }, [isOpen]);

  const syncModelOptions = (config: ApiConfig, optionSeeds?: string[], selectionOverride?: string[]) => {
    const selection = selectionOverride ?? (config.models || []);
    setSelectedModels(selection);
    const seeds = optionSeeds ?? config.models ?? [];
    const defaults = DEFAULT_MODEL_SUGGESTIONS[config.type] || [];
    setAvailableModelOptions(Array.from(new Set([...defaults, ...seeds, ...selection])));
  };

  const openEditorForConfig = (config: ApiConfig, selectionOverride?: string[], optionSeeds?: string[]) => {
    setEditingConfig(config);
    syncModelOptions(config, optionSeeds, selectionOverride);
    setModelInputValue('');
  };

  // Check if we have at least one validated API config
  const hasValidatedConfig = apiConfigs.some(config => config.isValidated);

  const handleCreateNew = (type: 'openai' | 'gemini' | 'anthropic') => {
    const defaultConfig = getDefaultApiConfig(type);
    const newConfig = {
      ...defaultConfig,
      id: crypto.randomUUID()
    } as ApiConfig;
    openEditorForConfig(newConfig);
  };

  const handleEdit = (config: ApiConfig) => {
    openEditorForConfig({ ...config });
  };

  const handleAddModelFromInput = () => {
    const trimmedInput = modelInputValue.trim();
    if (trimmedInput && !selectedModels.includes(trimmedInput)) {
      const newModels = [...selectedModels, trimmedInput];
      setSelectedModels(newModels);
      setAvailableModelOptions(prev => Array.from(new Set([...prev, trimmedInput])));
      setModelInputValue('');
      setIsModelDropdownOpen(false);
      
      // Update the editing config
      if (editingConfig) {
        updateEditingField('models', newModels);
      }
    }
  };

  const getAvailableModels = () => {
    return availableModelOptions.filter(model => !selectedModels.includes(model));
  };

  const getFilteredModels = () => {
    const available = getAvailableModels();
    if (!modelInputValue.trim()) return available;
    return available.filter(model =>
      model.toLowerCase().includes(modelInputValue.toLowerCase())
    );
  };

  const handleRemoveModel = (modelId: string) => {
    const newModels = selectedModels.filter(id => id !== modelId);
    setSelectedModels(newModels);
    
    // Update the editing config
    if (editingConfig) {
      updateEditingField('models', newModels);
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    const configToPersist = { ...editingConfig, models: selectedModels };

    if (!configToPersist.name.trim()) {
      toast.error("Configuration name is required.");
      return;
    }

    if (!configToPersist.apiKey.trim()) {
      toast.error("API key is required.");
      return;
    }

    try {
      const isExisting = apiConfigs.some(c => c.id === configToPersist.id);
      
      if (isExisting) {
        updateApiConfig(configToPersist);
      } else {
        createApiConfig(configToPersist);
      }
      
      setApiConfigs(getApiConfigs());
      setEditingConfig(null);
      toast.success("API configuration saved successfully!");
    } catch (error) {
      toast.error("Failed to save configuration.");
    }
  };

  const handleValidate = async (config: ApiConfig) => {
    setIsValidating(config.id);
    try {
      const validation = await validateApiConfig(config);
      const updatedConfig = {
        ...config,
        isValidated: validation.success,
        lastValidated: validation.success ? Date.now() : undefined,
        models: validation.success ? validation.models : config.models
      };
      
      updateApiConfig(updatedConfig);
      setApiConfigs(getApiConfigs());
      
      // Update the editing config if it's the same one being validated
      if (editingConfig && editingConfig.id === config.id) {
        let nextSelection = selectedModels;
        if (validation.success && validation.models) {
          // Keep existing models that are still valid, but preserve custom additions too
          nextSelection = selectedModels.filter(model =>
            validation.models.includes(model) || !config.models.includes(model)
          );
          if (nextSelection.length === 0) {
            nextSelection = validation.models;
          }
        }
        openEditorForConfig(updatedConfig, nextSelection, validation.models);
      }
      
      if (validation.success) {
        toast.success(`API validated successfully! Found ${validation.models.length} models.`);
      } else {
        toast.error("API validation failed. Please check your credentials.");
      }
    } catch (error) {
      toast.error("Validation failed due to network error.");
    } finally {
      setIsValidating(null);
    }
  };

  const handleDelete = (configId: string) => {
    deleteApiConfig(configId);
    setApiConfigs(getApiConfigs());
    if (editingConfig?.id === configId) {
      setEditingConfig(null);
    }
    toast.success("API configuration deleted.");
  };

  const handleExportConfig = () => {
    try {
      const agents = getAgents();
      const exportData: ConfigExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        agents: agents,
        apiConfigs: apiConfigs,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `conclave-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Configuration exported successfully!');
    } catch (error) {
      toast.error('Failed to export configuration');
      console.error(error);
    }
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content) as ConfigExport;

        // Validate the import structure
        if (!importData.version || !importData.agents || !importData.apiConfigs) {
          throw new Error('Invalid configuration file format');
        }

        // Import agents
        if (importData.agents && Array.isArray(importData.agents)) {
          // Generate new IDs for imported agents to avoid conflicts
          const newAgents = importData.agents.map(agent => ({
            ...agent,
            id: crypto.randomUUID(),
            status: 'Ready' as const,
          }));
          saveAgents(newAgents);
        }

        // Import API configs
        if (importData.apiConfigs && Array.isArray(importData.apiConfigs)) {
          importData.apiConfigs.forEach(config => {
            const newConfig = {
              ...config,
              id: crypto.randomUUID(),
              // Reset validation status on import
              isValidated: false,
              lastValidated: undefined,
            };
            createApiConfig(newConfig);
          });
          setApiConfigs(getApiConfigs());
        }

        toast.success(`Configuration imported successfully! Added ${importData.agents.length} agents and ${importData.apiConfigs.length} API configs.`);
      } catch (error) {
        toast.error('Failed to import configuration. Please check the file format.');
        console.error(error);
      }
    };

    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (configId: string) => {
    deleteApiConfig(configId);
    setApiConfigs(getApiConfigs());
    if (editingConfig?.id === configId) {
      setEditingConfig(null);
      setSelectedModels([]);
      setAvailableModelOptions([]);
    }
    toast.success("API configuration deleted.");
  };

  const updateEditingField = <K extends keyof ApiConfig>(field: K, value: ApiConfig[K]) => {
    if (!editingConfig) return;
    setEditingConfig(produce(draft => { 
      if (draft) { 
        draft[field] = value;
        // Reset validation when key fields change
        if (field === 'apiKey' || field === 'baseURL') {
          draft.isValidated = false;
          draft.models = [];
        }
      } 
    }));
    if (field === 'apiKey' || field === 'baseURL') {
      const defaults = editingConfig ? DEFAULT_MODEL_SUGGESTIONS[editingConfig.type] || [] : [];
      setSelectedModels([]);
      setAvailableModelOptions(defaults);
    }
  };

  const renderConfigForm = () => {
    if (!editingConfig) return null;
    const shouldShowDropdown = isModelDropdownOpen && (modelInputValue.length > 0 || getFilteredModels().length > 0);

    return (
      <div className="mt-4 rounded-lg border bg-background/60 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-name">Name</Label>
            <Input
              id="config-name"
              value={editingConfig.name}
              onChange={(e) => updateEditingField('name', e.target.value)}
              placeholder="e.g., OpenAI GPT-4"
            />
          </div>
          
          <div>
            <Label htmlFor="config-type">Type</Label>
            <Select 
              value={editingConfig.type} 
              onValueChange={(value: 'openai' | 'gemini' | 'anthropic') => {
                if (!editingConfig) return;
                const defaults = getDefaultApiConfig(value);
                const updatedConfig = {
                  ...editingConfig,
                  ...defaults,
                  id: editingConfig.id,
                  name: editingConfig.name || defaults.name,
                  isValidated: false
                } as ApiConfig;
                openEditorForConfig(updatedConfig);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="config-base-url">Base URL</Label>
            <Input
              id="config-base-url"
              value={editingConfig.baseURL}
              onChange={(e) => updateEditingField('baseURL', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="config-endpoint">Endpoint</Label>
            <Input
              id="config-endpoint"
              value={editingConfig.endpoint || ''}
              onChange={(e) => updateEditingField('endpoint', e.target.value)}
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="config-api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="config-api-key"
                type="password"
                value={editingConfig.apiKey}
                onChange={(e) => updateEditingField('apiKey', e.target.value)}
                placeholder={
                  editingConfig.type === 'openai' ? 'sk-...' :
                  editingConfig.type === 'gemini' ? 'AIz...' :
                  editingConfig.type === 'anthropic' ? 'sk-ant-...' : ''
                }
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => editingConfig && handleValidate(editingConfig)}
                disabled={!editingConfig?.apiKey.trim() || isValidating === editingConfig?.id}
              >
                {isValidating === editingConfig?.id ? "Validating..." : "Validate"}
              </Button>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <Label>Use Models</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                {selectedModels.length > 0 ? (
                  selectedModels.map((modelId) => (
                    <Badge
                      key={modelId}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {modelId}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveModel(modelId)}
                      />
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No models selected</span>
                )}
              </div>
              
              <div className="relative">
                <Input
                  placeholder="Type to search or add..."
                  value={modelInputValue}
                  onChange={(e) => {
                    setModelInputValue(e.target.value);
                    setIsModelDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setIsModelDropdownOpen(getAvailableModels().length > 0 || modelInputValue.length > 0);
                  }}
                  onBlur={() => {
                    // Delay closing to allow clicks on suggestions
                    setTimeout(() => setIsModelDropdownOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModelFromInput();
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      const filtered = getFilteredModels();
                      if (filtered.length > 0) {
                        setModelInputValue(filtered[0]);
                        setIsModelDropdownOpen(true);
                      }
                    } else if (e.key === 'Escape') {
                      setIsModelDropdownOpen(false);
                      setModelInputValue('');
                    }
                  }}
                />
                
                {shouldShowDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                    <Command>
                      <CommandList className="max-h-48">
                        {getFilteredModels().length > 0 ? (
                          <CommandGroup>
                            {getFilteredModels().map((modelId) => (
                              <CommandItem
                                key={modelId}
                                value={modelId}
                                onSelect={() => {
                                  const newModels = [...selectedModels, modelId];
                                  setSelectedModels(newModels);
                                  updateEditingField('models', newModels);
                                  setModelInputValue('');
                                  setIsModelDropdownOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {modelId}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ) : (
                          <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                            {modelInputValue.trim() ? `Press Enter to add "${modelInputValue.trim()}"` : 'Type to add a model'}
                          </CommandEmpty>
                        )}
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={!editingConfig?.isValidated}
          >
            {apiConfigs.some(c => c.id === editingConfig.id) ? 'Update' : 'Add'}
          </Button>
          <Button variant="outline" onClick={() => setEditingConfig(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <ConfigDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="API Settings"
      footerActions={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">API Configurations</h3>
          <div className="flex flex-col items-end">
            <Select
              onValueChange={(type: 'openai' | 'gemini' | 'anthropic') => handleCreateNew(type)}
              disabled={!hasValidatedConfig && apiConfigs.length > 0}
            >
              <SelectTrigger className={`w-auto ${!hasValidatedConfig && apiConfigs.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Plus className="w-4 h-4 mr-2" />
                <SelectValue placeholder={
                  !hasValidatedConfig && apiConfigs.length > 0
                    ? "Validate existing API first"
                    : "Add API"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              </SelectContent>
            </Select>
            {!hasValidatedConfig && apiConfigs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Please validate at least one API configuration before adding more
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {editingConfig && !apiConfigs.some(c => c.id === editingConfig.id) && (
            <div className="border rounded-lg p-4 ring-2 ring-primary/20 bg-muted/40">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">New API Configuration</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {editingConfig.type}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditingConfig(null)}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
              {renderConfigForm()}
            </div>
          )}

          {apiConfigs.map((config) => {
            const isEditing = editingConfig?.id === config.id;
            return (
              <div
                key={config.id}
                className={`border rounded-lg p-4 transition-colors ${isEditing ? 'ring-2 ring-primary/20 bg-muted/40' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {config.isValidated ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      )}
                      <div>
                        <h4 className="font-medium">{config.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {config.type} • {config.models.length} models
                          {config.isValidated && config.lastValidated && (
                            <span> • Validated {new Date(config.lastValidated).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {config.type}
                    </Badge>
                    <Button
                      variant={isEditing ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => isEditing ? setEditingConfig(null) : handleEdit(config)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {isEditing ? 'Close' : 'Edit'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {isEditing && renderConfigForm()}
              </div>
            );
          })}

          {apiConfigs.length === 0 && !editingConfig && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No API configurations yet. Add your first API to get started.</p>
            </div>
          )}
        </div>
      </div>
    </ConfigDrawer>
  );
}
