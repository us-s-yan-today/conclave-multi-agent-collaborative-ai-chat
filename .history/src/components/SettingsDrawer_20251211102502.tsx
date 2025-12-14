import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, Plus, CheckCircle, AlertTriangle, Edit, X, ChevronDown } from 'lucide-react';
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
import { produce } from 'immer';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelInputValue, setModelInputValue] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiConfigs(getApiConfigs());
    }
  }, [isOpen]);

  // Check if we have at least one validated API config
  const hasValidatedConfig = apiConfigs.some(config => config.isValidated);

  const handleCreateNew = (type: 'openai' | 'gemini' | 'anthropic') => {
    const defaultConfig = getDefaultApiConfig(type);
    const newConfig = {
      ...defaultConfig,
      id: crypto.randomUUID()
    } as ApiConfig;
    setEditingConfig(newConfig);
    setSelectedModels(newConfig.models || []);
    setModelInputValue('');
  };

  const handleEdit = (config: ApiConfig) => {
    setEditingConfig({ ...config });
    setSelectedModels(config.models || []);
    setModelInputValue('');
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev => {
      const newSelection = prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId];
      
      // Update the editing config
      if (editingConfig) {
        updateEditingField('models', newSelection);
      }
      
      return newSelection;
    });
  };

  const handleAddModelFromInput = () => {
    const trimmedInput = modelInputValue.trim();
    if (trimmedInput && !selectedModels.includes(trimmedInput)) {
      const newModels = [...selectedModels, trimmedInput];
      setSelectedModels(newModels);
      setModelInputValue('');
      setIsModelDropdownOpen(false);
      
      // Update the editing config
      if (editingConfig) {
        updateEditingField('models', newModels);
      }
    }
  };

  const getAvailableModels = () => {
    return editingConfig?.models?.filter(model => !selectedModels.includes(model)) || [];
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

    if (!editingConfig.name.trim()) {
      toast.error("Configuration name is required.");
      return;
    }

    if (!editingConfig.apiKey.trim()) {
      toast.error("API key is required.");
      return;
    }

    try {
      const isExisting = apiConfigs.some(c => c.id === editingConfig.id);
      
      if (isExisting) {
        updateApiConfig(editingConfig);
      } else {
        createApiConfig(editingConfig);
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
        models: validation.models
      };
      
      updateApiConfig(updatedConfig);
      setApiConfigs(getApiConfigs());
      
      // Update the editing config if it's the same one being validated
      if (editingConfig && editingConfig.id === config.id) {
        setEditingConfig(updatedConfig);
        // Update selected models to reflect any newly discovered models
        if (validation.success && validation.models) {
          // Keep existing selected models that are still valid, add any that were previously selected manually
          const currentlySelected = selectedModels.filter(model =>
            validation.models.includes(model) || !config.models.includes(model)
          );
          setSelectedModels(currentlySelected);
        }
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
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-4xl mx-auto max-h-[90vh]">
        <div className="p-4">
          <DrawerHeader>
            <DrawerTitle>API Settings</DrawerTitle>
          </DrawerHeader>
          
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {/* API Configurations List */}
            <div>
              <div className="flex justify-between items-center mb-4">
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
                {apiConfigs.map((config) => (
                  <div key={config.id} className="border rounded-lg p-4">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit className="w-4 h-4" />
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
                  </div>
                ))}

                {apiConfigs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No API configurations yet. Add your first API to get started.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Configuration Form */}
            {editingConfig && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  {apiConfigs.some(c => c.id === editingConfig.id) ? 'Edit' : 'Add'} API Configuration
                </h3>
                
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
                        const defaults = getDefaultApiConfig(value);
                        setEditingConfig({
                          ...editingConfig,
                          ...defaults,
                          name: editingConfig.name || defaults.name
                        });
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
                  
                  {/* Models Multi-Selection */}
                  <div className="md:col-span-2">
                    <Label>Available Models</Label>
                    <div className="space-y-2">
                      {/* Selected Models Display */}
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
                      
                      {/* Model Selection Combobox */}
                      <Popover open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isModelDropdownOpen}
                            className="w-full justify-between"
                          >
                            {modelInputValue || "Select model or type to add..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search models or type new model..."
                              value={modelInputValue}
                              onValueChange={setModelInputValue}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddModelFromInput();
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  const filtered = getFilteredModels();
                                  if (filtered.length > 0) {
                                    setModelInputValue(filtered[0]);
                                  }
                                }
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {modelInputValue.trim() ? (
                                  <div className="py-2 px-2">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start"
                                      onClick={handleAddModelFromInput}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{modelInputValue.trim()}"
                                    </Button>
                                  </div>
                                ) : (
                                  "No models available. Type to add custom model."
                                )}
                              </CommandEmpty>
                              {getFilteredModels().length > 0 && (
                                <CommandGroup heading="Available Models">
                                  {getFilteredModels().map((modelId) => (
                                    <CommandItem
                                      key={modelId}
                                      value={modelId}
                                      onSelect={() => handleModelToggle(modelId)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      {modelId}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
            )}
          </div>
          
          <DrawerFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}