import { useCallback } from 'react';
import type { RefObject } from 'react';
import { updateSemanticObjectMetadata, updateSemanticViewNodePosition } from '@/shared/api/semantic-model';
import type { ProjectSemanticViewBinding } from '@/shared/types/project';
import type { Table } from '@/shared/types/schema';
import type { ErdCanvasSnapshot } from './workspace-erd-canvas-utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function useWorkspaceErdPersistence({
  projectId,
  semanticBinding,
  tablesRef,
  tablePositionsRef,
}: {
  projectId: string;
  semanticBinding?: ProjectSemanticViewBinding;
  tablesRef: RefObject<Table[]>;
  tablePositionsRef: RefObject<Map<string, { x: number; y: number }>>;
}) {
  const saveTableMetadata = useCallback((table: Table) => {
    const objectBinding = semanticBinding?.objectsByLegacyId[table.id];
    if (!objectBinding) return;

    const baseMetadata = isRecord(objectBinding.metadata) ? objectBinding.metadata : {};
    void updateSemanticObjectMetadata(projectId, objectBinding.objectId, {
      ...baseMetadata,
      ...table,
      position: table.position,
      fields: table.fields,
    }).catch((error) => {
      console.error('[workspace] Failed to save table metadata', error);
    });
  }, [projectId, semanticBinding]);

  const saveTablePosition = useCallback((tableId: string) => {
    const objectBinding = semanticBinding?.objectsByLegacyId[tableId];
    if (!semanticBinding?.viewId || !objectBinding?.viewNodeId) return;

    const position = tablePositionsRef.current.get(tableId)
      ?? tablesRef.current.find((table) => table.id === tableId)?.position;
    if (!position) return;

    void updateSemanticViewNodePosition(
      projectId,
      semanticBinding.viewId,
      objectBinding.viewNodeId,
      position,
    ).catch((error) => {
      console.error('[workspace] Failed to save table position', error);
    });
  }, [projectId, semanticBinding, tablePositionsRef, tablesRef]);

  const saveTablePositions = useCallback((tableIds: string[]) => {
    tableIds.forEach((tableId) => saveTablePosition(tableId));
  }, [saveTablePosition]);

  const persistSnapshot = useCallback((snapshot: ErdCanvasSnapshot) => {
    snapshot.tables.forEach((table) => {
      tablePositionsRef.current.set(table.id, table.position);
      saveTablePosition(table.id);
      saveTableMetadata(table);
    });
  }, [saveTableMetadata, saveTablePosition, tablePositionsRef]);

  return {
    persistSnapshot,
    saveTableMetadata,
    saveTablePosition,
    saveTablePositions,
  };
}
