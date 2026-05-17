import type {
  Idef0Arrow,
  Idef0ArrowRole,
  Idef0Concept,
  Idef0ConceptKind,
  Idef0DiagramModel,
  Idef0Function,
} from '@/shared/types/idef0';
import { IDEF0_CONCEPT_KIND_META } from './idef0-meta';

export const IDEF0_CANVAS_WORLD_SIZE = 6000;
export const IDEF0_FUNCTION_WIDTH = 240;
export const IDEF0_FUNCTION_HEIGHT = 128;
export const IDEF0_CONCEPT_WIDTH = 190;
export const IDEF0_CONCEPT_HEIGHT = 58;
const IDEF0_INLINE_NAME_MIN_INPUT_WIDTH = 96;
const IDEF0_INLINE_NAME_MAX_NODE_WIDTH = 640;
const IDEF0_INLINE_NAME_CHAR_WIDTH = 7.4;

export type Idef0NodeKind = 'function' | 'concept';
export type Idef0NodeSide = 'left' | 'top' | 'right' | 'bottom' | 'center';

export interface Idef0NodeRef {
  kind: Idef0NodeKind;
  id: string;
  side?: Idef0NodeSide;
}

export interface Idef0NodeBox {
  id: string;
  kind: Idef0NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Idef0PathGeometry {
  d: string;
  labelX: number;
  labelY: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export function getIdef0NodeId(ref: Idef0NodeRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function getIdef0FunctionSize(fn: Idef0Function) {
  return {
    width: fn.size?.width ?? IDEF0_FUNCTION_WIDTH,
    height: fn.size?.height ?? IDEF0_FUNCTION_HEIGHT,
  };
}

export function getIdef0ConceptSize(concept: Idef0Concept) {
  return {
    width: concept.size?.width ?? IDEF0_CONCEPT_WIDTH,
    height: concept.size?.height ?? IDEF0_CONCEPT_HEIGHT,
  };
}

function getInlineNameInputWidth(name: string) {
  const normalizedName = name.trim() || 'Function';
  return Math.max(
    IDEF0_INLINE_NAME_MIN_INPUT_WIDTH,
    Math.ceil(normalizedName.length * IDEF0_INLINE_NAME_CHAR_WIDTH + 24),
  );
}

export function getIdef0FunctionWidthForName(name: string, baseWidth = IDEF0_FUNCTION_WIDTH) {
  const headerPadding = 24;
  const iconWidth = 14;
  const gap = 8;
  return Math.min(
    IDEF0_INLINE_NAME_MAX_NODE_WIDTH,
    Math.max(baseWidth, headerPadding + iconWidth + gap + getInlineNameInputWidth(name)),
  );
}

export function getIdef0ConceptWidthForName(name: string, baseWidth = IDEF0_CONCEPT_WIDTH) {
  const bodyPadding = 24;
  const iconWidth = 24;
  const gap = 8;
  const handleClearance = 10;
  return Math.min(
    IDEF0_INLINE_NAME_MAX_NODE_WIDTH,
    Math.max(baseWidth, bodyPadding + iconWidth + gap + handleClearance + getInlineNameInputWidth(name)),
  );
}

export function getIdef0NodeBoxes(diagram: Idef0DiagramModel): Idef0NodeBox[] {
  return [
    ...diagram.functions.map((fn) => {
      const size = getIdef0FunctionSize(fn);
      return {
        id: fn.id,
        kind: 'function' as const,
        x: fn.position.x,
        y: fn.position.y,
        width: size.width,
        height: size.height,
      };
    }),
    ...diagram.concepts.map((concept) => {
      const size = getIdef0ConceptSize(concept);
      return {
        id: concept.id,
        kind: 'concept' as const,
        x: concept.position.x,
        y: concept.position.y,
        width: size.width,
        height: size.height,
      };
    }),
  ];
}

export function getIdef0DiagramBounds(diagram: Idef0DiagramModel) {
  const boxes = getIdef0NodeBoxes(diagram);
  if (boxes.length === 0) {
    return { minX: 0, minY: 0, maxX: 900, maxY: 640, width: 900, height: 640 };
  }

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getBoxCenter(box: Idef0NodeBox) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

export function getIdef0AnchorPoint(box: Idef0NodeBox, side: Idef0NodeSide = 'center') {
  if (side === 'left') return { x: box.x, y: box.y + box.height / 2 };
  if (side === 'top') return { x: box.x + box.width / 2, y: box.y };
  if (side === 'right') return { x: box.x + box.width, y: box.y + box.height / 2 };
  if (side === 'bottom') return { x: box.x + box.width / 2, y: box.y + box.height };
  return getBoxCenter(box);
}

function getEndpointSide(arrow: Idef0Arrow, endpoint: 'source' | 'target'): Idef0NodeSide {
  if (arrow.role === 'output') {
    return endpoint === 'source' ? 'right' : 'center';
  }
  if (endpoint === 'source') return 'center';
  if (arrow.role === 'input') return 'left';
  if (arrow.role === 'control') return 'top';
  return 'bottom';
}

export function getIdef0ArrowRoleLabel(role: Idef0ArrowRole): string {
  if (role === 'input') return 'Input';
  if (role === 'control') return 'Control';
  if (role === 'output') return 'Output';
  return 'Mechanism';
}

export function getDefaultConceptName(kind: Idef0ConceptKind): string {
  const label = IDEF0_CONCEPT_KIND_META[kind]?.label ?? 'Concept';
  return label;
}

export function getIdef0Path(arrow: Idef0Arrow, nodeBoxes: Map<string, Idef0NodeBox>): Idef0PathGeometry | null {
  if (!arrow.source.id || !arrow.target.id) return null;
  if (arrow.source.kind === 'boundary' || arrow.target.kind === 'boundary') return null;

  const sourceBox = nodeBoxes.get(getIdef0NodeId({ kind: arrow.source.kind, id: arrow.source.id }));
  const targetBox = nodeBoxes.get(getIdef0NodeId({ kind: arrow.target.kind, id: arrow.target.id }));
  if (!sourceBox || !targetBox) return null;

  const start = getIdef0AnchorPoint(sourceBox, getEndpointSide(arrow, 'source'));
  const end = getIdef0AnchorPoint(targetBox, getEndpointSide(arrow, 'target'));
  const dx = Math.max(80, Math.abs(end.x - start.x) * 0.42);
  const dy = Math.max(64, Math.abs(end.y - start.y) * 0.42);
  const vertical = arrow.role === 'control' || arrow.role === 'mechanism';
  const d = vertical
    ? `M ${start.x} ${start.y} C ${start.x} ${start.y + (end.y > start.y ? dy : -dy)}, ${end.x} ${end.y + (end.y > start.y ? -dy : dy)}, ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} C ${start.x + (end.x > start.x ? dx : -dx)} ${start.y}, ${end.x + (end.x > start.x ? -dx : dx)} ${end.y}, ${end.x} ${end.y}`;

  return {
    d,
    start,
    end,
    labelX: (start.x + end.x) / 2,
    labelY: (start.y + end.y) / 2 - 8,
  };
}

export function conceptKindSupportsRole(kind: Idef0ConceptKind, role: Idef0ArrowRole): boolean {
  if (role === 'control') return kind === 'rule';
  if (role === 'mechanism') return kind === 'actor' || kind === 'component';
  return kind === 'dataset'
    || kind === 'artifact'
    || kind === 'material_object'
    || kind === 'state'
    || kind === 'event';
}
