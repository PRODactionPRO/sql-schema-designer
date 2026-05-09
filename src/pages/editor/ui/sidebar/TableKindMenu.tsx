import { Check, ChevronDown } from 'lucide-react';

import { ActionMenuContent, ActionMenuItem } from '@/shared/ui/action-menu';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';

import type { TableKind } from './constants';

const OPTIONS: Array<{ value: TableKind; label: string }> = [
  { value: 'table', label: 'Structure Table' },
  { value: 'enum', label: 'Enum Table' },
  { value: 'json', label: 'JSON Schema' },
];

interface TableKindMenuProps {
  value: TableKind;
  onChange: (next: TableKind) => void;
}

export function TableKindMenu({ value, onChange }: TableKindMenuProps) {
  const label = OPTIONS.find((option) => option.value === value)?.label ?? 'Structure Table';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 w-[130px] flex items-center justify-between">
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 text-gray-500 ml-2" />
        </button>
      </DropdownMenuTrigger>
      <ActionMenuContent align="end" className="w-[180px] min-w-[180px]">
        {OPTIONS.map((option) => (
          <ActionMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
            {value === option.value && <Check className="size-3.5 ml-auto text-blue-400" />}
          </ActionMenuItem>
        ))}
      </ActionMenuContent>
    </DropdownMenu>
  );
}
