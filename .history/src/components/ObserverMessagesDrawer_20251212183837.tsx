import { useState, useEffect, useRef } from 'react';
import { Agent } from '@/lib/agents';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hand } from 'lucide-react';

interface ObserverMessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
}

export function ObserverMessagesDrawer({ isOpen, onClose, agent }: ObserverMessagesDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState(70); // Width as percentage of viewport
  const isDraggingRef = useRef(false);

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
        className="fixed inset-y-0 right-0 h-full rounded-none border-l"
        style={{ width: `${drawerWidth}vw`, maxWidth: '95vw' }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 active:bg-primary transition-colors z-50"
          onMouseDown={handleDragStart}
          title="Drag to resize"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary/30 rounded-r-sm" />
        </div>

        <div className="flex flex-col h-full">
          <div className="p-6 flex-shrink-0">
            <DrawerHeader className="p-0">
              <DrawerTitle className="flex items-center gap-2">
                <Hand className="w-5 h-5 text-amber-500" />
                {agent?.name} - Raised Hand Messages
              </DrawerTitle>
              <DrawerDescription>
                This observer has messages that haven't been added to the chat yet.
              </DrawerDescription>
            </DrawerHeader>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 pr-4 pb-6">
              {agent?.pendingMessages && agent.pendingMessages.length > 0 ? (
                agent.pendingMessages.map((msg, index) => (
                  <Card key={msg.id} className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Hand className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Message #{index + 1}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        Approve to Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled
                      >
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                ))
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
