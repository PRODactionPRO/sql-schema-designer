import { createPortal } from 'react-dom';
import { cn } from './utils';
import type { PopupAnchor } from './useAnchoredPopup';

interface OptionPopupProps {
  anchor: PopupAnchor | null;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  zIndex?: number;
}

export function OptionPopup({
  anchor,
  children,
  onClose,
  className,
  zIndex = 9999,
}: OptionPopupProps) {
  if (!anchor) return null;

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: zIndex - 1 }} onClick={onClose} />
      <div
        className={cn(
          'fixed max-h-[240px] min-w-[160px] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 py-2 shadow-2xl type-dropdown-scroll',
          className,
        )}
        style={{
          zIndex,
          top: anchor.top,
          left: anchor.left,
          transform: anchor.transform,
        }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
