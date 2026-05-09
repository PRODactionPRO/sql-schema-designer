import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmVariant?: 'default' | 'destructive';
  darkMode?: boolean;
  maxWidthClassName?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  confirmVariant = 'default',
  darkMode = false,
  maxWidthClassName = 'max-w-sm',
}: ConfirmDialogProps) {
  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className={`rounded-xl shadow-2xl p-6 mx-4 w-full ${maxWidthClassName} ${
          darkMode ? 'bg-[#1e1e2e] text-[#cdd6f4]' : 'bg-white'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className={`mb-2 font-semibold ${darkMode ? 'text-[#cdd6f4]' : 'text-gray-900'}`}>{title}</h3>
        {description && (
          <div className={`text-sm mb-4 ${darkMode ? 'text-[#a6adc8]' : 'text-gray-600'}`}>
            {description}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
