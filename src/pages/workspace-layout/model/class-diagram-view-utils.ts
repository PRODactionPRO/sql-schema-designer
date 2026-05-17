import type {
  ClassAttributeMultiplicity,
  ClassEntity,
  ClassEntityKind,
  ClassMemberVisibility,
  ClassRelation,
} from '@/shared/types/project';

export const CLASS_CARD_WIDTH = 300;
export const CLASS_HEADER_HEIGHT = 42;
export const CLASS_ROW_HEIGHT = 36;
export const CLASS_SECTION_HEIGHT = 36;
export const CLASS_CANVAS_WORLD_SIZE = 20000;

const CLASS_ENTITY_KIND_ORDER: ClassEntityKind[] = ['class', 'abstract-class', 'interface', 'enum', 'datatype'];

export const UML_METHOD_RETURN_TYPES = [
  'void',
  'Boolean',
  'Integer',
  'Real',
  'String',
  'Date',
  'DateTime',
  'UUID',
  'Object',
  'List',
  'Set',
  'Map',
  'Result',
] as const;

const CLASS_ENTITY_KIND_META: Record<ClassEntityKind, {
  label: string;
  shortLabel: string;
  color: string;
}> = {
  class: { label: 'Class', shortLabel: 'CLASS', color: '#ef4444' },
  'abstract-class': { label: 'Abstract', shortLabel: 'ABSTRACT', color: '#8b5cf6' },
  interface: { label: 'Interface', shortLabel: 'IFACE', color: '#2563eb' },
  enum: { label: 'Enum', shortLabel: 'ENUM', color: '#f59e0b' },
  datatype: { label: 'Data type', shortLabel: 'TYPE', color: '#0f766e' },
};

export function normalizeClassEntityKindValue(kind: ClassEntity['kind']): ClassEntityKind {
  return kind && CLASS_ENTITY_KIND_ORDER.includes(kind) ? kind : 'class';
}

export function getClassEntityKindMeta(kind: ClassEntity['kind']) {
  return CLASS_ENTITY_KIND_META[normalizeClassEntityKindValue(kind)];
}

export function classEntitySupportsAttributes(kind: ClassEntity['kind']): boolean {
  return normalizeClassEntityKindValue(kind) !== 'interface';
}

export function classEntitySupportsMethods(kind: ClassEntity['kind']): boolean {
  return normalizeClassEntityKindValue(kind) !== 'enum';
}

export function classEntityAttributeSectionLabel(kind: ClassEntity['kind']): string {
  const normalized = normalizeClassEntityKindValue(kind);
  if (normalized === 'enum') return 'Literals';
  if (normalized === 'datatype') return 'Properties';
  return 'Attributes';
}

export function classEntityMethodSectionLabel(kind: ClassEntity['kind']): string {
  return normalizeClassEntityKindValue(kind) === 'interface' ? 'Operations' : 'Methods';
}

export function classMethodReturnTypeOptions(classes: ClassEntity[]): string[] {
  const classifierTypes = classes
    .map((entity) => entity.name.trim())
    .filter(Boolean)
    .flatMap((name) => [name, `List<${name}>`]);

  return Array.from(new Set([...UML_METHOD_RETURN_TYPES, ...classifierTypes]));
}

export function visibilitySymbol(visibility: ClassMemberVisibility): string {
  if (visibility === 'private') return '-';
  if (visibility === 'protected') return '#';
  return '+';
}

function normalizeAttributeMultiplicityValue(value: ClassAttributeMultiplicity | undefined): ClassAttributeMultiplicity {
  return value === 'optional' || value === 'many' ? value : 'one';
}

export function attributeMultiplicityLabel(value: ClassAttributeMultiplicity | undefined): string {
  const normalized = normalizeAttributeMultiplicityValue(value);
  if (normalized === 'optional') return '0..1';
  if (normalized === 'many') return '0..*';
  return '1';
}

export function estimateClassCardHeight(entity: ClassEntity): number {
  const attributeHeight = classEntitySupportsAttributes(entity.kind)
    ? CLASS_SECTION_HEIGHT + CLASS_ROW_HEIGHT * Math.max(1, entity.attributes.length)
    : 0;
  const methodHeight = classEntitySupportsMethods(entity.kind)
    ? CLASS_SECTION_HEIGHT + CLASS_ROW_HEIGHT * Math.max(1, entity.methods.length)
    : 0;
  return CLASS_HEADER_HEIGHT + attributeHeight + methodHeight;
}

export function getClassDiagramBounds(classes: ClassEntity[]) {
  if (classes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: CLASS_CARD_WIDTH,
      maxY: CLASS_HEADER_HEIGHT,
      width: CLASS_CARD_WIDTH,
      height: CLASS_HEADER_HEIGHT,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const entity of classes) {
    minX = Math.min(minX, entity.position.x);
    minY = Math.min(minY, entity.position.y);
    maxX = Math.max(maxX, entity.position.x + CLASS_CARD_WIDTH);
    maxY = Math.max(maxY, entity.position.y + estimateClassCardHeight(entity));
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getClassRelationPath(
  relation: ClassRelation,
  classById: Map<string, ClassEntity>,
) {
  const source = classById.get(relation.fromClassId);
  const target = classById.get(relation.toClassId);
  if (!source || !target) return null;

  const sourceHeight = estimateClassCardHeight(source);
  const targetHeight = estimateClassCardHeight(target);
  const start = {
    x: source.position.x + CLASS_CARD_WIDTH / 2,
    y: source.position.y + sourceHeight / 2,
  };
  const end = {
    x: target.position.x + CLASS_CARD_WIDTH / 2,
    y: target.position.y + targetHeight / 2,
  };
  const midX = (start.x + end.x) / 2;

  return {
    d: `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`,
    labelX: midX + 8,
    labelY: (start.y + end.y) / 2 - 8,
  };
}
