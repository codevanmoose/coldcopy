'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableAreaProps {
  id: string;
  title: string;
  dropTarget: 'coldcopy' | 'pipedrive';
  children: React.ReactNode;
}

export function DroppableArea({ id, title, dropTarget, children }: DroppableAreaProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      dropTarget,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-lg transition-all",
        isOver && "border-primary bg-primary/5 shadow-lg"
      )}
    >
      <div className="p-4 border-b bg-muted/50">
        <h4 className="font-medium flex items-center justify-between">
          {title}
          {dropTarget === 'coldcopy' && (
            <span className="text-xs text-muted-foreground">Drop Pipedrive fields here</span>
          )}
          {dropTarget === 'pipedrive' && (
            <span className="text-xs text-muted-foreground">Drop ColdCopy fields here</span>
          )}
        </h4>
      </div>
      {children}
    </div>
  );
}