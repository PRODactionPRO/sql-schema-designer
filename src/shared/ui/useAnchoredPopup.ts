import { useCallback, useState } from 'react';

export type PopupAlign = 'start' | 'end';

export interface PopupAnchor {
  top: number;
  left: number;
  transform?: string;
}

interface OpenOptions {
  align?: PopupAlign;
  offset?: number;
}

export function useAnchoredPopup(defaultOptions: OpenOptions = {}) {
  const [anchor, setAnchor] = useState<PopupAnchor | null>(null);

  const close = useCallback(() => {
    setAnchor(null);
  }, []);

  const openFromElement = useCallback((element: HTMLElement, options: OpenOptions = {}) => {
    const align = options.align ?? defaultOptions.align ?? 'start';
    const offset = options.offset ?? defaultOptions.offset ?? 4;
    const rect = element.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + offset,
      left: align === 'end' ? rect.right : rect.left,
      transform: align === 'end' ? 'translateX(-100%)' : undefined,
    });
  }, [defaultOptions.align, defaultOptions.offset]);

  const toggleFromElement = useCallback((element: HTMLElement, options: OpenOptions = {}) => {
    setAnchor((current) => {
      if (current) return null;
      const align = options.align ?? defaultOptions.align ?? 'start';
      const offset = options.offset ?? defaultOptions.offset ?? 4;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.bottom + offset,
        left: align === 'end' ? rect.right : rect.left,
        transform: align === 'end' ? 'translateX(-100%)' : undefined,
      };
    });
  }, [defaultOptions.align, defaultOptions.offset]);

  return {
    anchor,
    isOpen: anchor !== null,
    close,
    openFromElement,
    toggleFromElement,
  };
}
