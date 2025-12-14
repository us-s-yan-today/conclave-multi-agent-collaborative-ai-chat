import { useState, useEffect, useRef } from 'react';
import { Agent } from '@/lib/agents';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Hand } from 'lucide-react';

interface ObserverMessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
  onAddToChat: (agentId: string, messageId: string) => void;
  onDismiss: (agentId: string, messageId: string) => void;
}

export function ObserverMessagesDrawer({ isOpen, onClose, agent, onAddToChat, onDismiss }: ObserverMessagesDrawerProps) {
  const handleAddToChat = () => {
    if (agent && agent.pendingMessages && agent.pendingMessages.length > 0) {
      onAddToChat(agent.id, agent.pendingMessages[0].id);
      onClose();
    }
  };

  const handleDismiss = () => {
    if (agent && agent.pendingMessages && agent.pendingMessages.length > 0) {
      onDismiss(agent.id, agent.pendingMessages[0].id);
      onClose();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter: Add to chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAddToChat();
        return;
      }

      // Escape: Close drawer (already handled by Drawer component, but we can add dismiss)
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, agent, onAddToChat, onDismiss, onClose]);
  const [drawerWidth, setDrawerWidth] = useState(70); // Width as percentage of viewport
  const isDraggingRef = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const viewportWidth = window.innerWidth;
        const distanceFromRight = viewportWidth - e.clientX;
        const newWidthPercent = Math.min(Math.max((distanceFromRight / viewportWidth) * 100, 20), 95);
        setDrawerWidth(newWidthPercent);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} direction="right">
      <DrawerContent 
        ref={drawerRef}
        className="fixed top-0 bottom-0 right-0 left-auto h-screen max-h-screen w-auto rounded-none border-l mt-0"
        style={{ width: `${drawerWidth}vw` }}
      >
        {/* Rotated Handle - positioned on the left */}
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[100px] w-2 flex items-center justify-center cursor-ew-resize hover:bg-primary/50 active:bg-primary transition-colors z-50"
          onMouseDown={handleDragStart}
          title="Drag to resize"
        >
          <div className="h-[100px] w-2 rounded-full bg-muted" />
        </div>

        <div className="flex flex-col h-full ml-4">
          <div className="p-6 flex-shrink-0">
            <DrawerHeader className="p-0">
              <DrawerTitle className="flex items-center gap-2">
                <Hand className="w-5 h-5 text-amber-500" />
                {agent?.name} wants to contribute
              </DrawerTitle>
              <DrawerDescription className="flex flex-col gap-2">
                <span>Review the message and decide whether to add it to the conversation.</span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-mono">
                    ⌘↵ Add to Chat
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    Esc Close
                  </Badge>
                </div>
              </DrawerDescription>
            </DrawerHeader>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="pr-4 pb-6">
              {agent?.pendingMessages && agent.pendingMessages.length > 0 ? (
                <Card className="p-4">
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1.5">
                        <Hand className="w-3.5 h-3.5 text-amber-500" />
                        Raised hand
                      </span>
                      <span>
                        {new Date(agent.pendingMessages[0].timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {agent.pendingMessages[0].content}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 flex items-center justify-center gap-2"
                      onClick={handleAddToChat}
                    >
                      <span>Add to Chat</span>
                      <Badge variant="secondary" className="font-mono text-[10px] px-1 py-0">
                        ⌘↵
                      </Badge>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2"
                      onClick={handleDismiss}
                    >
                      <span>Dismiss</span>
                      <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                        Esc
                      </Badge>
                    </Button>
                  </div>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pending messages
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
