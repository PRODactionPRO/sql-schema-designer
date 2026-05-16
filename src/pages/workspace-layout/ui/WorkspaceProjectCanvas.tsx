import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@/pages/editor/ui/Canvas';
import { CanvasToolbar } from '@/pages/editor/ui/CanvasToolbar';
import type { ProjectData } from '@/shared/types/project';
import type { Relation, Table } from '@/shared/types/schema';
import { ALL_FIELD_TYPES, DOMAIN_COLORS, DEFAULT_PROJECT_SETTINGS } from '@/shared/types/schema';
import { deepClone } from '@/shared/lib/json';

const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const FIELD_HEIGHT = 36;

function cloneTables(tables: Table[]): Table[] {
  return deepClone(tables);
}

function cloneRelations(relations: Relation[]): Relation[] {
  return deepClone(relations);
}

function estimateTableHeight(table: Table): number {
  return HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT;
}

function getProjectDomains(project: ProjectData) {
  return project.domains.length > 0 ? project.domains : project.schema.domains;
}

export function ProjectErDiagramCanvas({ project }: { project: ProjectData }) {
  const [tables, setTables] = useState<Table[]>(() => cloneTables(project.schema.tables));
  const [relations, setRelations] = useState<Relation[]>(() => cloneRelations(project.schema.relations));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(() => new Set());
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(null);
  const [highlightRelations, setHighlightRelations] = useState(true);
  const zoomToFitRef = useRef<(() => void) | null>(null);

  const domains = useMemo(() => getProjectDomains(project), [project]);
  const domainColorById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain.color])), [domains]);
  const settings = project.settings ?? DEFAULT_PROJECT_SETTINGS;

  useEffect(() => {
    setTables(cloneTables(project.schema.tables));
    setRelations(cloneRelations(project.schema.relations));
    setSelectedTableId(null);
    setSelectedTableIds(new Set());
    setSelectedRelation(null);
  }, [project.id, project.schema.relations, project.schema.tables]);

  const getTableColor = useCallback((table: Table) => {
    if (table.domainId && domainColorById.has(table.domainId)) {
      return domainColorById.get(table.domainId)!;
    }

    if (table.color) return table.color;

    const fallbackIndex = Math.abs(table.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % DOMAIN_COLORS.length;
    return DOMAIN_COLORS[fallbackIndex] ?? '#6366f1';
  }, [domainColorById]);

  const updateTablePosition = useCallback((tableId: string, position: { x: number; y: number }) => {
    setTables((current) => current.map((table) => table.id === tableId ? { ...table, position } : table));
  }, []);

  const deleteTables = useCallback((ids: string[]) => {
    const idsSet = new Set(ids);
    setTables((current) => current.filter((table) => !idsSet.has(table.id)));
    setRelations((current) => current.filter((relation) => !idsSet.has(relation.fromTableId) && !idsSet.has(relation.toTableId)));
    setSelectedTableId((current) => current && idsSet.has(current) ? null : current);
    setSelectedTableIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const toggleTableSelection = useCallback((id: string, additive: boolean) => {
    setSelectedRelation(null);
    setSelectedTableIds((current) => {
      const next = additive ? new Set(current) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedTableId(id);
  }, []);

  const clearMultiSelection = useCallback(() => {
    setSelectedTableIds(new Set());
  }, []);

  const selectTablesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selectedIds = tables
      .filter((table) => {
        const tableRight = table.position.x + TABLE_WIDTH;
        const tableBottom = table.position.y + estimateTableHeight(table);
        return table.position.x <= rect.x + rect.w
          && tableRight >= rect.x
          && table.position.y <= rect.y + rect.h
          && tableBottom >= rect.y;
      })
      .map((table) => table.id);

    setSelectedTableIds(new Set(selectedIds));
    setSelectedTableId(selectedIds[0] ?? null);
    setSelectedRelation(null);
  }, [tables]);

  const moveSelectedTables = useCallback((dx: number, dy: number) => {
    setTables((current) => current.map((table) => (
      selectedTableIds.has(table.id)
        ? { ...table, position: { x: table.position.x + dx, y: table.position.y + dy } }
        : table
    )));
  }, [selectedTableIds]);

  const autoLayout = useCallback(() => {
    setTables((current) => current.map((table, index) => ({
      ...table,
      position: {
        x: 120 + (index % 4) * 360,
        y: 120 + Math.floor(index / 4) * 260,
      },
    })));
  }, []);

  return (
    <div className="relative size-full overflow-hidden bg-gray-50">
      <Canvas
        tables={tables}
        relations={relations}
        domains={domains}
        selectedTableId={selectedTableId}
        selectedTableIds={selectedTableIds}
        selectedRelation={selectedRelation}
        onTableSelect={(tableId) => {
          setSelectedTableId(tableId);
          setSelectedTableIds(new Set());
          setSelectedRelation(null);
        }}
        onTablePositionChange={updateTablePosition}
        onTableDelete={(tableId) => deleteTables([tableId])}
        onFieldClick={(tableId) => {
          setSelectedTableId(tableId);
          setSelectedRelation(null);
        }}
        onRelationSelect={(relation) => {
          setSelectedRelation(relation);
          setSelectedTableId(null);
          setSelectedTableIds(new Set());
        }}
        onAutoLayout={autoLayout}
        onToggleTableSelection={toggleTableSelection}
        onSelectTablesInRect={selectTablesInRect}
        onClearMultiSelection={clearMultiSelection}
        onMoveSelectedTables={moveSelectedTables}
        onDeleteTables={deleteTables}
        getTableColor={getTableColor}
        lineType={settings.lineType}
        enabledFieldTypes={settings.enabledFieldTypes ?? ALL_FIELD_TYPES}
        zoomToFitRef={zoomToFitRef}
        highlightRelations={highlightRelations}
      />
      <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
        <CanvasToolbar
          canUndo={false}
          canRedo={false}
          onAutoLayout={autoLayout}
          onZoomToFit={() => zoomToFitRef.current?.()}
          highlightRelations={highlightRelations}
          onToggleHighlightRelations={() => setHighlightRelations((current) => !current)}
          showCodeModeButton={false}
        />
      </div>
    </div>
  );
}
