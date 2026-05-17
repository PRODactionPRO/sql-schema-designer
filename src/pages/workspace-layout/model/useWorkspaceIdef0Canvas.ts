import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { deepClone } from '@/shared/lib/json';
import type {
  Idef0Arrow,
  Idef0ArrowEndpoint,
  Idef0ArrowRole,
  Idef0Attribute,
  Idef0Concept,
  Idef0ConceptKind,
  Idef0DiagramModel,
  Idef0Function,
} from '@/shared/types/idef0';
import { useCanvasNavigation } from '@/shared/ui/useCanvasNavigation';
import type { CanvasResizeAnchor, CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import {
  conceptKindSupportsRole,
  getDefaultConceptName,
  getIdef0ConceptWidthForName,
  getIdef0ConceptSize,
  getIdef0FunctionWidthForName,
  getIdef0FunctionSize,
  getIdef0NodeBoxes,
  getIdef0NodeId,
  type Idef0NodeRef,
} from './idef0-view-utils';
import { nextWorkspaceId } from './workspace-project-utils';

const MAX_HISTORY_LENGTH = 50;
const WORKSPACE_IDEF0_CLIPBOARD_TYPE = 'application/x-prodsql-idef0-selection';
const WORKSPACE_IDEF0_CLIPBOARD_VERSION = 1;

interface Idef0ClipboardPayload {
  type: typeof WORKSPACE_IDEF0_CLIPBOARD_TYPE;
  version: typeof WORKSPACE_IDEF0_CLIPBOARD_VERSION;
  functions: Idef0Function[];
  concepts: Idef0Concept[];
  arrows: Idef0Arrow[];
}

interface UseWorkspaceIdef0CanvasOptions {
  onCommit?: (diagram: Idef0DiagramModel) => void;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  resizeAnchor?: CanvasResizeAnchor;
  onViewportChange?: (viewport: CanvasViewport) => void;
}

interface ConnectionDraft {
  from: Idef0NodeRef;
  start: { x: number; y: number };
  current: { x: number; y: number };
}

function getUniqueName<T extends { name: string }>(items: T[], baseName: string): string {
  const used = new Set(items.map((item) => item.name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;

  let index = 2;
  while (used.has(`${baseName} ${index}`.toLowerCase())) index += 1;
  return `${baseName} ${index}`;
}

function getUniqueNameFromSet(usedNames: Set<string>, baseName: string): string {
  if (!usedNames.has(baseName.toLowerCase())) {
    usedNames.add(baseName.toLowerCase());
    return baseName;
  }

  let index = 2;
  while (usedNames.has(`${baseName} ${index}`.toLowerCase())) index += 1;
  const nextName = `${baseName} ${index}`;
  usedNames.add(nextName.toLowerCase());
  return nextName;
}

function createFunction(position: { x: number; y: number }, functions: Idef0Function[]): Idef0Function {
  return {
    id: nextWorkspaceId('idef0_fn'),
    name: getUniqueName(functions, 'Function'),
    description: '',
    status: 'draft',
    position,
    size: { width: 240, height: 128 },
    attributes: createDefaultAttributes('function'),
  };
}

function createConcept(kind: Idef0ConceptKind, position: { x: number; y: number }, concepts: Idef0Concept[]): Idef0Concept {
  const baseName = getDefaultConceptName(kind);
  return {
    id: nextWorkspaceId('idef0_concept'),
    name: getUniqueName(concepts, baseName),
    kind,
    description: '',
    status: kind === 'component' || kind === 'actor' ? 'external' : 'draft',
    position,
    size: { width: 190, height: 58 },
    attributes: createDefaultAttributes(kind),
  };
}

function createDefaultAttributes(kind: Idef0ConceptKind | 'function'): Idef0Attribute[] {
  const names: string[] = kind === 'function'
    ? ['Owner', 'Trigger', 'Expected result']
    : kind === 'dataset'
      ? ['Source', 'Schema / shape', 'Freshness']
      : kind === 'artifact'
        ? ['Format', 'Storage location', 'Version']
        : kind === 'material_object'
          ? ['Identifier', 'Location', 'Quantity / state']
          : kind === 'state'
            ? ['Object', 'State value', 'Transition rule']
            : kind === 'event'
              ? ['Producer', 'Topic / channel', 'Payload']
              : kind === 'rule'
                ? ['Source', 'Priority', 'Validation logic']
                : kind === 'actor'
                  ? ['Role owner', 'Team', 'Authority']
                  : ['System', 'Interface', 'Runtime'];

  return names.map((name) => ({
    id: nextWorkspaceId('idef0_attr'),
    name,
    value: '',
    valueType: 'text' as const,
  }));
}

function getRoleFromFunctionSide(side?: Idef0NodeRef['side']): Idef0ArrowRole {
  if (side === 'top') return 'control';
  if (side === 'right') return 'output';
  if (side === 'bottom') return 'mechanism';
  return 'input';
}

function getRoleFromConceptKind(kind?: Idef0ConceptKind): Idef0ArrowRole {
  if (kind === 'rule') return 'control';
  if (kind === 'actor' || kind === 'component') return 'mechanism';
  return 'input';
}

function cloneIdef0Functions(functions: Idef0Function[]) {
  return deepClone(functions);
}

function cloneIdef0Concepts(concepts: Idef0Concept[]) {
  return deepClone(concepts);
}

function cloneIdef0Arrows(arrows: Idef0Arrow[]) {
  return deepClone(arrows);
}

function inferArrow(from: Idef0NodeRef, to: Idef0NodeRef, diagram: Idef0DiagramModel): Idef0Arrow | null {
  if (from.kind === to.kind && from.id === to.id) return null;

  const conceptsById = new Map(diagram.concepts.map((concept) => [concept.id, concept]));
  let role: Idef0ArrowRole = 'input';
  let source: Idef0Arrow['source'];
  let target: Idef0Arrow['target'];
  let conceptId: string | undefined;

  if (from.kind === 'function' && to.kind === 'concept') {
    role = from.side ? getRoleFromFunctionSide(from.side) : 'output';
    if (role === 'output') {
      source = { kind: 'function', id: from.id };
      target = { kind: 'concept', id: to.id };
    } else {
      source = { kind: 'concept', id: to.id };
      target = { kind: 'function', id: from.id };
    }
    conceptId = to.id;
  } else if (from.kind === 'concept' && to.kind === 'function') {
    const sourceConcept = conceptsById.get(from.id);
    role = to.side ? getRoleFromFunctionSide(to.side) : getRoleFromConceptKind(sourceConcept?.kind);
    if (role === 'output') {
      source = { kind: 'function', id: to.id };
      target = { kind: 'concept', id: from.id };
    } else {
      source = { kind: 'concept', id: from.id };
      target = { kind: 'function', id: to.id };
    }
    conceptId = from.id;
  } else if (from.kind === 'function' && to.kind === 'function') {
    role = 'output';
    source = { kind: 'function', id: from.id };
    target = { kind: 'function', id: to.id };
  } else {
    return null;
  }

  const concept = conceptId ? conceptsById.get(conceptId) : undefined;
  if (concept && !conceptKindSupportsRole(concept.kind, role)) return null;

  const duplicate = diagram.arrows.find((arrow) => (
    arrow.role === role
    && arrow.source.kind === source.kind
    && arrow.source.id === source.id
    && arrow.target.kind === target.kind
    && arrow.target.id === target.id
  ));
  if (duplicate) return duplicate;

  return {
    id: nextWorkspaceId('idef0_arrow'),
    role,
    source,
    target,
    conceptId,
    status: 'required',
  };
}

export function useWorkspaceIdef0Canvas(
  sourceDiagram: Idef0DiagramModel,
  options: UseWorkspaceIdef0CanvasOptions = {},
) {
  const [diagram, setDiagram] = useState<Idef0DiagramModel>(() => deepClone(sourceDiagram));
  const [historyPast, setHistoryPast] = useState<Idef0DiagramModel[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Idef0DiagramModel[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set());
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const navigation = useCanvasNavigation({
    initialPan: options.initialViewport?.pan,
    initialZoom: options.initialViewport?.zoom,
    restoreKey: options.viewportRestoreKey,
    resizeAnchor: options.resizeAnchor,
    minZoom: 0.15,
    maxZoom: 2.2,
    onViewportChange: options.onViewportChange,
  });
  const diagramRef = useRef(diagram);
  const historyPastRef = useRef(historyPast);
  const historyFutureRef = useRef(historyFuture);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const { onCommit } = options;
  const { screenToWorld } = navigation;

  useEffect(() => {
    const nextDiagram = deepClone(sourceDiagram);
    diagramRef.current = nextDiagram;
    historyPastRef.current = [];
    historyFutureRef.current = [];
    selectedNodeIdsRef.current = new Set();
    setDiagram(nextDiagram);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedNodeIds(new Set());
    setConnectionDraft(null);
  }, [sourceDiagram]);

  useEffect(() => {
    diagramRef.current = diagram;
  }, [diagram]);

  useEffect(() => {
    historyPastRef.current = historyPast;
  }, [historyPast]);

  useEffect(() => {
    historyFutureRef.current = historyFuture;
  }, [historyFuture]);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  const nodeBoxes = useMemo(() => (
    new Map(getIdef0NodeBoxes(diagram).map((box) => [getIdef0NodeId({ kind: box.kind, id: box.id }), box]))
  ), [diagram]);

  const getSnapshot = useCallback(() => deepClone(diagramRef.current), []);

  const pushHistory = useCallback(() => {
    const nextPast = [...historyPastRef.current.slice(-(MAX_HISTORY_LENGTH - 1)), getSnapshot()];
    historyPastRef.current = nextPast;
    historyFutureRef.current = [];
    setHistoryPast(nextPast);
    setHistoryFuture([]);
  }, [getSnapshot]);

  const applyDiagram = useCallback((nextDiagram: Idef0DiagramModel) => {
    const clonedDiagram = deepClone(nextDiagram);
    diagramRef.current = clonedDiagram;
    setDiagram(clonedDiagram);
    onCommit?.(deepClone(clonedDiagram));
  }, [onCommit]);

  const selectNode = useCallback((ref: Idef0NodeRef, additive = false) => {
    const nodeId = getIdef0NodeId(ref);
    setSelectedNodeIds((current) => {
      if (!additive) return new Set([nodeId]);
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  const addFunction = useCallback((position: { x: number; y: number }) => {
    pushHistory();
    const fn = createFunction(position, diagramRef.current.functions);
    applyDiagram({
      ...diagramRef.current,
      functions: [...diagramRef.current.functions, fn],
    });
    setSelectedNodeIds(new Set([getIdef0NodeId({ kind: 'function', id: fn.id })]));
    return fn;
  }, [applyDiagram, pushHistory]);

  const addConcept = useCallback((kind: Idef0ConceptKind, position: { x: number; y: number }) => {
    pushHistory();
    const concept = createConcept(kind, position, diagramRef.current.concepts);
    applyDiagram({
      ...diagramRef.current,
      concepts: [...diagramRef.current.concepts, concept],
    });
    setSelectedNodeIds(new Set([getIdef0NodeId({ kind: 'concept', id: concept.id })]));
    return concept;
  }, [applyDiagram, pushHistory]);

  const moveNode = useCallback((ref: Idef0NodeRef, position: { x: number; y: number }) => {
    const nodeId = getIdef0NodeId(ref);
    setDiagram((current) => {
      const next = ref.kind === 'function'
        ? {
            ...current,
            functions: current.functions.map((fn) => (fn.id === ref.id ? { ...fn, position } : fn)),
          }
        : {
            ...current,
            concepts: current.concepts.map((concept) => (concept.id === ref.id ? { ...concept, position } : concept)),
          };
      diagramRef.current = next;
      return next;
    });
    selectedNodeIdsRef.current.add(nodeId);
  }, []);

  const moveSelectedNodesBy = useCallback((delta: { x: number; y: number }) => {
    const selected = selectedNodeIdsRef.current;
    setDiagram((current) => {
      const next = {
        ...current,
        functions: current.functions.map((fn) => (
          selected.has(getIdef0NodeId({ kind: 'function', id: fn.id }))
            ? { ...fn, position: { x: fn.position.x + delta.x, y: fn.position.y + delta.y } }
            : fn
        )),
        concepts: current.concepts.map((concept) => (
          selected.has(getIdef0NodeId({ kind: 'concept', id: concept.id }))
            ? { ...concept, position: { x: concept.position.x + delta.x, y: concept.position.y + delta.y } }
            : concept
        )),
      };
      diagramRef.current = next;
      return next;
    });
  }, []);

  const commitCurrentDiagram = useCallback(() => {
    onCommit?.(deepClone(diagramRef.current));
  }, [onCommit]);

  const startNodeDrag = useCallback((
    ref: Idef0NodeRef,
    position: { x: number; y: number },
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;

    const startPoint = screenToWorld(event);
    if (!startPoint) return;

    const nodeId = getIdef0NodeId(ref);
    const alreadySelected = selectedNodeIdsRef.current.has(nodeId);
    if (!alreadySelected) {
      selectedNodeIdsRef.current = new Set([nodeId]);
      setSelectedNodeIds(new Set([nodeId]));
    }
    pushHistory();

    const groupDrag = selectedNodeIdsRef.current.size > 1 && selectedNodeIdsRef.current.has(nodeId);
    const startPosition = position;
    let previousPoint = startPoint;

    event.preventDefault();
    event.stopPropagation();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPoint = screenToWorld(moveEvent);
      if (!nextPoint) return;

      if (groupDrag) {
        moveSelectedNodesBy({
          x: nextPoint.x - previousPoint.x,
          y: nextPoint.y - previousPoint.y,
        });
        previousPoint = nextPoint;
        return;
      }

      moveNode(ref, {
        x: startPosition.x + nextPoint.x - startPoint.x,
        y: startPosition.y + nextPoint.y - startPoint.y,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      commitCurrentDiagram();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [commitCurrentDiagram, moveNode, moveSelectedNodesBy, pushHistory, screenToWorld]);

  const startConnectionDrag = useCallback((from: Idef0NodeRef, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const start = screenToWorld(event);
    if (!start) return;

    event.preventDefault();
    event.stopPropagation();
    setConnectionDraft({ from, start, current: start });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const current = screenToWorld(moveEvent);
      if (!current) return;
      setConnectionDraft((draft) => (draft ? { ...draft, current } : null));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      const target = (upEvent.target as HTMLElement | null)?.closest('[data-idef0-node-kind]') as HTMLElement | null;
      const kind = target?.dataset.idef0NodeKind;
      const id = target?.dataset.idef0NodeId;
      const side = target?.dataset.idef0NodeSide as Idef0NodeRef['side'] | undefined;
      setConnectionDraft(null);
      if ((kind !== 'function' && kind !== 'concept') || !id) return;

      const arrow = inferArrow(from, { kind, id, side }, diagramRef.current);
      if (!arrow) return;
      if (diagramRef.current.arrows.some((item) => item.id === arrow.id)) return;

      pushHistory();
      applyDiagram({
        ...diagramRef.current,
        arrows: [...diagramRef.current.arrows, arrow],
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [applyDiagram, pushHistory, screenToWorld]);

  const selectNodesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selectedIds = getIdef0NodeBoxes(diagramRef.current)
      .filter((box) => (
        box.x <= rect.x + rect.w
        && box.x + box.width >= rect.x
        && box.y <= rect.y + rect.h
        && box.y + box.height >= rect.y
      ))
      .map((box) => getIdef0NodeId({ kind: box.kind, id: box.id }));

    setSelectedNodeIds(new Set(selectedIds));
    return selectedIds;
  }, []);

  const deleteNode = useCallback((ref: Idef0NodeRef) => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      functions: ref.kind === 'function'
        ? diagramRef.current.functions.filter((fn) => fn.id !== ref.id)
        : diagramRef.current.functions,
      concepts: ref.kind === 'concept'
        ? diagramRef.current.concepts.filter((concept) => concept.id !== ref.id)
        : diagramRef.current.concepts,
      arrows: diagramRef.current.arrows.filter((arrow) => (
        !(arrow.source.kind === ref.kind && arrow.source.id === ref.id)
        && !(arrow.target.kind === ref.kind && arrow.target.id === ref.id)
      )),
    });
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      next.delete(getIdef0NodeId(ref));
      return next;
    });
  }, [applyDiagram, pushHistory]);

  const deleteArrow = useCallback((arrowId: string) => {
    pushHistory();
    applyDiagram({
      ...diagramRef.current,
      arrows: diagramRef.current.arrows.filter((arrow) => arrow.id !== arrowId),
    });
  }, [applyDiagram, pushHistory]);

  const renameNode = useCallback((ref: Idef0NodeRef, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    pushHistory();
    applyDiagram(ref.kind === 'function'
      ? {
          ...diagramRef.current,
          functions: diagramRef.current.functions.map((fn) => {
            if (fn.id !== ref.id) return fn;
            const size = getIdef0FunctionSize(fn);
            return {
              ...fn,
              name: nextName,
              size: {
                ...size,
                width: getIdef0FunctionWidthForName(nextName, size.width),
              },
            };
          }),
        }
      : {
          ...diagramRef.current,
          concepts: diagramRef.current.concepts.map((concept) => {
            if (concept.id !== ref.id) return concept;
            const size = getIdef0ConceptSize(concept);
            return {
              ...concept,
              name: nextName,
              size: {
                ...size,
                width: getIdef0ConceptWidthForName(nextName, size.width),
              },
            };
          }),
        });
  }, [applyDiagram, pushHistory]);

  const exportSelectionForClipboard = useCallback(() => {
    const selectedIds = selectedNodeIdsRef.current;
    if (selectedIds.size === 0) return null;

    const selectedFunctions = diagramRef.current.functions.filter((fn) => (
      selectedIds.has(getIdef0NodeId({ kind: 'function', id: fn.id }))
    ));
    const selectedConcepts = diagramRef.current.concepts.filter((concept) => (
      selectedIds.has(getIdef0NodeId({ kind: 'concept', id: concept.id }))
    ));
    if (selectedFunctions.length === 0 && selectedConcepts.length === 0) return null;

    const selectedFunctionIds = new Set(selectedFunctions.map((fn) => fn.id));
    const selectedConceptIds = new Set(selectedConcepts.map((concept) => concept.id));
    const selectedArrows = diagramRef.current.arrows.filter((arrow) => (
      arrow.source.kind !== 'boundary'
      && arrow.target.kind !== 'boundary'
      && (
        arrow.source.kind === 'function'
          ? selectedFunctionIds.has(arrow.source.id ?? '')
          : selectedConceptIds.has(arrow.source.id ?? '')
      )
      && (
        arrow.target.kind === 'function'
          ? selectedFunctionIds.has(arrow.target.id ?? '')
          : selectedConceptIds.has(arrow.target.id ?? '')
      )
    ));

    const payload: Idef0ClipboardPayload = {
      type: WORKSPACE_IDEF0_CLIPBOARD_TYPE,
      version: WORKSPACE_IDEF0_CLIPBOARD_VERSION,
      functions: cloneIdef0Functions(selectedFunctions),
      concepts: cloneIdef0Concepts(selectedConcepts),
      arrows: cloneIdef0Arrows(selectedArrows),
    };
    return JSON.stringify(payload);
  }, []);

  const importSelectionFromClipboard = useCallback((content: string, offset = { x: 64, y: 64 }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const payload = parsed as Partial<Idef0ClipboardPayload>;
    if (payload.type !== WORKSPACE_IDEF0_CLIPBOARD_TYPE || payload.version !== WORKSPACE_IDEF0_CLIPBOARD_VERSION) return null;
    if (!Array.isArray(payload.functions) || !Array.isArray(payload.concepts) || !Array.isArray(payload.arrows)) return null;
    if (payload.functions.length === 0 && payload.concepts.length === 0) return null;

    pushHistory();

    const functionIdMap = new Map<string, string>();
    const conceptIdMap = new Map<string, string>();
    const usedFunctionNames = new Set(diagramRef.current.functions.map((fn) => fn.name.toLowerCase()));
    const usedConceptNames = new Set(diagramRef.current.concepts.map((concept) => concept.name.toLowerCase()));
    const pastedFunctions = cloneIdef0Functions(payload.functions).map((sourceFunction) => {
      const nextId = nextWorkspaceId('idef0_fn');
      functionIdMap.set(sourceFunction.id, nextId);
      return {
        ...sourceFunction,
        id: nextId,
        name: getUniqueNameFromSet(usedFunctionNames, sourceFunction.name),
        position: {
          x: sourceFunction.position.x + offset.x,
          y: sourceFunction.position.y + offset.y,
        },
        attributes: sourceFunction.attributes?.map((attribute) => ({
          ...attribute,
          id: nextWorkspaceId('idef0_attr'),
        })),
      };
    });
    const pastedConcepts = cloneIdef0Concepts(payload.concepts).map((sourceConcept) => {
      const nextId = nextWorkspaceId('idef0_concept');
      conceptIdMap.set(sourceConcept.id, nextId);
      return {
        ...sourceConcept,
        id: nextId,
        name: getUniqueNameFromSet(usedConceptNames, sourceConcept.name),
        position: {
          x: sourceConcept.position.x + offset.x,
          y: sourceConcept.position.y + offset.y,
        },
        attributes: sourceConcept.attributes?.map((attribute) => ({
          ...attribute,
          id: nextWorkspaceId('idef0_attr'),
        })),
      };
    });

    const remapEndpoint = (endpoint: Idef0ArrowEndpoint): Idef0ArrowEndpoint | null => {
      if (endpoint.kind === 'boundary') return null;
      const nextId = endpoint.kind === 'function'
        ? functionIdMap.get(endpoint.id ?? '')
        : conceptIdMap.get(endpoint.id ?? '');
      return nextId ? { kind: endpoint.kind, id: nextId } : null;
    };

    const pastedArrows = cloneIdef0Arrows(payload.arrows)
      .map((sourceArrow) => {
        const source = remapEndpoint(sourceArrow.source);
        const target = remapEndpoint(sourceArrow.target);
        if (!source || !target) return null;
        const pastedArrow: Idef0Arrow = {
          ...sourceArrow,
          id: nextWorkspaceId('idef0_arrow'),
          source,
          target,
          conceptId: sourceArrow.conceptId ? conceptIdMap.get(sourceArrow.conceptId) : undefined,
        };
        return pastedArrow;
      })
      .filter((arrow): arrow is Idef0Arrow => arrow !== null);

    applyDiagram({
      ...diagramRef.current,
      functions: [...diagramRef.current.functions, ...pastedFunctions],
      concepts: [...diagramRef.current.concepts, ...pastedConcepts],
      arrows: [...diagramRef.current.arrows, ...pastedArrows],
    });
    selectedNodeIdsRef.current = new Set([
      ...pastedFunctions.map((fn) => getIdef0NodeId({ kind: 'function', id: fn.id })),
      ...pastedConcepts.map((concept) => getIdef0NodeId({ kind: 'concept', id: concept.id })),
    ]);
    setSelectedNodeIds(new Set(selectedNodeIdsRef.current));

    return {
      functions: pastedFunctions.length,
      concepts: pastedConcepts.length,
      arrows: pastedArrows.length,
    };
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
    nodeBoxes,
    selectedNodeIds,
    connectionDraft,
    containerRef: navigation.containerRef,
    pan: navigation.pan,
    zoom: navigation.zoom,
    isPanning: navigation.isPanning,
    zoomToBounds: navigation.zoomToBounds,
    screenToWorld: navigation.screenToWorld,
    addFunction,
    addConcept,
    selectNode,
    clearSelection,
    selectNodesInRect,
    startNodeDrag,
    startConnectionDrag,
    deleteNode,
    deleteArrow,
    renameNode,
    exportSelectionForClipboard,
    importSelectionFromClipboard,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    undo,
    redo,
    getFunctionSize: getIdef0FunctionSize,
    getConceptSize: getIdef0ConceptSize,
  };
}
