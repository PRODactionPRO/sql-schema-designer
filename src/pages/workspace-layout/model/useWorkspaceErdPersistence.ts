import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { ProjectSemanticViewBinding } from '@/shared/types/project';
import type { Table } from '@/shared/types/schema';
import {
  moveSemanticObjectProjection,
  objectMetadata,
  updateSemanticObjectProjection,
} from './semantic-object-commands';
import type { ErdCanvasSnapshot } from './workspace-erd-canvas-utils';

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

    const baseMetadata = objectMetadata(objectBinding.metadata);
    const metadata = {
      ...baseMetadata,
      ...table,
      position: table.position,
      fields: table.fields,
    };
    updateSemanticObjectProjection({
      projectId,
      binding: objectBinding,
      name: table.name,
      description: table.description,
      domainId: table.domainId,
      metadata,
    });
  }, [projectId, semanticBinding]);

  const saveTablePosition = useCallback((tableId: string) => {
    const objectBinding = semanticBinding?.objectsByLegacyId[tableId];
    if (!semanticBinding?.viewId || !objectBinding?.viewNodeId) return;

    const position = tablePositionsRef.current.get(tableId)
      ?? tablesRef.current.find((table) => table.id === tableId)?.position;
    if (!position) return;

    moveSemanticObjectProjection({
      projectId,
      semanticBinding,
      binding: objectBinding,
      position,
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
