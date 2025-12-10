import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { chatService } from '@/lib/chat';
import type { Message } from '../../worker/types';
import { Clipboard, Link as LinkIcon } from 'lucide-react';
interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
}
type ExportFormat = 'json' | 'text' | 'markdown';
export function ExportModal({ open, onOpenChange, messages }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportFormat>('markdown');
  const [exportContent, setExportContent] = useState('');
  useEffect(() => {
    if (open) {
      chatService.exportConversation(messages, activeTab)
        .then(setExportContent)
        .catch(() => setExportContent('Error generating export.'));
    }
  }, [open, activeTab, messages]);
  const handleCopy = () => {
    navigator.clipboard.writeText(exportContent)
      .then(() => toast.success('Copied to clipboard!'))
      .catch(() => toast.error('Failed to copy.'));
  };
  const handleCopyLink = () => {
    const params = new URLSearchParams({ session: chatService.getSessionId(), mode: 'read-only' });
    const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Read-only share link copied!'))
      .catch(() => toast.error('Failed to copy link.'));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <DialogHeader>
            <DialogTitle>Export & Share Conversation</DialogTitle>
            <DialogDescription>
              Export your conversation in various formats or share a read-only link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ExportFormat)}>
              <TabsList>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
                <TabsTrigger value="text">Raw Text</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-sm whitespace-pre-wrap break-words">
                    <code>{exportContent}</code>
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="outline" onClick={handleCopyLink}>
              <LinkIcon className="w-4 h-4 mr-2" />
              Copy Read-Only Link
            </Button>
            <Button onClick={handleCopy}>
              <Clipboard className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}