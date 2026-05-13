import { Maximize2, Minimize2, Copy, Code, X, Undo2, Redo2, LayoutGrid, Eye, EyeOff, Scan, AlertTriangle, GitCompare } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ProTooltip } from '@/shared/ui/pro-tooltip';

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
  showCodeModeButton?: boolean;
}

export function CanvasToolbar({
  isMaximized, onToggleMaximize, codeMode, onToggleCodeMode,
  onUndo, onRedo, canUndo, canRedo, onAutoLayout,
  highlightRelations, onToggleHighlightRelations,
  onZoomToFit, onOpenValidation, onOpenDiff,
  showCodeModeButton = true,
}: CanvasToolbarProps) {
  return (
    <div className={`rounded-lg shadow-md px-2 py-1 flex items-center gap-1 transition-colors ${
      codeMode
        ? 'bg-[#313244] border border-[#45475a]'
        : 'bg-white border border-gray-200'
    }`}>
      {/* Undo / Redo */}
      <ProTooltip label="Undo" shortcut="Ctrl+Z">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 className="size-4" />
        </Button>
      </ProTooltip>
      <ProTooltip label="Redo" shortcut="Ctrl+Shift+Z">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 className="size-4" />
        </Button>
      </ProTooltip>
      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />

      {/* Auto-layout */}
      <ProTooltip label="Auto-layout">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onAutoLayout}
        >
          <LayoutGrid className="size-4" />
        </Button>
      </ProTooltip>

      {/* Zoom to fit */}
      <ProTooltip label="Zoom to fit" shortcut="1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onZoomToFit}
        >
          <Scan className="size-4" />
        </Button>
      </ProTooltip>

      {/* Highlight relations toggle */}
      <ProTooltip label={highlightRelations ? 'Hide relation highlights' : 'Show relation highlights'}>
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
      </ProTooltip>

      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />

      {/* Validation */}
      <ProTooltip label="Validate schema" shortcut="Ctrl+Shift+V">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onOpenValidation}
        >
          <AlertTriangle className="size-4" />
        </Button>
      </ProTooltip>

      {/* Schema diff */}
      <ProTooltip label="Schema diff & migrations" shortcut="Ctrl+Shift+D">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onOpenDiff}
        >
          <GitCompare className="size-4" />
        </Button>
      </ProTooltip>

      <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />
      <ProTooltip label={isMaximized ? 'Show panels' : 'Hide panels'} shortcut="F / ⌘\\">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
          onClick={onToggleMaximize}
        >
          {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </ProTooltip>
      <ProTooltip label="Copy schema">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${codeMode ? 'text-[#cdd6f4] hover:bg-[#45475a] hover:text-[#cdd6f4]' : ''}`}
        >
          <Copy className="size-4" />
        </Button>
      </ProTooltip>
      {showCodeModeButton ? (
        <>
          <div className={`w-px h-6 mx-1 ${codeMode ? 'bg-[#45475a]' : 'bg-gray-200'}`} />
          <ProTooltip label={codeMode ? 'Exit code mode' : 'Code mode'}>
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
          </ProTooltip>
        </>
      ) : null}
    </div>
  );
}
