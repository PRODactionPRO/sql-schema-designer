import { Check } from 'lucide-react';
import { ReactNode } from 'react';

import { ActionMenuContent, ActionMenuItem } from '@/shared/ui/action-menu';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';

import { SORT_OPTIONS, SortMode } from './constants';

interface SortMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortMode: SortMode;
  onChange: (mode: SortMode) => void;
  trigger: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function SortMenu({ open, onOpenChange, sortMode, onChange, trigger, align = 'end' }: SortMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <ActionMenuContent align={align} className="w-[180px] min-w-[180px]">
        {SORT_OPTIONS.map((option) => (
          <ActionMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
            {sortMode === option.value && <Check className="size-3.5 ml-auto text-blue-400" />}
          </ActionMenuItem>
        ))}
      </ActionMenuContent>
    </DropdownMenu>
  );
}
