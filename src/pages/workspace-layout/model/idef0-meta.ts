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

export const IDEF0_CONCEPT_KIND_META: Record<Idef0ConceptKind, { label: string; group: 'Information' | 'Governance' | 'Result' | 'Mechanism'; color: string }> = {
  information_object: { label: 'Information object', group: 'Information', color: '#2563eb' },
  document: { label: 'Document', group: 'Information', color: '#0ea5e9' },
  data_set: { label: 'Data set', group: 'Information', color: '#0284c7' },
  material_object: { label: 'Material object', group: 'Information', color: '#475569' },
  state: { label: 'State', group: 'Information', color: '#64748b' },
  business_rule: { label: 'Business rule', group: 'Governance', color: '#7c3aed' },
  requirement: { label: 'Requirement', group: 'Governance', color: '#9333ea' },
  standard: { label: 'Standard', group: 'Governance', color: '#6d28d9' },
  decision: { label: 'Decision', group: 'Result', color: '#0891b2' },
  condition: { label: 'Condition', group: 'Governance', color: '#a855f7' },
  schema_or_contract: { label: 'Schema or contract', group: 'Governance', color: '#4f46e5' },
  event: { label: 'Event', group: 'Result', color: '#16a34a' },
  state_change: { label: 'State change', group: 'Result', color: '#22c55e' },
  command_or_task: { label: 'Command or task', group: 'Result', color: '#65a30d' },
  artifact: { label: 'Artifact', group: 'Result', color: '#15803d' },
  role: { label: 'Role', group: 'Mechanism', color: '#ea580c' },
  team: { label: 'Team', group: 'Mechanism', color: '#f97316' },
  system: { label: 'System', group: 'Mechanism', color: '#dc2626' },
  component: { label: 'Component', group: 'Mechanism', color: '#b91c1c' },
  tool: { label: 'Tool', group: 'Mechanism', color: '#c2410c' },
  database_or_storage: { label: 'Database or storage', group: 'Mechanism', color: '#0f766e' },
  model_or_agent: { label: 'Model or agent', group: 'Mechanism', color: '#d97706' },
};
