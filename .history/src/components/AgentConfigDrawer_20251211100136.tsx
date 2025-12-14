import { useState, useEffect } from 'react';
import { Agent, agentIcons, getAgentIcon, loadAgentTemplate, TEMPLATE_PRESETS, isAgentConfigValid, getAgentApiConfig } from '@/lib/agents';
import { getApiConfigs, ApiConfig } from '@/lib/api-configs';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { produce } from 'immer';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface AgentConfigDrawerProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

const iconEntries = Object.entries(agentIcons);
const colors = ['bg-indigo-500', 'bg-green-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-purple-500'];

const newAgentTemplate = (): Agent => {
  return loadAgentTemplate('researcher') || {
    id: crypto.randomUUID(),
    name: 'New Agent',
    icon: 'Bot',
    color: 'bg-indigo-500',
    personality: '',
    status: 'Ready',
    isActive: true,
    role: 'Observer',
    model: 'gemini-2.5-flash',
    apiConfigId: 'default-api-config',
    config: { formality: 50, detail: 50, approach: 50, creativity: 50, participation: 'Relevant' },
  };
};

export function AgentConfigDrawer({ agent, isOpen, onClose, onSave }: AgentConfigDrawerProps) {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [selectedApiConfig, setSelectedApiConfig] = useState<ApiConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentAgent(agent || newAgentTemplate());
      setIsAdvanced(!!(agent?.systemPrompt));
      const configs = getApiConfigs();
      setApiConfigs(configs);
      
      if (agent?.apiConfigId) {
        const config = configs.find(c => c.id === agent.apiConfigId);
        setSelectedApiConfig(config || null);
      } else {
        setSelectedApiConfig(null);
      }
    }
  }, [agent, isOpen]);

  if (!isOpen || !currentAgent) return null;

  const handleSave = () => {
    if (currentAgent) {
      if (!currentAgent.name.trim()) {
        toast.error("Agent name is required.");
        return;
      }
      
      if (!selectedApiConfig || !selectedApiConfig.isValidated) {
        toast.error("Please select a validated API configuration.");
        return;
      }
      
      // Ensure the model is available in the selected API
      if (!selectedApiConfig.models.includes(currentAgent.model)) {
        toast.error("Selected model is not available in the chosen API configuration.");
        return;
      }

      onSave(currentAgent);
      onClose();
    }
  };

  const updateField = <K extends keyof Agent>(field: K, value: Agent[K]) => {
    setCurrentAgent(produce(draft => { if (draft) { draft[field] = value; } }));
  };

  const updateConfig = <K extends keyof Agent['config']>(field: K, value: Agent['config'][K]) => {
    setCurrentAgent(produce(draft => { if (draft) { draft.config[field] = value; } }));
  };

  const handleApiConfigChange = (apiConfigId: string) => {
    const config = apiConfigs.find(c => c.id === apiConfigId);
    setSelectedApiConfig(config || null);
    updateField('apiConfigId', apiConfigId);
    
    // Reset model if it's not available in the new API config
    if (config && !config.models.includes(currentAgent.model)) {
      updateField('model', config.models[0] || '');
    }
  };

  const getAvailableModels = (): string[] => {
    return selectedApiConfig?.models || [];
  };

  const getApiConfigDisplay = (config: ApiConfig) => {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {config.isValidated ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          )}
          <span>{config.name}</span>
          <Badge variant="secondary" className="text-xs capitalize">
            {config.type}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {config.models.length} models
        </span>
      </div>
    );
  };

  const IconComponent = getAgentIcon(currentAgent.icon);
  const validatedApiConfigs = apiConfigs.filter(config => config.isValidated);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-4xl mx-auto">
        <div className="p-4">
          <DrawerHeader>
            <DrawerTitle>{agent?.id ? 'Edit Agent' : 'Create New Agent'}</DrawerTitle>
            <DrawerDescription>
              Configure the agent's personality, behavior, and select an API configuration.
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Basic Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${currentAgent.color} transition-colors`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input 
                    id="agent-name" 
                    value={currentAgent.name} 
                    onChange={(e) => updateField('name', e.target.value)} 
                  />
                </div>
              </div>
              
              <div>
                <Label>Avatar</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {iconEntries.map(([name, Icon]) => (
                    <Button 
                      key={name} 
                      variant={currentAgent.icon === name ? 'default' : 'outline'} 
                      size="icon" 
                      onClick={() => updateField('icon', name)}
                    >
                      <Icon className="w-5 h-5" />
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {colors.map((color) => (
                    <button 
                      key={color} 
                      className={`w-8 h-8 rounded-full ${color} border-2 ${
                        currentAgent.color === color ? 'border-primary ring-2 ring-ring' : 'border-transparent'
                      }`} 
                      onClick={() => updateField('color', color)} 
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="agent-personality">Personality</Label>
                <Textarea 
                  id="agent-personality" 
                  value={currentAgent.personality} 
                  onChange={(e) => updateField('personality', e.target.value)} 
                  rows={4} 
                />
              </div>
            </div>
            
            {/* Agent Behavior Configuration */}
            <div className="space-y-4">
              <motion.div>
                <Label>
                  Formality: <span className="text-muted-foreground font-normal">{currentAgent.config.formality}%</span>
                </Label>
                <Slider 
                  value={[currentAgent.config.formality]} 
                  onValueChange={([v]) => updateConfig('formality', v)} 
                  step={10} 
                />
              </motion.div>
              
              <motion.div>
                <Label>
                  Detail Level: <span className="text-muted-foreground font-normal">{currentAgent.config.detail}%</span>
                </Label>
                <Slider 
                  value={[currentAgent.config.detail]} 
                  onValueChange={([v]) => updateConfig('detail', v)} 
                  step={10} 
                />
              </motion.div>
              
              <motion.div>
                <Label>
                  Approach: <span className="text-muted-foreground font-normal">{currentAgent.config.approach}%</span>
                </Label>
                <Slider 
                  value={[currentAgent.config.approach]} 
                  onValueChange={([v]) => updateConfig('approach', v)} 
                  step={10} 
                />
              </motion.div>
              
              <motion.div>
                <Label>
                  Creativity: <span className="text-muted-foreground font-normal">{currentAgent.config.creativity}%</span>
                </Label>
                <Slider 
                  value={[currentAgent.config.creativity]} 
                  onValueChange={([v]) => updateConfig('creativity', v)} 
                  step={10} 
                />
              </motion.div>
              
              <div className="flex items-center space-x-2 pt-4">
                <Switch 
                  id="advanced-mode" 
                  checked={isAdvanced} 
                  onCheckedChange={setIsAdvanced} 
                />
                <Label htmlFor="advanced-mode">Advanced (System Prompt)</Label>
              </div>
              
              {isAdvanced && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea 
                    id="system-prompt" 
                    value={currentAgent.systemPrompt || ''} 
                    onChange={(e) => updateField('systemPrompt', e.target.value)} 
                    rows={3} 
                    placeholder="e.g., You are a helpful AI assistant..." 
                  />
                </motion.div>
              )}
            </div>
            
            {/* API Configuration Selection */}
            <div className="md:col-span-2 border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">API Configuration</h3>
                {(!selectedApiConfig || !selectedApiConfig.isValidated) && (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" title="Valid API configuration required" />
                )}
              </div>
              
              <div className="space-y-4">
                {validatedApiConfigs.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium">No validated API configurations found</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      You need to add and validate at least one API configuration before creating agents.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Go to Settings to add your API configurations.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="api-config-select">Select API Configuration</Label>
                      <Select
                        value={currentAgent.apiConfigId}
                        onValueChange={handleApiConfigChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an API configuration..." />
                        </SelectTrigger>
                        <SelectContent>
                          {validatedApiConfigs.map(config => (
                            <SelectItem key={config.id} value={config.id}>
                              {getApiConfigDisplay(config)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {selectedApiConfig && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{selectedApiConfig.name}</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {selectedApiConfig.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {selectedApiConfig.models.length} models available
                          {selectedApiConfig.lastValidated && (
                            <span> • Validated {new Date(selectedApiConfig.lastValidated).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="agent-model">Model</Label>
                      <Select 
                        value={currentAgent.model} 
                        onValueChange={(value) => updateField('model', value)}
                        disabled={!selectedApiConfig}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedApiConfig ? "Select a model..." : "Select API configuration first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableModels().map(model => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <DrawerFooter>
            <Button 
              onClick={handleSave}
              disabled={!selectedApiConfig || !selectedApiConfig.isValidated || validatedApiConfigs.length === 0}
            >
              Save Agent
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}