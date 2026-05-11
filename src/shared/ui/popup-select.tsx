import { Check, ChevronDown } from 'lucide-react';
import { ProTooltip } from './pro-tooltip';
import { OptionPopup } from './option-popup';
import { useAnchoredPopup, type PopupAlign } from './useAnchoredPopup';
import { cn } from './utils';

export interface PopupSelectOption<Value extends string = string> {
  value: Value;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface PopupSelectProps<Value extends string = string> {
  value: Value;
  options: PopupSelectOption<Value>[];
  onChange: (value: Value) => void;
  label?: string;
  placeholder?: string;
  align?: PopupAlign;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  inlineAction?: boolean;
  showCheck?: boolean;
  disabled?: boolean;
  renderValue?: (option: PopupSelectOption<Value> | undefined) => React.ReactNode;
}

export function PopupSelect<Value extends string = string>({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select',
  align = 'start',
  triggerClassName,
  menuClassName,
  optionClassName,
  selectedOptionClassName,
  inlineAction = false,
  showCheck = false,
  disabled = false,
  renderValue,
}: PopupSelectProps<Value>) {
  const popup = useAnchoredPopup({ align, offset: 4 });
  const selected = options.find((option) => option.value === value);

  const trigger = (
    <button
      type="button"
      data-class-inline-action={inlineAction ? true : undefined}
      disabled={disabled}
      className={cn(
        'flex min-w-0 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-default disabled:opacity-60',
        triggerClassName,
      )}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        popup.toggleFromElement(event.currentTarget, { align });
      }}
    >
      <span className="min-w-0 flex-1 truncate text-left">
        {renderValue ? renderValue(selected) : selected?.label ?? placeholder}
      </span>
      {!disabled && <ChevronDown className="size-3.5 shrink-0 text-gray-400" />}
    </button>
  );

  return (
    <>
      {label ? <ProTooltip label={label}>{trigger}</ProTooltip> : trigger}
      <OptionPopup anchor={popup.anchor} onClose={popup.close} className={menuClassName}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                isSelected
                  ? cn('bg-blue-600 text-white', selectedOptionClassName)
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                option.disabled && 'cursor-not-allowed opacity-50',
                optionClassName,
              )}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                popup.close();
              }}
            >
              {option.icon && (
                <span className={cn('shrink-0', isSelected ? 'text-blue-100' : 'text-gray-500')}>
                  {option.icon}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {showCheck && isSelected && <Check className="size-3.5 shrink-0" />}
            </button>
          );
        })}
      </OptionPopup>
    </>
  );
}
