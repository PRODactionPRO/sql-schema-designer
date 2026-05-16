import { useCallback, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { createSemanticModelObject, deleteSemanticModelObject } from '@/shared/api/semantic-model';
import type { ProjectData } from '@/shared/types/project';
import type { Table } from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import { useWorkspaceCatalogOrdering } from '../model/useWorkspaceCatalogOrdering';
import type { WorkspaceCatalogSortMode } from '../model/useWorkspaceCatalogOrdering';
import {
  getObjectBinding,
  getProjectDomains,
  nextWorkspaceId,
  saveObjectMetadata,
  updateProjectBinding,
  withSchema,
} from '../model/workspace-project-utils';
import { WorkspaceCatalogGroupHeader } from './WorkspaceCatalogGroupHeader';
import { WorkspaceCatalogPaneHeader } from './WorkspaceCatalogPaneHeader';
import { WorkspaceCatalogEmptyState } from './WorkspaceCatalogEmptyState';
import { WorkspaceTableCatalogRow } from './WorkspaceTableCatalogRow';

interface TableGroup {
  id: string;
  label: string;
  color: string;
  domainId: string | null;
  tables: Table[];
}

export function WorkspaceTablesPane({
  project,
  selection,
  onProjectChange,
  onSelectionChange,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<WorkspaceCatalogSortMode>('manual');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);

  const domains = useMemo(() => (project ? getProjectDomains(project) : []), [project]);
  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);

  const commitTables = useCallback((tables: Table[]) => {
    if (!project) return;

    const nextTables = tables.map((table, index) => ({ ...table, sidebarOrder: index }));
    const nextProject = withSchema(project, { ...project.schema, tables: nextTables });
    onProjectChange(nextProject);
    nextTables.forEach((table) => saveObjectMetadata(project, table.id, table));
  }, [onProjectChange, project]);

  const {
    canPreviewReorder: canPreviewTableReorder,
    dnd: tableDnd,
    dndIndexById,
    filteredItems: filteredTables,
    itemById: tableById,
  } = useWorkspaceCatalogOrdering({
    items: project?.schema.tables ?? [],
    query,
    sortMode,
    enabled: Boolean(project),
    onCommitReorder: commitTables,
  });

  const groups = useMemo<TableGroup[]>(() => {
    const groupedDomains = domains.map((domain) => ({
      id: domain.id,
      label: domain.name,
      color: domain.color,
      domainId: domain.id,
      tables: filteredTables.filter((table) => table.domainId === domain.id),
    }));
    const noDomainTables = filteredTables.filter((table) => !table.domainId || !domainById.has(table.domainId));
    return [
      ...groupedDomains,
      {
        id: '__no_domain__',
        label: 'No Domain',
        color: '#cbd5e1',
        domainId: null,
        tables: noDomainTables,
      },
    ].filter((group) => group.tables.length > 0 || !query.trim());
  }, [domainById, domains, filteredTables, query]);

  const collapsibleGroupIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const areAllGroupsCollapsed = collapsibleGroupIds.length > 0 && collapsibleGroupIds.every((id) => collapsedGroupIds.has(id));

  if (!project) {
    return <WorkspaceCatalogEmptyState>Tables will appear after loading</WorkspaceCatalogEmptyState>;
  }

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    let updatedTable: Table | null = null;
    const nextTables = project.schema.tables.map((table) => {
      if (table.id !== tableId) return table;
      updatedTable = { ...table, ...updates };
      return updatedTable;
    });
    onProjectChange(withSchema(project, { ...project.schema, tables: nextTables }));
    if (updatedTable) saveObjectMetadata(project, tableId, updatedTable);
  };

  const addTable = () => {
    const table: Table = {
      id: nextWorkspaceId('table'),
      name: `Table${project.schema.tables.length + 1}`,
      fields: [],
      position: { x: 160 + project.schema.tables.length * 28, y: 140 + project.schema.tables.length * 28 },
      color: '#64748b',
      sidebarOrder: project.schema.tables.length,
    };
    const nextProject = withSchema(project, { ...project.schema, tables: [...project.schema.tables, table] });
    onProjectChange(nextProject);

    void createSemanticModelObject(project.id, {
      type: 'table',
      name: table.name,
      metadata: { ...table },
    }).then((object) => {
      onProjectChange(updateProjectBinding(nextProject, table.id, object.id, table));
    }).catch((error) => {
      console.error('[workspace] Failed to create table object', error);
    });
  };

  const deleteTable = (tableId: string) => {
    onSelectionChange(selection?.id === tableId || selection?.parentId === tableId ? null : selection);
    onProjectChange(withSchema(project, {
      ...project.schema,
      tables: project.schema.tables.filter((table) => table.id !== tableId),
      relations: project.schema.relations.filter((relation) => relation.fromTableId !== tableId && relation.toTableId !== tableId),
    }));

    const binding = getObjectBinding(project, tableId);
    if (binding) {
      void deleteSemanticModelObject(project.id, binding.objectId).catch((error) => {
        console.error('[workspace] Failed to delete table object', error);
      });
    }
  };

  const moveTable = (tableId: string, targetDomainId: string | null, targetTableId?: string, insertAfter = false) => {
    const ordered = [...project.schema.tables].sort((a, b) => {
      const orderDiff = (a.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - (b.sidebarOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
    const dragged = ordered.find((table) => table.id === tableId);
    if (!dragged) return;

    const nextDragged = { ...dragged, domainId: targetDomainId ?? undefined };
    const withoutDragged = ordered.filter((table) => table.id !== tableId);
    let targetIndex = withoutDragged.length;

    if (targetTableId) {
      const rowIndex = withoutDragged.findIndex((table) => table.id === targetTableId);
      if (rowIndex >= 0) targetIndex = rowIndex + (insertAfter ? 1 : 0);
    } else {
      targetIndex = withoutDragged.reduce((lastIndex, table, index) => (
        (table.domainId ?? null) === targetDomainId ? index + 1 : lastIndex
      ), withoutDragged.length);
    }

    const nextTables = [...withoutDragged];
    nextTables.splice(targetIndex, 0, nextDragged);
    commitTables(nextTables);
  };

  const handleDropOnRow = (event: DragEvent<HTMLElement>, target: Table) => {
    event.preventDefault();
    const sourceId = draggingTableId || event.dataTransfer.getData('text/table-id');
    if (!sourceId || sourceId === target.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    moveTable(sourceId, target.domainId ?? null, target.id, event.clientY > rect.top + rect.height / 2);
    setDraggingTableId(null);
    setDropGroupId(null);
  };

  const handleDropOnGroup = (event: DragEvent<HTMLElement>, group: TableGroup) => {
    event.preventDefault();
    const sourceId = draggingTableId || event.dataTransfer.getData('text/table-id');
    if (!sourceId) return;
    moveTable(sourceId, group.domainId);
    setDraggingTableId(null);
    setDropGroupId(null);
  };

  const cycleSortMode = () => {
    setSortMode((current) => current === 'manual' ? 'asc' : current === 'asc' ? 'desc' : 'manual');
  };

  return (
    <div className="flex h-full flex-col bg-white/95">
      <WorkspaceCatalogPaneHeader
        title="Tables"
        addLabel="Add table"
        searchPlaceholder="Search tables..."
        query={query}
        sortMode={sortMode}
        areAllGroupsCollapsed={areAllGroupsCollapsed}
        collapseDisabled={collapsibleGroupIds.length === 0}
        onAdd={addTable}
        onQueryChange={setQuery}
        onCycleSortMode={cycleSortMode}
        onToggleGroupsCollapsed={() => setCollapsedGroupIds(areAllGroupsCollapsed ? new Set() : new Set(collapsibleGroupIds))}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {groups.map((group) => {
          const collapsed = collapsedGroupIds.has(group.id);
          return (
            <div key={group.id}>
              <WorkspaceCatalogGroupHeader
                label={group.label}
                color={group.color}
                count={group.tables.length}
                collapsed={collapsed}
                active={dropGroupId === group.id}
                onToggle={() => setCollapsedGroupIds((current) => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                })}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropGroupId(group.id);
                }}
                onDragLeave={() => setDropGroupId(null)}
                onDrop={(event) => {
                  handleDropOnGroup(event, group);
                  tableDnd.handleDragEnd();
                }}
              />
              {collapsed ? null : group.tables.map((table) => {
                const domain = table.domainId ? domainById.get(table.domainId) : null;
                return (
                  <WorkspaceTableCatalogRow
                    key={table.id}
                    table={table}
                    domainColor={domain?.color}
                    selection={selection}
                    dnd={tableDnd}
                    dndIndexById={dndIndexById}
                    canPreviewReorder={canPreviewTableReorder}
                    draggingTableId={draggingTableId}
                    tableById={tableById}
                    onDelete={deleteTable}
                    onDropOnRow={handleDropOnRow}
                    onSelect={(tableId) => onSelectionChange({ kind: 'table', id: tableId, sourceView: 'model' })}
                    onSetDraggingTableId={setDraggingTableId}
                    onSetDropGroupId={setDropGroupId}
                    onUnlink={(tableId) => updateTable(tableId, { domainId: undefined })}
                  />
                );
              })}
            </div>
          );
        })}
        {filteredTables.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-400">No tables found</div>
        ) : null}
      </div>
    </div>
  );
}
