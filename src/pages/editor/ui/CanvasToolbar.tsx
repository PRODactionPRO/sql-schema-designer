import { useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Copy, Code, X, Undo2, Redo2, LayoutGrid, Eye, EyeOff, Scan, AlertTriangle, GitCompare } from 'lucide-react';
import { Button } from '@/shared/ui/button';

// Tooltip with 500ms delay
function BarTip({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => setShow(true), 500);
  }, []);
  const handleLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShow(false);
  }, []);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none z-50 shadow-lg flex items-center gap-2">
          <span>{label}</span>
          {shortcut && <kbd className="text-[10px] text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">{shortcut}</kbd>}
        </div>
      )}
    </div>
  );
}

interface CanvasToolbarProps {
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  codeMode?: boolean;
  onToggleCodeMode?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onAutoLayout?: () => void;
  highlightRelations?: boolean;
  onToggleHighlightRelations?: () => void;
  onZoomToFit?: () => void;
  onOpenValidation?: () => void;
  onOpenDiff?: () => void;
}

export function CanvasToolbar({
  isMaximized, onToggleMaximize, codeMode, onToggleCodeMode,
  onUndo, onRedo, canUndo, canRedo, onAutoLayout,
  highlightRelations, onToggleHighlightRelations,
  onZoomToFit, onOpenValidation, onOpenDiff,
}: CanvasToolbarProps) {
  return (
    <div className={`rounded-lg shadow-md px-2 py-1 flex items-center gap-1 transition-colors ${
      codeMode
        ? 'bg-[#313244] border border-[#45475a]'
        : 'bg-white border border-gray-200'
    }`}>
      {/* Undo / Redo */}
      <BarTip label="Undo" shortcut="Ctrl+Z">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 className="size-4" />
        </Button>
      </BarTip>
      <BarTip label="Redo" shortcut="Ctrl+Shift+Z">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 className="size-4" />
        </Button>
      </BarTip>
      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />

      {/* Auto-layout */}
      <BarTip label="Auto-layout" shortcut="">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onAutoLayout}
        >
          <LayoutGrid className="size-4" />
        </Button>
      </BarTip>

      {/* Zoom to fit */}
      <BarTip label="Zoom to fit" shortcut="1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onZoomToFit}
        >
          <Scan className="size-4" />
        </Button>
      </BarTip>

      {/* Highlight relations toggle */}
      <BarTip label={highlightRelations ? 'Hide relation highlights' : 'Show relation highlights'}>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${
            highlightRelations
              ? (codeMode ? 'text-[#89b4fa] bg-[#45475a]' : 'text-blue-600 bg-blue-50')
              : (codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : '')
          }`}
          onClick={onToggleHighlightRelations}
        >
          {highlightRelations ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
      </BarTip>

      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />

      {/* Validation */}
      <BarTip label="Validate schema" shortcut="Ctrl+Shift+V">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onOpenValidation}
        >
          <AlertTriangle className="size-4" />
        </Button>
      </BarTip>

      {/* Schema diff */}
      <BarTip label="Schema diff & migrations" shortcut="Ctrl+Shift+D">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onOpenDiff}
        >
          <GitCompare className="size-4" />
        </Button>
      </BarTip>

      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />
      <BarTip label={isMaximized ? 'Show panels' : 'Hide panels'} shortcut="F">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onToggleMaximize}
        >
          {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </BarTip>
      <BarTip label="Copy schema">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
        >
          <Copy className="size-4" />
        </Button>
      </BarTip>
      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />
      <BarTip label={codeMode ? 'Exit code mode' : 'Code mode'}>
        <Button
          size="sm"
          onClick={onToggleCodeMode}
          className={`h-8 gap-1.5 px-3 text-xs transition-all ${
            codeMode
              ? 'bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#eba0ac]'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          style={{ fontFamily: codeMode ? '"JetBrains Mono", monospace' : undefined, fontWeight: 600 }}
        >
          {codeMode ? <X className="size-3.5" /> : <Code className="size-3.5" />}
          {codeMode ? 'Exit Code' : 'Code Mode'}
        </Button>
      </BarTip>
    </div>
  );
}
