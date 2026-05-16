import { useEffect } from 'react';

export function useWorkspaceGlobalHistoryShortcuts({
  onUndo,
  onRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;
      if (isTyping) return;

      const key = event.key.toLowerCase();
      const code = event.code;
      const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && (key === 'z' || code === 'KeyZ');
      const isRedo = (event.metaKey || event.ctrlKey) && (
        (event.shiftKey && (key === 'z' || code === 'KeyZ'))
        || key === 'y'
        || code === 'KeyY'
      );
      if (isUndo) {
        event.preventDefault();
        onUndo();
      }
      if (isRedo) {
        event.preventDefault();
        onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onRedo, onUndo]);
}
