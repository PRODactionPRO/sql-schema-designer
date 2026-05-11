import { getDataTypeIcon } from './data-type-icons';
import { PopupSelect } from './popup-select';
import type { PopupAlign } from './useAnchoredPopup';
import { cn } from './utils';

interface DataTypeSelectProps {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  label?: string;
  align?: PopupAlign;
  triggerClassName?: string;
  inlineAction?: boolean;
  disabled?: boolean;
}

export function DataTypeSelect({
  value,
  options,
  onChange,
  label = 'Change type',
  align = 'end',
  triggerClassName,
  inlineAction = false,
  disabled = false,
}: DataTypeSelectProps) {
  return (
    <PopupSelect
      value={value}
      options={options.map((option) => ({
        value: option,
        label: option,
        icon: getDataTypeIcon(option),
      }))}
      onChange={onChange}
      label={label}
      align={align}
      inlineAction={inlineAction}
      disabled={disabled}
      triggerClassName={cn(
        'h-6 max-w-[116px] border-transparent px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:ring-0',
        triggerClassName,
      )}
      menuClassName="min-w-[160px] max-h-[240px]"
      renderValue={(option) => option?.label ?? value}
    />
  );
}
