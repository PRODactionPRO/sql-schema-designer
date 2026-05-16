import type { ClassEntityKind } from '@/shared/types/project';

export const ENTITY_KIND_META: Record<ClassEntityKind, { label: string; shortLabel: string; color: string }> = {
  class: { label: 'Class', shortLabel: 'class', color: '#64748b' },
  'abstract-class': { label: 'Abstract class', shortLabel: 'abstract', color: '#7c3aed' },
  interface: { label: 'Interface', shortLabel: 'interface', color: '#0ea5e9' },
  enum: { label: 'Enum', shortLabel: 'enum', color: '#0f766e' },
  datatype: { label: 'Datatype', shortLabel: 'type', color: '#ea580c' },
};
