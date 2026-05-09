import type { Domain, Table } from '../../model/types';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import type { SidebarPendingMove } from './types';

interface ConfirmTableMoveDialogProps {
  pendingMove: SidebarPendingMove | null;
  tables: Table[];
  domains: Domain[];
  onClose: () => void;
  onConfirmMove: (move: SidebarPendingMove) => void;
}

export function ConfirmTableMoveDialog({
  pendingMove,
  tables,
  domains,
  onClose,
  onConfirmMove,
}: ConfirmTableMoveDialogProps) {
  return (
    <ConfirmDialog
      open={!!pendingMove}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Confirm Move"
      description={pendingMove && (() => {
        const table = tables.find((t) => t.id === pendingMove.tableId);
        const sourceDomain = table?.domainId ? domains.find((d) => d.id === table.domainId) : null;
        const targetDomain = pendingMove.targetDomainId ? domains.find((d) => d.id === pendingMove.targetDomainId) : null;
        const targetDomainName = targetDomain?.name ?? 'No Domain';
        const tableColor = sourceDomain?.color ?? '#6b7280';
        const targetDomainColor = targetDomain?.color ?? '#6b7280';

        return (
          <>
            Move table{' '}
            <span className="font-semibold" style={{ color: tableColor }}>
              "{table?.name ?? pendingMove.tableId}"
            </span>{' '}
            to domain{' '}
            <span className="font-semibold" style={{ color: targetDomainColor }}>
              "{targetDomainName}"
            </span>
            ?
          </>
        );
      })()}
      cancelLabel="Cancel"
      confirmLabel="Move"
      onConfirm={() => {
        if (!pendingMove) return;
        onConfirmMove(pendingMove);
      }}
    />
  );
}
