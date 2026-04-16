import { useEffect } from 'react';

interface UseEditorKeyboardShortcutsOptions {
  undo: () => void;
  redo: () => void;
  codeMode: boolean;
  onToggleMaximize: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onZoomToFit?: () => void;
  onSelectAll?: () => void;
  onOpenValidation?: () => void;
  onOpenDiff?: () => void;
}

/**
 * Keyboard shortcuts:
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z / Ctrl+Y: Redo
 * - F: Toggle panels visibility
 * - 1: Zoom to fit
 * - Ctrl+S: Save
 * - Ctrl+E: Export
 * - Ctrl+Shift+I: Import
 * - Ctrl+A: Select all tables
 * - Ctrl+Shift+V: Validate schema
 * - Ctrl+Shift+D: Schema diff
 */
export function useEditorKeyboardShortcuts({
  undo,
  redo,
  codeMode,
  onToggleMaximize,
  onSave,
  onExport,
  onImport,
  onZoomToFit,
  onSelectAll,
  onOpenValidation,
  onOpenDiff,
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Check if focus is inside a CodeMirror editor
      const inCodeMirror = !!target.closest('.cm-editor');

      const isMod = e.metaKey || e.ctrlKey;

      // F key works everywhere (including code mode), except inside CodeMirror
      if (e.code === 'KeyF' && !isMod && !e.altKey && !inCodeMirror) {
        e.preventDefault();
        onToggleMaximize();
        return;
      }

      // The rest only work outside code mode
      if (codeMode) return;

      // Use e.code for layout-independent key detection (fixes Russian/non-Latin layouts)
      if (isMod && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && e.code === 'KeyZ' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (isMod && e.code === 'KeyY') {
        e.preventDefault();
        redo();
      } else if (e.code === 'Digit1' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onZoomToFit?.();
      } else if (isMod && e.code === 'KeyS') {
        e.preventDefault();
        onSave?.();
      } else if (isMod && e.code === 'KeyE' && !e.shiftKey) {
        e.preventDefault();
        onExport?.();
      } else if (isMod && e.shiftKey && e.code === 'KeyI') {
        e.preventDefault();
        onImport?.();
      } else if (isMod && e.code === 'KeyA') {
        e.preventDefault();
        onSelectAll?.();
      } else if (isMod && e.shiftKey && e.code === 'KeyV') {
        e.preventDefault();
        onOpenValidation?.();
      } else if (isMod && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        onOpenDiff?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, codeMode, onToggleMaximize, onSave, onExport, onImport, onZoomToFit, onSelectAll, onOpenValidation, onOpenDiff]);
}