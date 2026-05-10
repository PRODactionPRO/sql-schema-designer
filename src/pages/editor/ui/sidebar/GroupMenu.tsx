import { Check, ChevronDown } from 'lucide-react';

import { ActionMenuContent, ActionMenuItem } from '@/shared/ui/action-menu';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';

import { GROUP_OPTIONS, GroupMode, getGroupModeLabel } from './constants';

interface GroupMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupMode: GroupMode;
  onChange: (mode: GroupMode) => void;
}

export function GroupMenu({ open, onOpenChange, groupMode, onChange }: GroupMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="h-7 min-w-[122px] rounded-full bg-gray-100 hover:bg-gray-200 transition-colors px-2.5 text-xs text-gray-600 flex items-center justify-between">
          <span className="truncate">Group: {getGroupModeLabel(groupMode)}</span>
          <ChevronDown className="size-3 text-gray-500 ml-1 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <ActionMenuContent align="start" className="w-[180px] min-w-[180px]">
        {GROUP_OPTIONS.map((option) => (
          <ActionMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
            {groupMode === option.value && <Check className="size-3.5 ml-auto text-blue-400" />}
          </ActionMenuItem>
        ))}
      </ActionMenuContent>
    </DropdownMenu>
  );
}
