import { Agent, agentIcons, getAgentIcon } from '@/lib/agents';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODELS } from '@/lib/chat';
import { useState, useEffect } from 'react';
import { produce } from 'immer';
interface AgentConfigDrawerProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}
const iconEntries = Object.entries(agentIcons);
const colors = ['bg-indigo-500', 'bg-green-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-purple-500'];
export function AgentConfigDrawer({ agent, isOpen, onClose, onSave }: AgentConfigDrawerProps) {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(agent);
  useEffect(() => {
    setCurrentAgent(agent);
  }, [agent]);
  if (!isOpen || !currentAgent) return null;
  const handleSave = () => {
    if (currentAgent) {
      onSave(currentAgent);
      onClose();
    }
  };
  const updateField = <K extends keyof Agent>(field: K, value: Agent[K]) => {
    setCurrentAgent(produce(draft => {
      if (draft) {
        draft[field] = value;
      }
    }));
  };
  const updateConfig = <K extends keyof Agent['config']>(field: K, value: Agent['config'][K]) => {
    setCurrentAgent(produce(draft => {
      if (draft) {
        draft.config[field] = value;
      }
    }));
  };
  const IconComponent = getAgentIcon(currentAgent.icon);
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="p-4">
          <DrawerHeader>
            <DrawerTitle>{agent?.id ? 'Edit Agent' : 'Create New Agent'}</DrawerTitle>
            <DrawerDescription>Configure the agent's personality, behavior, and model.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${currentAgent.color}`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input id="agent-name" value={currentAgent.name} onChange={(e) => updateField('name', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Avatar</Label>
                <div className="flex gap-2 mt-2">
                  {iconEntries.map(([name, Icon]) => (
                    <Button key={name} variant={currentAgent.icon === name ? 'default' : 'outline'} size="icon" onClick={() => updateField('icon', name)}>
                      <Icon className="w-5 h-5" />
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {colors.map((color) => (
                    <button key={color} className={`w-8 h-8 rounded-full ${color} border-2 ${currentAgent.color === color ? 'border-primary' : 'border-transparent'}`} onClick={() => updateField('color', color)} />
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
                  <SelectContent>
                    {MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Formality: <span className="text-muted-foreground font-normal">{currentAgent.config.formality}%</span></Label>
                <Slider value={[currentAgent.config.formality]} onValueChange={([v]) => updateConfig('formality', v)} step={10} />
              </div>
              <div>
                <Label>Detail Level: <span className="text-muted-foreground font-normal">{currentAgent.config.detail}%</span></Label>
                <Slider value={[currentAgent.config.detail]} onValueChange={([v]) => updateConfig('detail', v)} step={10} />
              </div>
              <div>
                <Label>Approach: <span className="text-muted-foreground font-normal">{currentAgent.config.approach}%</span></Label>
                <Slider value={[currentAgent.config.approach]} onValueChange={([v]) => updateConfig('approach', v)} step={10} />
              </div>
              <div>
                <Label>Creativity: <span className="text-muted-foreground font-normal">{currentAgent.config.creativity}%</span></Label>
                <Slider value={[currentAgent.config.creativity]} onValueChange={([v]) => updateConfig('creativity', v)} step={10} />
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