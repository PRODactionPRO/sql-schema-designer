import { useCallback, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { ClassEntity, ClassEntityKind, ProjectData } from '@/shared/types/project';
import type { Domain } from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import { useWorkspaceCatalogOrdering } from '../model/useWorkspaceCatalogOrdering';
import type { WorkspaceCatalogSortMode } from '../model/useWorkspaceCatalogOrdering';
import { ENTITY_KIND_META } from '../model/entity-kind-meta';
import {
  createSemanticObjectProjection,
  deleteSemanticObjectProjection,
} from '../model/semantic-object-commands';
import {
  getClassDiagramDocument,
  getObjectBinding,
  getProjectDomains,
  nextWorkspaceId,
  saveObjectMetadata,
  updateProjectBinding,
  withClassDiagram,
} from '../model/workspace-project-utils';
import { WorkspaceCatalogGroupHeader } from './WorkspaceCatalogGroupHeader';
import { WorkspaceCatalogPaneHeader } from './WorkspaceCatalogPaneHeader';
import { WorkspaceCatalogEmptyState } from './WorkspaceCatalogEmptyState';
import { WorkspaceEntityCatalogRow } from './WorkspaceEntityCatalogRow';

interface EntityGroup {
  id: string;
  label: string;
  color: string;
  domainId: string | null;
  entities: ClassEntity[];
}

export function WorkspaceEntitiesPane({
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
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);

  const document = getClassDiagramDocument(project);
  const diagram = document?.classDiagram;
  const domains = useMemo<Domain[]>(() => {
    if (!project) return [];
    if (diagram?.domains.length) return diagram.domains;
    return getProjectDomains(project);
  }, [diagram?.domains, project]);
  const domainById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain])), [domains]);

  const commitEntities = useCallback((entities: ClassEntity[]) => {
    if (!project || !diagram) return;

    const nextEntities = entities.map((entity, index) => ({ ...entity, sidebarOrder: index }));
    const nextProject = withClassDiagram(project, {
      ...diagram,
      domains,
      classes: nextEntities,
    });
    onProjectChange(nextProject);
    nextEntities.forEach((entity) => saveObjectMetadata(project, entity.id, entity));
  }, [diagram, domains, onProjectChange, project]);

  const {
    canPreviewReorder: canPreviewEntityReorder,
    dnd: entityDnd,
    dndIndexById,
    filteredItems: filteredEntities,
    itemById: entityById,
  } = useWorkspaceCatalogOrdering({
    items: diagram?.classes ?? [],
    query,
    sortMode,
    enabled: Boolean(project && diagram),
    onCommitReorder: commitEntities,
  });

  const groups = useMemo<EntityGroup[]>(() => {
    const domainGroups = domains.map((domain) => ({
      id: domain.id,
      label: domain.name,
      color: domain.color,
      domainId: domain.id,
      entities: filteredEntities.filter((entity) => entity.domainId === domain.id),
    }));
    const noDomainEntities = filteredEntities.filter((entity) => !entity.domainId || !domainById.has(entity.domainId));
    return [
      ...domainGroups,
      {
        id: '__no_domain__',
        label: 'No Domain',
        color: '#cbd5e1',
        domainId: null,
        entities: noDomainEntities,
      },
    ].filter((group) => group.entities.length > 0 || !query.trim());
  }, [domainById, domains, filteredEntities, query]);

  const collapsibleGroupIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const areAllGroupsCollapsed = collapsibleGroupIds.length > 0 && collapsibleGroupIds.every((id) => collapsedGroupIds.has(id));

  if (!project) {
    return <WorkspaceCatalogEmptyState>Entities will appear after loading</WorkspaceCatalogEmptyState>;
  }

  if (!diagram) {
    return <WorkspaceCatalogEmptyState>Class diagram is not available yet</WorkspaceCatalogEmptyState>;
  }

  const updateEntity = (entityId: string, updates: Partial<ClassEntity>) => {
    let updatedEntity: ClassEntity | null = null;
    const nextEntities = diagram.classes.map((entity) => {
      if (entity.id !== entityId) return entity;
      updatedEntity = { ...entity, ...updates };
      return updatedEntity;
    });
    onProjectChange(withClassDiagram(project, { ...diagram, domains, classes: nextEntities }));
    if (updatedEntity) saveObjectMetadata(project, entityId, updatedEntity);
  };

  const addEntity = (kind: ClassEntityKind = 'class') => {
    const meta = ENTITY_KIND_META[kind];
    const entity: ClassEntity = {
      id: nextWorkspaceId('class'),
      name: `Entity${diagram.classes.length + 1}`,
      kind,
      attributes: [],
      methods: [],
      position: { x: 220 + diagram.classes.length * 32, y: 160 + diagram.classes.length * 32 },
      color: meta.color,
      sidebarOrder: diagram.classes.length,
    };
    const nextProject = withClassDiagram(project, {
      ...diagram,
      domains,
      classes: [...diagram.classes, entity],
    });
    onProjectChange(nextProject);

    void createSemanticObjectProjection({
      projectId: project.id,
      viewId: project.semantic?.classDiagram?.viewId,
      type: 'entity',
      name: entity.name,
      description: entity.description,
      domainId: entity.domainId,
      metadata: { ...entity },
      position: entity.position,
    }).then((binding) => {
      onProjectChange(updateProjectBinding(nextProject, entity.id, binding.objectId, binding.metadata, binding.viewNodeId));
    }).catch((error) => {
      console.error('[workspace] Failed to create entity object', error);
    });
  };

  const deleteEntity = (entityId: string) => {
    onSelectionChange(selection?.id === entityId || selection?.parentId === entityId ? null : selection);
    onProjectChange(withClassDiagram(project, {
      ...diagram,
      domains,
      classes: diagram.classes.filter((entity) => entity.id !== entityId),
      relations: diagram.relations.filter((relation) => relation.fromClassId !== entityId && relation.toClassId !== entityId),
    }));

    const binding = getObjectBinding(project, entityId);
    if (binding) {
      deleteSemanticObjectProjection({
        projectId: project.id,
        semanticBinding: project.semantic?.classDiagram,
        binding,
      });
    }
  };

  const moveEntity = (entityId: string, targetDomainId: string | null, targetEntityId?: string, insertAfter = false) => {
    const ordered = [...diagram.classes].sort((a, b) => {
      const orderDiff = (a.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - (b.sidebarOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
    const dragged = ordered.find((entity) => entity.id === entityId);
    if (!dragged) return;

    const nextDragged = { ...dragged, domainId: targetDomainId ?? undefined };
    const withoutDragged = ordered.filter((entity) => entity.id !== entityId);
    let targetIndex = withoutDragged.length;

    if (targetEntityId) {
      const rowIndex = withoutDragged.findIndex((entity) => entity.id === targetEntityId);
      if (rowIndex >= 0) targetIndex = rowIndex + (insertAfter ? 1 : 0);
    } else {
      targetIndex = withoutDragged.reduce((lastIndex, entity, index) => (
        (entity.domainId ?? null) === targetDomainId ? index + 1 : lastIndex
      ), withoutDragged.length);
    }

    const nextEntities = [...withoutDragged];
    nextEntities.splice(targetIndex, 0, nextDragged);
    commitEntities(nextEntities);
  };

  const handleDropOnRow = (event: DragEvent<HTMLElement>, target: ClassEntity) => {
    event.preventDefault();
    const sourceId = draggingEntityId || event.dataTransfer.getData('text/class-id');
    if (!sourceId || sourceId === target.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    moveEntity(sourceId, target.domainId ?? null, target.id, event.clientY > rect.top + rect.height / 2);
    setDraggingEntityId(null);
    setDropGroupId(null);
  };

  const handleDropOnGroup = (event: DragEvent<HTMLElement>, group: EntityGroup) => {
    event.preventDefault();
    const sourceId = draggingEntityId || event.dataTransfer.getData('text/class-id');
    if (!sourceId) return;
    moveEntity(sourceId, group.domainId);
    setDraggingEntityId(null);
    setDropGroupId(null);
  };

  const cycleSortMode = () => {
    setSortMode((current) => current === 'manual' ? 'asc' : current === 'asc' ? 'desc' : 'manual');
  };

  return (
    <div className="flex h-full flex-col bg-white/95">
      <WorkspaceCatalogPaneHeader
        title="Entities"
        addLabel="Add entity"
        searchPlaceholder="Search entities..."
        query={query}
        sortMode={sortMode}
        areAllGroupsCollapsed={areAllGroupsCollapsed}
        collapseDisabled={collapsibleGroupIds.length === 0}
        onAdd={() => addEntity()}
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
                count={group.entities.length}
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
                  entityDnd.handleDragEnd();
                }}
              />
              {collapsed ? null : group.entities.map((entity) => {
                const domain = entity.domainId ? domainById.get(entity.domainId) : null;
                return (
                  <WorkspaceEntityCatalogRow
                    key={entity.id}
                    entity={entity}
                    domainColor={domain?.color}
                    selection={selection}
                    dnd={entityDnd}
                    dndIndexById={dndIndexById}
                    canPreviewReorder={canPreviewEntityReorder}
                    draggingEntityId={draggingEntityId}
                    entityById={entityById}
                    onDelete={deleteEntity}
                    onDropOnRow={handleDropOnRow}
                    onSelect={(entityId) => onSelectionChange({ kind: 'class', id: entityId, sourceView: 'model' })}
                    onSetDraggingEntityId={setDraggingEntityId}
                    onSetDropGroupId={setDropGroupId}
                    onUnlink={(entityId) => updateEntity(entityId, { domainId: undefined })}
                  />
                );
              })}
            </div>
          );
        })}
        {filteredEntities.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-400">No entities found</div>
        ) : null}
      </div>
    </div>
  );
}
