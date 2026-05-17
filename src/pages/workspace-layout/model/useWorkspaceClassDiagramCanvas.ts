import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { deepClone } from '@/shared/lib/json';
import type {
  ClassDiagramModel,
  ClassEntity,
  ClassEntityKind,
  ClassRelation,
  ProjectSemanticObjectBinding,
  ProjectSemanticViewBinding,
} from '@/shared/types/project';
import { useCanvasNavigation } from '@/shared/ui/useCanvasNavigation';
import type { CanvasResizeAnchor, CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import { CLASS_CARD_WIDTH, estimateClassCardHeight } from './class-diagram-view-utils';
import {
  createClassRelationInView,
  deleteRelationFromSemanticView,
} from './semantic-relation-commands';
import {
  createSemanticObjectProjection,
  deleteSemanticObjectProjection,
  moveSemanticObjectProjection,
  objectMetadata,
  updateSemanticObjectProjection,
} from './semantic-object-commands';
import { reorderClassMembers } from './workspace-canvas-utils';
import { nextWorkspaceId } from './workspace-project-utils';

const MAX_HISTORY_LENGTH = 50;

interface UseWorkspaceClassDiagramCanvasOptions {
  projectId?: string;
  semanticBinding?: ProjectSemanticViewBinding;
  onCommit?: (diagram: ClassDiagramModel) => void;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  resizeAnchor?: CanvasResizeAnchor;
  onViewportChange?: (viewport: CanvasViewport) => void;
}

function createClassPositionMap(diagram: ClassDiagramModel) {
  return new Map(diagram.classes.map((entity) => [entity.id, entity.position]));
}

function getUniqueClassName(classes: ClassEntity[], baseName: string): string {
  const used = new Set(classes.map((entity) => entity.name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;

  let index = 2;
  while (used.has(`${baseName}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function createClassEntity(kind: ClassEntityKind, name: string, position: { x: number; y: number }): ClassEntity {
  const id = nextWorkspaceId('class');
  const attributes = kind === 'interface'
    ? []
    : [{
        id: nextWorkspaceId('class_attr'),
        name: kind === 'enum' ? 'Value1' : 'id',
        type: kind === 'enum' ? name : 'string',
        visibility: 'public' as const,
        multiplicity: 'one' as const,
        required: true,
      }];
  const methods = kind === 'enum'
    ? []
    : [{
        id: nextWorkspaceId('class_method'),
        name: kind === 'interface' ? 'operation1' : 'create',
        returnType: 'void',
        visibility: 'public' as const,
        parameters: '',
      }];

  return {
    id,
    name,
    kind,
    attributes,
    methods,
    position,
  };
}

export function useWorkspaceClassDiagramCanvas(
  sourceDiagram: ClassDiagramModel,
  options: UseWorkspaceClassDiagramCanvasOptions = {},
) {
  const [diagram, setDiagram] = useState<ClassDiagramModel>(() => deepClone(sourceDiagram));
  const [historyPast, setHistoryPast] = useState<ClassDiagramModel[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ClassDiagramModel[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(() => new Set());
  const navigation = useCanvasNavigation({
    initialPan: options.initialViewport?.pan,
    initialZoom: options.initialViewport?.zoom,
    restoreKey: options.viewportRestoreKey,
    resizeAnchor: options.resizeAnchor,
    onViewportChange: options.onViewportChange,
  });
  const diagramRef = useRef(diagram);
  const classPositionsRef = useRef(createClassPositionMap(diagram));
  const localObjectBindingsRef = useRef(new Map<string, ProjectSemanticObjectBinding>());
  const pendingObjectCreatesRef = useRef(new Map<string, Promise<ProjectSemanticObjectBinding | null>>());
  const historyPastRef = useRef(historyPast);
  const historyFutureRef = useRef(historyFuture);
  const { projectId, semanticBinding, onCommit } = options;
  const { screenToWorld } = navigation;

  useEffect(() => {
    const nextDiagram = deepClone(sourceDiagram);
    diagramRef.current = nextDiagram;
    classPositionsRef.current = createClassPositionMap(nextDiagram);
    historyPastRef.current = [];
    historyFutureRef.current = [];
    localObjectBindingsRef.current.clear();
    pendingObjectCreatesRef.current.clear();
    setDiagram(nextDiagram);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedClassIds(new Set());
  }, [sourceDiagram]);

  useEffect(() => {
    diagramRef.current = diagram;
    classPositionsRef.current = createClassPositionMap(diagram);
  }, [diagram]);

  useEffect(() => {
    historyPastRef.current = historyPast;
  }, [historyPast]);

  useEffect(() => {
    historyFutureRef.current = historyFuture;
  }, [historyFuture]);

  const getSnapshot = useCallback(() => deepClone(diagramRef.current), []);

  const pushHistory = useCallback(() => {
    const nextPast = [...historyPastRef.current.slice(-(MAX_HISTORY_LENGTH - 1)), getSnapshot()];
    historyPastRef.current = nextPast;
    historyFutureRef.current = [];
    setHistoryPast(nextPast);
    setHistoryFuture([]);
  }, [getSnapshot]);

  const getWorldPoint = useCallback((event: Pick<PointerEvent, 'clientX' | 'clientY'>) => (
    screenToWorld(event)
  ), [screenToWorld]);

  const getClassObjectBinding = useCallback((classId: string) => (
    semanticBinding?.objectsByLegacyId[classId] ?? localObjectBindingsRef.current.get(classId)
  ), [semanticBinding]);

  const updateClassPosition = useCallback((classId: string, position: { x: number; y: number }) => {
    classPositionsRef.current.set(classId, position);
    setDiagram((current) => {
      const next = {
        ...current,
        classes: current.classes.map((entity) => (
          entity.id === classId ? { ...entity, position } : entity
        )),
      };
      diagramRef.current = next;
      return next;
    });
  }, []);

  const saveClassPosition = useCallback((classId: string) => {
    const objectBinding = getClassObjectBinding(classId);
    if (!projectId || !semanticBinding?.viewId || !objectBinding?.viewNodeId) return;

    const position = classPositionsRef.current.get(classId)
      ?? diagramRef.current.classes.find((entity) => entity.id === classId)?.position;
    if (!position) return;

    moveSemanticObjectProjection({
      projectId,
      semanticBinding,
      binding: objectBinding,
      position,
    });
  }, [getClassObjectBinding, projectId, semanticBinding]);

  const saveClassMetadata = useCallback((entity: ClassEntity) => {
    const objectBinding = getClassObjectBinding(entity.id);
    if (!projectId || !objectBinding) return;

    const baseMetadata = objectMetadata(objectBinding.metadata);
    const metadata = {
      ...baseMetadata,
      ...entity,
      position: entity.position,
      attributes: entity.attributes,
      methods: entity.methods,
    };
    updateSemanticObjectProjection({
      projectId,
      binding: objectBinding,
      name: entity.name,
      description: entity.description,
      domainId: entity.domainId,
      metadata,
    });
  }, [getClassObjectBinding, projectId]);

  const createClassObject = useCallback((entity: ClassEntity) => {
    if (!projectId) return;

    const pending = createSemanticObjectProjection({
      projectId,
      viewId: semanticBinding?.viewId,
      type: 'entity',
      name: entity.name,
      description: entity.description,
      domainId: entity.domainId,
      metadata: { ...entity },
      position: entity.position,
    });

    const tracked = pending
      .then((binding) => {
        localObjectBindingsRef.current.set(entity.id, binding);
        return binding;
      })
      .catch((error) => {
        console.error('[workspace] Failed to create class object', error);
        return null;
      })
      .finally(() => {
        pendingObjectCreatesRef.current.delete(entity.id);
      });

    pendingObjectCreatesRef.current.set(entity.id, tracked);
  }, [projectId, semanticBinding]);

  const deleteClassObject = useCallback((classId: string) => {
    if (!projectId) return;

    const deleteBinding = (binding: ProjectSemanticObjectBinding | null | undefined) => {
      if (!binding) return;
      deleteSemanticObjectProjection({
        projectId,
        semanticBinding,
        binding,
      });
      localObjectBindingsRef.current.delete(classId);
    };

    const binding = getClassObjectBinding(classId);
    if (binding) {
      deleteBinding(binding);
      return;
    }

    const pending = pendingObjectCreatesRef.current.get(classId);
    if (pending) void pending.then(deleteBinding);
  }, [getClassObjectBinding, projectId, semanticBinding]);

  const saveClassRelation = useCallback((relation: ClassRelation) => {
    if (!projectId) return;

    const sourceBinding = getClassObjectBinding(relation.fromClassId);
    const targetBinding = getClassObjectBinding(relation.toClassId);
    if (sourceBinding && targetBinding) {
      createClassRelationInView(projectId, semanticBinding, relation, sourceBinding, targetBinding);
      return;
    }

    const pendingSource = pendingObjectCreatesRef.current.get(relation.fromClassId);
    const pendingTarget = pendingObjectCreatesRef.current.get(relation.toClassId);
    if (!pendingSource && !pendingTarget) return;

    void Promise.all([
      pendingSource ?? Promise.resolve(sourceBinding ?? null),
      pendingTarget ?? Promise.resolve(targetBinding ?? null),
    ]).then(([resolvedSourceBinding, resolvedTargetBinding]) => {
      if (!resolvedSourceBinding || !resolvedTargetBinding) return;
      createClassRelationInView(
        projectId,
        semanticBinding,
        relation,
        resolvedSourceBinding,
        resolvedTargetBinding,
      );
    });
  }, [getClassObjectBinding, projectId, semanticBinding]);

  const persistDiagram = useCallback((nextDiagram: ClassDiagramModel) => {
    nextDiagram.classes.forEach((entity) => {
      classPositionsRef.current.set(entity.id, entity.position);
      saveClassPosition(entity.id);
      saveClassMetadata(entity);
    });
  }, [saveClassMetadata, saveClassPosition]);

  const applyDiagram = useCallback((nextDiagram: ClassDiagramModel) => {
    const clonedDiagram = deepClone(nextDiagram);
    diagramRef.current = clonedDiagram;
    classPositionsRef.current = createClassPositionMap(clonedDiagram);
    setDiagram(clonedDiagram);
    persistDiagram(clonedDiagram);
    onCommit?.(deepClone(clonedDiagram));
  }, [onCommit, persistDiagram]);

  const startClassDrag = useCallback((
    classId: string,
    position: { x: number; y: number },
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;

    const startPoint = getWorldPoint(event);
    if (!startPoint) return;

    pushHistory();

    const pointerOffset = {
      x: startPoint.x - position.x,
      y: startPoint.y - position.y,
    };

    event.preventDefault();
    event.stopPropagation();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPoint = getWorldPoint(moveEvent);
      if (!nextPoint) return;

      updateClassPosition(classId, {
        x: nextPoint.x - pointerOffset.x,
        y: nextPoint.y - pointerOffset.y,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      saveClassPosition(classId);
      onCommit?.(deepClone(diagramRef.current));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [getWorldPoint, onCommit, pushHistory, saveClassPosition, updateClassPosition]);

  const reorderAttributes = useCallback((classId: string, fromIndex: number, toIndex: number) => {
    pushHistory();
    const nextDiagram = reorderClassMembers(diagramRef.current, classId, 'attributes', fromIndex, toIndex);
    const updatedEntity = nextDiagram.classes.find((entity) => entity.id === classId);
    diagramRef.current = nextDiagram;
    classPositionsRef.current = createClassPositionMap(nextDiagram);
    setDiagram(nextDiagram);
    if (updatedEntity) {
      saveClassMetadata(updatedEntity);
    }
    onCommit?.(deepClone(nextDiagram));
  }, [onCommit, pushHistory, saveClassMetadata]);

  const reorderMethods = useCallback((classId: string, fromIndex: number, toIndex: number) => {
    pushHistory();
    const nextDiagram = reorderClassMembers(diagramRef.current, classId, 'methods', fromIndex, toIndex);
    const updatedEntity = nextDiagram.classes.find((entity) => entity.id === classId);
    diagramRef.current = nextDiagram;
    classPositionsRef.current = createClassPositionMap(nextDiagram);
    setDiagram(nextDiagram);
    if (updatedEntity) {
      saveClassMetadata(updatedEntity);
    }
    onCommit?.(deepClone(nextDiagram));
  }, [onCommit, pushHistory, saveClassMetadata]);

  const addClassEntity = useCallback((kind: ClassEntityKind, position: { x: number; y: number }) => {
    pushHistory();
    const baseName = kind === 'interface'
      ? 'Interface'
      : kind === 'enum'
        ? 'Enum'
        : kind === 'datatype'
          ? 'DataType'
          : 'Class';
    const name = getUniqueClassName(diagramRef.current.classes, baseName);
    const entity = createClassEntity(kind, name, position);
    const nextDiagram = {
      ...diagramRef.current,
      classes: [
        ...diagramRef.current.classes,
        entity,
      ],
    };
    applyDiagram(nextDiagram);
    createClassObject(entity);
    return entity;
  }, [applyDiagram, createClassObject, pushHistory]);

  const deleteClassEntity = useCallback((classId: string) => {
    pushHistory();
    const removedRelations = diagramRef.current.relations.filter((relation) => relation.fromClassId === classId || relation.toClassId === classId);
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.filter((entity) => entity.id !== classId),
      relations: diagramRef.current.relations.filter((relation) => relation.fromClassId !== classId && relation.toClassId !== classId),
    });
    removedRelations.forEach((relation) => {
      if (projectId) deleteRelationFromSemanticView(projectId, semanticBinding, relation.id);
    });
    deleteClassObject(classId);
  }, [applyDiagram, deleteClassObject, projectId, pushHistory, semanticBinding]);

  const duplicateClassEntity = useCallback((classId: string) => {
    const entity = diagramRef.current.classes.find((item) => item.id === classId);
    if (!entity) return;

    pushHistory();
    const nextEntityId = nextWorkspaceId('class');
    const nextEntity: ClassEntity = {
      ...deepClone(entity),
      id: nextEntityId,
      name: getUniqueClassName(diagramRef.current.classes, `${entity.name}Copy`),
      position: {
        x: entity.position.x + 48,
        y: entity.position.y + 48,
      },
      attributes: entity.attributes.map((attribute) => ({
        ...attribute,
        id: nextWorkspaceId('class_attr'),
      })),
      methods: entity.methods.map((method) => ({
        ...method,
        id: nextWorkspaceId('class_method'),
      })),
    };
    applyDiagram({
      ...diagramRef.current,
      classes: [...diagramRef.current.classes, nextEntity],
    });
    createClassObject(nextEntity);
  }, [applyDiagram, createClassObject, pushHistory]);

  const addAttribute = useCallback((classId: string) => {
    const entity = diagramRef.current.classes.find((item) => item.id === classId);
    if (!entity) return;

    pushHistory();
    const nextDiagram = {
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((item) => (
        item.id === classId
          ? {
              ...item,
              attributes: [
                ...item.attributes,
                {
                  id: nextWorkspaceId('class_attr'),
                  name: item.kind === 'enum' ? `Value${item.attributes.length + 1}` : `attribute_${item.attributes.length + 1}`,
                  type: item.kind === 'enum' ? item.name : 'string',
                  visibility: 'public' as const,
                  multiplicity: 'one' as const,
                  required: true,
                },
              ],
            }
          : item
      )),
    };
    applyDiagram(nextDiagram);
  }, [applyDiagram, pushHistory]);

  const addMethod = useCallback((classId: string) => {
    const entity = diagramRef.current.classes.find((item) => item.id === classId);
    if (!entity) return;

    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((item) => (
        item.id === classId
          ? {
              ...item,
              methods: [
                ...item.methods,
                {
                  id: nextWorkspaceId('class_method'),
                  name: item.kind === 'interface' ? `operation${item.methods.length + 1}` : `method_${item.methods.length + 1}`,
                  returnType: 'void',
                  visibility: 'public' as const,
                  parameters: '',
                },
              ],
            }
          : item
      )),
    });
  }, [applyDiagram, pushHistory]);

  const updateAttributeType = useCallback((classId: string, attributeId: string, type: string) => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((entity) => (
        entity.id === classId
          ? {
              ...entity,
              attributes: entity.attributes.map((attribute) => (
                attribute.id === attributeId ? { ...attribute, type } : attribute
              )),
            }
          : entity
      )),
    });
  }, [applyDiagram, pushHistory]);

  const updateAttributeName = useCallback((classId: string, attributeId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;

    const entity = diagramRef.current.classes.find((item) => item.id === classId);
    const attribute = entity?.attributes.find((item) => item.id === attributeId);
    if (!attribute || attribute.name === nextName) return;

    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((item) => (
        item.id === classId
          ? {
              ...item,
              attributes: item.attributes.map((currentAttribute) => (
                currentAttribute.id === attributeId ? { ...currentAttribute, name: nextName } : currentAttribute
              )),
            }
          : item
      )),
    });
  }, [applyDiagram, pushHistory]);

  const updateMethodReturnType = useCallback((classId: string, methodId: string, returnType: string) => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((entity) => (
        entity.id === classId
          ? {
              ...entity,
              methods: entity.methods.map((method) => (
                method.id === methodId ? { ...method, returnType } : method
              )),
            }
          : entity
      )),
    });
  }, [applyDiagram, pushHistory]);

  const updateMethodName = useCallback((classId: string, methodId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;

    const entity = diagramRef.current.classes.find((item) => item.id === classId);
    const method = entity?.methods.find((item) => item.id === methodId);
    if (!method || method.name === nextName) return;

    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((item) => (
        item.id === classId
          ? {
              ...item,
              methods: item.methods.map((currentMethod) => (
                currentMethod.id === methodId ? { ...currentMethod, name: nextName } : currentMethod
              )),
            }
          : item
      )),
    });
  }, [applyDiagram, pushHistory]);

  const clearClassSelection = useCallback(() => {
    setSelectedClassIds(new Set());
  }, []);

  const addClassRelation = useCallback((fromClassId: string, toClassId: string) => {
    if (fromClassId === toClassId) return null;

    const source = diagramRef.current.classes.find((entity) => entity.id === fromClassId);
    const target = diagramRef.current.classes.find((entity) => entity.id === toClassId);
    if (!source || !target) return null;

    const existingRelation = diagramRef.current.relations.find((relation) => (
      (relation.fromClassId === fromClassId && relation.toClassId === toClassId)
      || (
        relation.type === 'association'
        && relation.fromClassId === toClassId
        && relation.toClassId === fromClassId
      )
    ));
    if (existingRelation) return existingRelation;

    const relation: ClassRelation = {
      id: nextWorkspaceId('class_relation'),
      fromClassId,
      toClassId,
      type: 'association',
      label: `${source.name} has ${target.name}`,
      fromRole: source.name,
      toRole: target.name,
      fromMultiplicity: '1',
      toMultiplicity: '*',
    };

    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      relations: [...diagramRef.current.relations, relation],
    });
    saveClassRelation(relation);
    return relation;
  }, [applyDiagram, pushHistory, saveClassRelation]);

  const selectClassesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selectedIds = diagramRef.current.classes
      .filter((entity) => {
        const right = entity.position.x + CLASS_CARD_WIDTH;
        const bottom = entity.position.y + estimateClassCardHeight(entity);
        return entity.position.x <= rect.x + rect.w
          && right >= rect.x
          && entity.position.y <= rect.y + rect.h
          && bottom >= rect.y;
      })
      .map((entity) => entity.id);

    setSelectedClassIds(new Set(selectedIds));
    return selectedIds;
  }, []);

  const deleteClassRelation = useCallback((relationId: string) => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      relations: diagramRef.current.relations.filter((relation) => relation.id !== relationId),
    });
    if (!projectId) return;
    deleteRelationFromSemanticView(projectId, semanticBinding, relationId);
  }, [applyDiagram, projectId, pushHistory, semanticBinding]);

  const autoLayout = useCallback(() => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      classes: diagramRef.current.classes.map((entity, index) => ({
        ...entity,
        position: {
          x: 160 + (index % 3) * 420,
          y: 140 + Math.floor(index / 3) * 300,
        },
      })),
    });
  }, [applyDiagram, pushHistory]);

  const undo = useCallback(() => {
    const previous = historyPastRef.current.at(-1);
    if (!previous) return;

    const nextPast = historyPastRef.current.slice(0, -1);
    const nextFuture = [getSnapshot(), ...historyFutureRef.current].slice(0, MAX_HISTORY_LENGTH);
    historyPastRef.current = nextPast;
    historyFutureRef.current = nextFuture;
    setHistoryPast(nextPast);
    setHistoryFuture(nextFuture);
    applyDiagram(previous);
  }, [applyDiagram, getSnapshot]);

  const redo = useCallback(() => {
    const next = historyFutureRef.current[0];
    if (!next) return;

    const nextPast = [...historyPastRef.current.slice(-(MAX_HISTORY_LENGTH - 1)), getSnapshot()];
    const nextFuture = historyFutureRef.current.slice(1);
    historyPastRef.current = nextPast;
    historyFutureRef.current = nextFuture;
    setHistoryPast(nextPast);
    setHistoryFuture(nextFuture);
    applyDiagram(next);
  }, [applyDiagram, getSnapshot]);

  return {
    diagram,
    selectedClassIds,
    containerRef: navigation.containerRef,
    pan: navigation.pan,
    zoom: navigation.zoom,
    isPanning: navigation.isPanning,
    zoomToBounds: navigation.zoomToBounds,
    screenToWorld: navigation.screenToWorld,
    addClassEntity,
    deleteClassEntity,
    duplicateClassEntity,
    addAttribute,
    addMethod,
    updateAttributeName,
    updateAttributeType,
    updateMethodName,
    updateMethodReturnType,
    clearClassSelection,
    addClassRelation,
    selectClassesInRect,
    deleteClassRelation,
    autoLayout,
    startClassDrag,
    reorderAttributes,
    reorderMethods,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    undo,
    redo,
    getSnapshot,
  };
}
