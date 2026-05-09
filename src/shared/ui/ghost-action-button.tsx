import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './utils';

type GhostActionButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl';
type GhostActionButtonTone = 'muted' | 'neutral' | 'strong';

const sizeClassByVariant: Record<GhostActionButtonSize, string> = {
  xs: 'size-[22px]',
  s: 'size-7',
  m: 'size-8',
  l: 'size-10',
  xl: 'size-12',
};

const iconSizeByVariant: Record<GhostActionButtonSize, string> = {
  xs: 'size-3',
  s: 'size-3.5',
  m: 'size-4',
  l: 'size-5',
  xl: 'size-6',
};

const toneClassByVariant: Record<GhostActionButtonTone, string> = {
  muted: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  neutral: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  strong: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
};

interface GhostActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  Icon: LucideIcon;
  size?: GhostActionButtonSize;
  tone?: GhostActionButtonTone;
  active?: boolean;
  iconClassName?: string;
}

export const GhostActionButton = React.forwardRef<HTMLButtonElement, GhostActionButtonProps>(
  ({
    Icon,
    size = 's',
    tone = 'muted',
    active = false,
    className,
    iconClassName,
    disabled,
    type = 'button',
    ...props
  }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-0 transition-colors',
        sizeClassByVariant[size],
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active
            ? 'bg-gray-100 text-gray-700'
            : toneClassByVariant[tone],
        className,
      )}
      {...props}
    >
      <Icon className={cn(iconSizeByVariant[size], iconClassName)} />
    </button>
  ),
);

GhostActionButton.displayName = 'GhostActionButton';
