import { CanvasToolbar } from '@/pages/editor/ui/CanvasToolbar';

export function WorkspaceFloatingCanvasToolbar({
  canUndo = false,
  canRedo = false,
  highlightRelations = true,
  onUndo,
  onRedo,
  onAutoLayout,
  onToggleHighlightRelations,
  onZoomToFit,
}: {
  canUndo?: boolean;
  canRedo?: boolean;
  highlightRelations?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onAutoLayout?: () => void;
  onToggleHighlightRelations?: () => void;
  onZoomToFit?: () => void;
}) {
  return (
    <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <CanvasToolbar
        canRedo={canRedo}
        canUndo={canUndo}
        highlightRelations={highlightRelations}
        onAutoLayout={onAutoLayout ?? (() => undefined)}
        onOpenDiff={() => undefined}
        onOpenValidation={() => undefined}
        onRedo={onRedo}
        onToggleHighlightRelations={onToggleHighlightRelations ?? (() => undefined)}
        onUndo={onUndo}
        onZoomToFit={onZoomToFit}
        showCodeModeButton={false}
      />
    </div>
  );
}
