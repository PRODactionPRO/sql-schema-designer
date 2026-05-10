export const NO_DOMAIN_GROUP_ID = '__no_domain__';

export const SORT_OPTIONS = [
  { value: 'none', label: 'Manual' },
  { value: 'asc', label: 'A-Z' },
  { value: 'desc', label: 'Z-A' },
] as const;

export const GROUP_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'type', label: 'Type' },
  { value: 'none', label: 'None' },
] as const;

export const TABLE_KIND_TOGGLES = [
  { kind: 'table', label: 'SQL' },
  { kind: 'enum', label: 'Enum' },
  { kind: 'json', label: 'JSON' },
] as const;

export type SortMode = (typeof SORT_OPTIONS)[number]['value'];
export type GroupMode = (typeof GROUP_OPTIONS)[number]['value'];
export type TableKind = (typeof TABLE_KIND_TOGGLES)[number]['kind'];
export type FilterPopup = 'none' | 'group' | 'sort';

export const DEFAULT_SORT_MODE: SortMode = 'none';
export const DEFAULT_GROUP_MODE: GroupMode = 'domain';

export const DEFAULT_VISIBLE_KINDS: Record<TableKind, boolean> = {
  table: true,
  enum: true,
  json: true,
};

export function getSortModeLabel(mode: SortMode): string {
  return SORT_OPTIONS.find((opt) => opt.value === mode)?.label ?? 'Manual';
}

export function getGroupModeLabel(mode: GroupMode): string {
  return GROUP_OPTIONS.find((opt) => opt.value === mode)?.label ?? 'Domain';
}
