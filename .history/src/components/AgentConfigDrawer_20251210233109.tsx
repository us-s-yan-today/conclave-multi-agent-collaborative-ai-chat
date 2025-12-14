import { Agent, agentIcons, getAgentIcon, loadAgentTemplate, TEMPLATE_PRESETS, validateApiConfig, validateApiKey, markApiConfigValidated } from '@/lib/agents';
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
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X } from 'lucide-react';
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

  const handleProviderTypeChange = (providerType: 'openai' | 'gemini' | 'anthropic') => {
    // Set defaults based on provider type
    const defaults = {
      openai: {
        type: 'openai' as const,
        baseURL: 'https://api.openai.com',
        endpoint: '/v1/chat/completions',
        apiKey: '',
        isValidated: false
      },
      gemini: {
        type: 'gemini' as const,
        baseURL: 'https://generativelanguage.googleapis.com',
        endpoint: '/v1/models/{model}:generateContent',
        apiKey: '',
        isValidated: false
      },
      anthropic: {
        type: 'anthropic' as const,
        baseURL: 'https://api.anthropic.com',
        endpoint: '/v1/messages',
        apiKey: '',
        isValidated: false
      }
    };

    setCurrentAgent(produce(draft => {
      if (draft) {
        draft.apiConfig = { ...draft.apiConfig, ...defaults[providerType] };
      }
    }));
  };

  const getModelsByProvider = (providerType: string) => {
    switch (providerType) {
      case 'openai':
        return MODELS.filter(m => m.id.includes('gpt') || m.id.includes('o1'));
      case 'gemini':
        return MODELS.filter(m => m.id.includes('gemini'));
      case 'anthropic':
        return MODELS.filter(m => m.id.includes('claude'));
      default:
        return MODELS;
    }
  };

  const getValidationDefaults = (providerType: string) => {
    switch (providerType) {
      case 'openai':
        return {
          baseURL: 'https://api.openai.com',
          endpoint: '/v1/chat/completions'
        };
      case 'gemini':
        return {
          baseURL: 'https://generativelanguage.googleapis.com',
          endpoint: '/v1/models/{model}:generateContent'
        };
      case 'anthropic':
        return {
          baseURL: 'https://api.anthropic.com',
          endpoint: '/v1/messages'
        };
      default:
        return {
          baseURL: '',
          endpoint: ''
        };
    }
  };

  const handleValidateApiKey = async () => {
    if (!currentAgent?.apiConfig) return;
    
    setIsValidating(true);
    try {
      // Use default values if not provided based on provider type
      const defaults = getValidationDefaults(currentAgent.apiConfig.type);
      
      const configToValidate = {
        ...currentAgent.apiConfig,
        baseURL: currentAgent.apiConfig.baseURL || defaults.baseURL,
        endpoint: currentAgent.apiConfig.endpoint || defaults.endpoint
      };
      
      const isValid = await validateApiKey(configToValidate);
      
      // Update agent with defaults if validation successful and values were empty
      const updatedAgent = {
        ...currentAgent,
        apiConfig: {
          ...currentAgent.apiConfig,
          baseURL: currentAgent.apiConfig.baseURL || defaults.baseURL,
          endpoint: currentAgent.apiConfig.endpoint || defaults.endpoint,
          isValidated: isValid,
          lastValidated: isValid ? Date.now() : undefined
        }
      };
      
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={onClose}
          />
          
          {/* Drawer Content */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              duration: 0.3
            }}
            className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background max-w-4xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold leading-none tracking-tight">
                    {agent?.id ? 'Edit Agent' : 'Create New Agent'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure the agent's personality, behavior, and API credentials.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
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
                <h3 className="text-lg font-semibold">API Configuration</h3>
                {!isApiValidated && (
                  <span className="text-yellow-600" title="API configuration required">
                    ⚠️
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                {/* Provider Type Selection */}
                <div>
                  <Label htmlFor="provider-type">Provider Type</Label>
                  <Select
                    value={currentAgent.apiConfig.type}
                    onValueChange={(value: 'openai' | 'gemini' | 'anthropic') => handleProviderTypeChange(value)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* API Configuration Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="api-base-url">Base URL</Label>
                    <Input
                      id="api-base-url"
                      value={currentAgent.apiConfig.baseURL}
                      onChange={(e) => updateApiConfig('baseURL', e.target.value)}
                      placeholder={getValidationDefaults(currentAgent.apiConfig.type).baseURL}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="api-endpoint">Endpoint Path</Label>
                    <Input
                      id="api-endpoint"
                      value={currentAgent.apiConfig.endpoint || ''}
                      onChange={(e) => updateApiConfig('endpoint', e.target.value)}
                      placeholder={getValidationDefaults(currentAgent.apiConfig.type).endpoint}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="api-key">API Key</Label>
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
                      placeholder={
                        currentAgent.apiConfig.type === 'openai' ? 'sk-...' :
                        currentAgent.apiConfig.type === 'gemini' ? 'AIz...' :
                        currentAgent.apiConfig.type === 'anthropic' ? 'sk-ant-...' : ''
                      }
                      className={`flex-1 ${isApiValidated ? "border-green-400" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleValidateApiKey}
                      disabled={!currentAgent.apiConfig.apiKey?.trim() || isValidating}
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
                      {currentAgent.apiConfig.type === 'openai' && (
                        <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Platform</a></>
                      )}
                      {currentAgent.apiConfig.type === 'gemini' && (
                        <>Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a></>
                      )}
                      {currentAgent.apiConfig.type === 'anthropic' && (
                        <>Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Anthropic Console</a></>
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="agent-model">Model</Label>
                  <Select value={currentAgent.model} onValueChange={(value) => updateField('model', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getModelsByProvider(currentAgent.apiConfig.type).map(m =>
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
              </div>
              <div className="mt-auto flex flex-col gap-2 p-4">
                <Button onClick={handleSave}>Save Agent</Button>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}