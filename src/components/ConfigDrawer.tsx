import { ReactNode } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footerActions?: ReactNode;
  maxWidth?: string;
}

export function ConfigDrawer({ 
  isOpen, 
  onClose, 
  title, 
  description,
  children, 
  footerActions,
  maxWidth = "max-w-4xl"
}: ConfigDrawerProps) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className={`${maxWidth} mx-auto max-h-[90vh]`}>
        <div className="p-4">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {children}
          </div>
          
          <DrawerFooter>
            {footerActions || <Button variant="outline" onClick={onClose}>Close</Button>}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}