import { Agent, agentIcons, getAgentIcon, loadAgentTemplate, TEMPLATE_PRESETS, validateApiConfig, validateApiKey, markApiConfigValidated } from '@/lib/agents';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MODELS } from '@/lib/chat';
import { useState, useEffect } from 'react';
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
    apiConfig: {
      type: 'gemini',
      baseURL: '',
      apiKey: '',
      endpoint: '',
      isValidated: false
    },
    config: { formality: 50, detail: 50, approach: 50, creativity: 50, participation: 'Relevant' },
  };
};
export function AgentConfigDrawer({ agent, isOpen, onClose, onSave }: AgentConfigDrawerProps) {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setCurrentAgent(agent || newAgentTemplate());
      setIsAdvanced(!!(agent?.systemPrompt));
    }
  }, [agent, isOpen]);
  if (!isOpen || !currentAgent) return null;
  const handleSave = () => {
    if (currentAgent) {
      if (!currentAgent.name.trim()) {
        toast.error("Agent name is required.");
        return;
      }
      if (!currentAgent.apiConfig?.isValidated) {
        toast.error("Please validate your Google API key before saving.");
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
  
  const updateApiConfig = <K extends keyof Agent['apiConfig']>(field: K, value: Agent['apiConfig'][K]) => {
    setCurrentAgent(produce(draft => { if (draft) { draft.apiConfig[field] = value; } }));
  };

  const setGoogleApiDefaults = () => {
    updateApiConfig('type', 'gemini');
    updateApiConfig('baseURL', 'https://generativelanguage.googleapis.com');
    updateApiConfig('endpoint', '/v1/models/{model}:generateContent');
  };

  const handleValidateApiKey = async () => {
    if (!currentAgent?.apiConfig) return;
    
    setIsValidating(true);
    try {
      const isValid = await validateApiKey(currentAgent.apiConfig);
      const updatedAgent = markApiConfigValidated(currentAgent, isValid);
      setCurrentAgent(updatedAgent);
      
      if (isValid) {
        toast.success("API key validated successfully!");
      } else {
        toast.error("API key validation failed. Please check your credentials and try again.");
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error("Validation failed due to network error. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const isApiConfigValid = currentAgent?.apiConfig?.isValidated === true;
  const isApiValidated = currentAgent?.apiConfig?.isValidated === true;
  const IconComponent = getAgentIcon(currentAgent.icon);
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-4xl mx-auto">
        <div className="p-4">
          <DrawerHeader>
            <DrawerTitle>{agent?.id ? 'Edit Agent' : 'Create New Agent'}</DrawerTitle>
            <DrawerDescription>Configure the agent's personality, behavior, and Google API credentials.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${currentAgent.color} transition-colors`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input id="agent-name" value={currentAgent.name} onChange={(e) => updateField('name', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Avatar</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {iconEntries.map(([name, Icon]) => (
                    <Button key={name} variant={currentAgent.icon === name ? 'default' : 'outline'} size="icon" onClick={() => updateField('icon', name)}><Icon className="w-5 h-5" /></Button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {colors.map((color) => (
                    <button key={color} className={`w-8 h-8 rounded-full ${color} border-2 ${currentAgent.color === color ? 'border-primary ring-2 ring-ring' : 'border-transparent'}`} onClick={() => updateField('color', color)} />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="agent-personality">Personality</Label>
                <Textarea id="agent-personality" value={currentAgent.personality} onChange={(e) => updateField('personality', e.target.value)} rows={4} />
              </div>
              <div>
                <Label htmlFor="agent-model">Model</Label>
                <Select value={currentAgent.model} onValueChange={(value) => updateField('model', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4">
              <motion.div><Label>Formality: <span className="text-muted-foreground font-normal">{currentAgent.config.formality}%</span></Label><Slider value={[currentAgent.config.formality]} onValueChange={([v]) => updateConfig('formality', v)} step={10} /></motion.div>
              <motion.div><Label>Detail Level: <span className="text-muted-foreground font-normal">{currentAgent.config.detail}%</span></Label><Slider value={[currentAgent.config.detail]} onValueChange={([v]) => updateConfig('detail', v)} step={10} /></motion.div>
              <motion.div><Label>Approach: <span className="text-muted-foreground font-normal">{currentAgent.config.approach}%</span></Label><Slider value={[currentAgent.config.approach]} onValueChange={([v]) => updateConfig('approach', v)} step={10} /></motion.div>
              <motion.div><Label>Creativity: <span className="text-muted-foreground font-normal">{currentAgent.config.creativity}%</span></Label><Slider value={[currentAgent.config.creativity]} onValueChange={([v]) => updateConfig('creativity', v)} step={10} /></motion.div>
              <div className="flex items-center space-x-2 pt-4"><Switch id="advanced-mode" checked={isAdvanced} onCheckedChange={setIsAdvanced} /><Label htmlFor="advanced-mode">Advanced (System Prompt)</Label></div>
              {isAdvanced && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}><Label htmlFor="system-prompt">System Prompt</Label><Textarea id="system-prompt" value={currentAgent.systemPrompt || ''} onChange={(e) => updateField('systemPrompt', e.target.value)} rows={3} placeholder="e.g., You are a helpful AI assistant..." /></motion.div>}
            </div>
            <div className="md:col-span-2 border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Google API Configuration</h3>
                {!isApiValidated && (
                  <span className="text-yellow-600" title="API configuration required">
                    ⚠️
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Quick Setup</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={setGoogleApiDefaults}
                    className="mb-3"
                  >
                    Set Google AI Studio Defaults
                  </Button>
                </div>
                
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="api-base-url">Base URL</Label>
                    <Input
                      id="api-base-url"
                      value={currentAgent.apiConfig.baseURL}
                      onChange={(e) => updateApiConfig('baseURL', e.target.value)}
                      placeholder="https://generativelanguage.googleapis.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="api-endpoint">Endpoint Path</Label>
                    <Input
                      id="api-endpoint"
                      value={currentAgent.apiConfig.endpoint || ''}
                      onChange={(e) => updateApiConfig('endpoint', e.target.value)}
                      placeholder="/v1/models/{model}:generateContent"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="api-key">Google API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="api-key"
                        type="password"
                        value={currentAgent.apiConfig.apiKey}
                        onChange={(e) => {
                          updateApiConfig('apiKey', e.target.value);
                          // Reset validation when API key changes
                          updateApiConfig('isValidated', false);
                        }}
                        placeholder="AIz..."
                        className={`flex-1 ${isApiValidated ? "border-green-400" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleValidateApiKey}
                        disabled={!currentAgent.apiConfig.apiKey || !currentAgent.apiConfig.baseURL || isValidating}
                        className={`px-4 ${isApiValidated ? "border-green-400 text-green-600" : ""}`}
                      >
                        {isValidating ? "Validating..." : isApiValidated ? "✓ Validated" : "Validate"}
                      </Button>
                    </div>
                    {isApiValidated && (
                      <p className="text-sm text-green-600 mt-1">
                        ✓ API key validated successfully
                      </p>
                    )}
                    {!currentAgent.apiConfig.apiKey && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSave}>Save Agent</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}