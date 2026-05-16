import { useEffect } from 'react';
import type { RefObject } from 'react';

interface UseOutsidePointerDownOptions {
  enabled?: boolean;
  ignoredSelectors?: string[];
  onOutsidePointerDown: (event: PointerEvent) => void;
  refs: RefObject<HTMLElement | null>[];
}

export function useOutsidePointerDown({
  enabled = true,
  ignoredSelectors = [],
  onOutsidePointerDown,
  refs,
}: UseOutsidePointerDownOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const isInside = refs.some((ref) => ref.current?.contains(target));
      if (isInside) return;

      const isIgnored = ignoredSelectors.some((selector) => target.closest(selector));
      if (isIgnored) return;

      onOutsidePointerDown(event);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, ignoredSelectors, onOutsidePointerDown, refs]);
}
