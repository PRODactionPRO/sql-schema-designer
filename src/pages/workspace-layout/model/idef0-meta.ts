import type { Idef0ArrowRole, Idef0ConceptKind, Idef0FunctionStatus } from '@/shared/types/idef0';

export const IDEF0_ARROW_ROLE_META: Record<Idef0ArrowRole, { label: string; side: 'left' | 'top' | 'right' | 'bottom'; color: string }> = {
  input: { label: 'Input', side: 'left', color: '#2563eb' },
  control: { label: 'Control', side: 'top', color: '#7c3aed' },
  output: { label: 'Output', side: 'right', color: '#16a34a' },
  mechanism: { label: 'Mechanism', side: 'bottom', color: '#ea580c' },
};

export const IDEF0_FUNCTION_STATUS_META: Record<Idef0FunctionStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#94a3b8' },
  active: { label: 'Active', color: '#16a34a' },
  deprecated: { label: 'Deprecated', color: '#f59e0b' },
  archived: { label: 'Archived', color: '#64748b' },
};

export const IDEF0_CONCEPT_KIND_META: Record<Idef0ConceptKind, { label: string; group: 'Input/Output' | 'Control' | 'Mechanism'; color: string }> = {
  dataset: { label: 'Dataset', group: 'Input/Output', color: '#2563eb' },
  artifact: { label: 'Artifact', group: 'Input/Output', color: '#0ea5e9' },
  material_object: { label: 'Material object', group: 'Input/Output', color: '#475569' },
  state: { label: 'State', group: 'Input/Output', color: '#64748b' },
  event: { label: 'Event', group: 'Input/Output', color: '#16a34a' },
  rule: { label: 'Rule / constraint', group: 'Control', color: '#7c3aed' },
  actor: { label: 'Actor / role', group: 'Mechanism', color: '#ea580c' },
  component: { label: 'Component', group: 'Mechanism', color: '#dc2626' },
};
