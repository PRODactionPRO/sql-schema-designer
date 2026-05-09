import { create } from 'zustand';
import type { Table, Field, Relation, Schema, RelationType, Domain, EnumType, JsonSchemaDocument, JsonSchemaNode, JsonSchemaFieldType } from './types';
import { DOMAIN_COLORS } from './types';
import { getSerializer } from '../lib/serializers';
import { deepClone } from '@/shared/lib/json';
import { normalizeSchema } from '@/shared/lib/schema-normalizer';

// ── Types ──

export interface SchemaStoreInitialData {
  tables?: Table[];
  relations?: Relation[];
  domains?: Domain[];
  enums?: EnumType[];
  jsonSchemas?: JsonSchemaDocument[];
}

interface HistorySnapshot {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  jsonSchemas: JsonSchemaDocument[];
}

const MAX_HISTORY = 50;

// ── Default data ──

const DEFAULT_TABLES: Table[] = [
  {
    id: '1',
    name: 'user',
    position: { x: 100, y: 200 },
    color: '#ef4444',
    fields: [
      { id: 'f1', name: 'user_id', type: 'uuid', isPrimaryKey: true, isNullable: false, isForeignKey: false },
      { id: 'f2', name: 'first_name', type: 'varchar', isPrimaryKey: false, isNullable: true, isForeignKey: false },
      { id: 'f3', name: 'last_name', type: 'varchar', isPrimaryKey: false, isNullable: true, isForeignKey: false },
      { id: 'f4', name: 'email', type: 'varchar', isPrimaryKey: false, isNullable: true, isForeignKey: false },
      { id: 'f5', name: 'created_at', type: 'timestamptz', isPrimaryKey: false, isNullable: true, isForeignKey: false },
      { id: 'f6', name: 'updated_at', type: 'timestamptz', isPrimaryKey: false, isNullable: true, isForeignKey: false },
    ]
  },
  {
    id: '2',
    name: 'workspace',
    position: { x: 500, y: 100 },
    color: '#6366f1',
    fields: [
      { id: 'w1', name: 'id', type: 'bigint', isPrimaryKey: true, isNullable: false, isForeignKey: false },
    ]
  },
  {
    id: '3',
    name: 'brand',
    position: { x: 900, y: 200 },
    color: '#8b5cf6',
    fields: [
      { id: 'b1', name: 'id', type: 'bigint', isPrimaryKey: true, isNullable: false, isForeignKey: false },
    ]
  },
  {
    id: '4',
    name: 'topics',
    position: { x: 1000, y: 400 },
    color: '#3b82f6',
    fields: [
      { id: 't1', name: 'id', type: 'bigint', isPrimaryKey: true, isNullable: false, isForeignKey: false },
    ]
  },
];

const DEFAULT_RELATIONS: Relation[] = [
  { id: 'r1', fromTableId: '1', fromFieldId: 'f1', toTableId: '2', toFieldId: 'w1', type: '1:N' },
  { id: 'r2', fromTableId: '2', fromFieldId: 'w1', toTableId: '3', toFieldId: 'b1', type: '1:N' },
  { id: 'r3', fromTableId: '3', fromFieldId: 'b1', toTableId: '4', toFieldId: 't1', type: '1:N' },
];

// ── Store interface ──

interface SchemaState {
  // Data (tracked by undo/redo)
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  jsonSchemas: JsonSchemaDocument[];

  // UI state (not tracked)
  selectedTableId: string | null;
  selectedTableIds: Set<string>;
  selectedRelation: Relation | null;

  // History
  _past: HistorySnapshot[];
  _future: HistorySnapshot[];

  // Initialization
  initialize: (data?: SchemaStoreInitialData) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // UI selection
  setSelectedTableId: (id: string | null) => void;
  setSelectedRelation: (rel: Relation | null) => void;
  setSelectedTableIds: (ids: Set<string>) => void;

  // Table CRUD
  addTable: (name: string, position?: { x: number; y: number }) => void;
  updateTablePosition: (id: string, position: { x: number; y: number }) => void;
  updateTableName: (id: string, name: string) => void;
  updateTableDescription: (id: string, description: string) => void;
  updateTableDomain: (tableId: string, domainId: string | undefined) => void;
  deleteTable: (id: string) => void;
  deleteTables: (ids: string[]) => void;

  // Field CRUD
  addField: (tableId: string, field: Omit<Field, 'id'>) => string;
  updateField: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  deleteField: (tableId: string, fieldId: string) => void;
  reorderField: (tableId: string, fromIndex: number, toIndex: number) => void;

  // Relation CRUD
  addRelation: (relation: Omit<Relation, 'id'>) => void;
  updateRelation: (id: string, type: RelationType) => void;
  deleteRelation: (id: string) => void;

  // Domain CRUD
  addDomain: (name: string) => Domain;
  updateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  deleteDomain: (id: string) => void;
  assignDomainToTables: (domainId: string, tableIds: string[]) => void;
  reorderDomains: (orderedIds: string[]) => void;

  // Enum CRUD
  addEnum: (name: string, values?: string[], position?: { x: number; y: number }) => EnumType;
  updateEnum: (id: string, updates: Partial<Omit<EnumType, 'id'>>) => void;
  deleteEnum: (id: string) => void;
  updateEnumPosition: (id: string, position: { x: number; y: number }) => void;
  reorderEnumValues: (id: string, fromIndex: number, toIndex: number) => void;
  reorderEnums: (orderedIds: string[]) => void;

  // JSON Schema CRUD (MVP bootstrap)
  addJsonSchema: (name: string, position?: { x: number; y: number }) => JsonSchemaDocument;
  updateJsonSchema: (id: string, updates: Partial<Omit<JsonSchemaDocument, 'id'>>) => void;
  deleteJsonSchema: (id: string) => void;
  updateJsonSchemaPosition: (id: string, position: { x: number; y: number }) => void;
  addJsonSchemaNode: (docId: string, parentId?: string) => void;
  updateJsonSchemaNode: (docId: string, nodeId: string, updates: Partial<JsonSchemaNode>) => void;
  deleteJsonSchemaNode: (docId: string, nodeId: string) => void;
  toggleJsonSchemaNodeCollapsed: (docId: string, nodeId: string) => void;
  moveJsonSchemaNode: (docId: string, nodeId: string, targetParentId: string | undefined, targetOrder: number) => void;
  reorderJsonSchemas: (orderedIds: string[]) => void;

  // Multi-select
  toggleTableSelection: (id: string, additive: boolean) => void;
  selectTablesInRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  clearMultiSelection: () => void;
  moveSelectedTables: (dx: number, dy: number) => void;
  reorderTables: (orderedIds: string[]) => void;
  reorderSidebarEntities: (orderedIds: string[]) => void;

  // History helper (push snapshot without data change — e.g. after drag-end)
  pushHistory: () => void;

  // Layout
  autoLayout: () => void;

  // Import/Export
  exportToFormat: (formatId: string) => string;
  importFromFormat: (formatId: string, content: string) => void;
  exportSelectionForClipboard: (tableIds: string[], enumIds?: string[], jsonSchemaIds?: string[]) => string | null;
  importSelectionFromClipboard: (content: string, offset?: { x: number; y: number }) => { insertedTableIds: string[]; insertedEnumIds: string[]; insertedJsonSchemaIds: string[]; tables: number; enums: number; jsonSchemas: number; relations: number } | null;

  // Helpers
  getTableColor: (table: Table) => string;
}

// ── Helpers ──

function snapshot(state: { tables: Table[]; relations: Relation[]; domains: Domain[]; enums: EnumType[]; jsonSchemas: JsonSchemaDocument[] }): HistorySnapshot {
  return {
    tables: deepClone(state.tables),
    relations: deepClone(state.relations),
    domains: deepClone(state.domains),
    enums: deepClone(state.enums),
    jsonSchemas: deepClone(state.jsonSchemas),
  };
}

function withHistory(
  state: Pick<SchemaState, 'tables' | 'relations' | 'domains' | 'enums' | 'jsonSchemas' | '_past'>,
  next: Partial<SchemaState>,
): Partial<SchemaState> {
  const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
  return { ...next, _past: past, _future: [] };
}

let _idCounter = Date.now();
function nextId(): string {
  return (++_idCounter).toString();
}

function getNextSidebarOrder(state: Pick<SchemaState, 'tables' | 'enums' | 'jsonSchemas'>): number {
  const orders = [
    ...state.tables.map((t) => t.sidebarOrder ?? 0),
    ...state.enums.map((e) => e.sidebarOrder ?? 0),
    ...state.jsonSchemas.map((d) => d.sidebarOrder ?? 0),
  ];
  return (orders.length > 0 ? Math.max(...orders) : 0) + 1;
}

const CLIPBOARD_SCHEMA_TYPE = 'prodsql/canvas-selection';
const CLIPBOARD_SCHEMA_VERSION = 1;

interface ClipboardSelectionPayload {
  type: typeof CLIPBOARD_SCHEMA_TYPE;
  version: typeof CLIPBOARD_SCHEMA_VERSION;
  tables: Table[];
  relations: Relation[];
  enums: EnumType[];
  jsonSchemas: JsonSchemaDocument[];
}

function getUniqueTableName(baseName: string, usedNames: Set<string>): string {
  const cleanBase = baseName.trim() || 'table';
  let candidate = cleanBase;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${cleanBase}_${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

// ── Store ──

export const useSchemaStore = create<SchemaState>()((set, get) => ({
  // Initial state
  tables: DEFAULT_TABLES,
  relations: DEFAULT_RELATIONS,
  domains: [],
  enums: [],
  jsonSchemas: [],
  selectedTableId: DEFAULT_TABLES[0]?.id ?? null,
  selectedTableIds: new Set<string>(),
  selectedRelation: null,
  _past: [],
  _future: [],

  // ── Initialization ──
  initialize: (data?: SchemaStoreInitialData) => {
    const normalized = normalizeSchema({
      tables: data?.tables ?? DEFAULT_TABLES,
      relations: data?.relations ?? DEFAULT_RELATIONS,
      domains: data?.domains ?? [],
      enums: data?.enums ?? [],
      jsonSchemas: data?.jsonSchemas ?? [],
    });
    const tables = normalized.tables;
    const relations = normalized.relations;
    const domains = normalized.domains ?? [];
    const enums = normalized.enums ?? [];
    const jsonSchemas = normalized.jsonSchemas ?? [];
    set({
      tables,
      relations,
      domains,
      enums,
      jsonSchemas,
      selectedTableId: tables.length > 0 ? tables[0]?.id ?? null : null,
      selectedTableIds: new Set(),
      selectedRelation: null,
      _past: [],
      _future: [],
    });
  },

  // ── Undo / Redo ──
  undo: () => {
    const { _past, _future, tables, relations, domains, enums, jsonSchemas } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    set({
      tables: prev.tables,
      relations: prev.relations,
      domains: prev.domains,
      enums: prev.enums,
      jsonSchemas: prev.jsonSchemas,
      _past: _past.slice(0, -1),
      _future: [..._future, snapshot({ tables, relations, domains, enums, jsonSchemas })],
    });
  },

  redo: () => {
    const { _past, _future, tables, relations, domains, enums, jsonSchemas } = get();
    if (_future.length === 0) return;
    const next = _future[_future.length - 1];
    set({
      tables: next.tables,
      relations: next.relations,
      domains: next.domains,
      enums: next.enums,
      jsonSchemas: next.jsonSchemas,
      _past: [..._past, snapshot({ tables, relations, domains, enums, jsonSchemas })],
      _future: _future.slice(0, -1),
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,

  // ── Selection (no history) ──
  setSelectedTableId: (id) => set({ selectedTableId: id }),
  setSelectedRelation: (rel) => set({ selectedRelation: rel }),
  setSelectedTableIds: (ids) => set({ selectedTableIds: ids }),

  // ── Table CRUD ──
  addTable: (name, position) => {
    const state = get();
    // Deduplicate name
    let finalName = name;
    const nameExists = (n: string) => state.tables.some(t => t.name.toLowerCase() === n.toLowerCase());
    if (nameExists(finalName)) {
      let suffix = 2;
      while (nameExists(`${name}_${suffix}`)) suffix++;
      finalName = `${name}_${suffix}`;
    }
    const newTable: Table = {
      id: nextId(),
      name: finalName,
      fields: [{
        id: `${nextId()}-id`,
        name: 'id',
        type: 'bigint',
        isPrimaryKey: true,
        isNullable: false,
        isForeignKey: false,
      }],
      position: position || { x: 100, y: 100 },
      sidebarOrder: getNextSidebarOrder(state),
    };
    set(withHistory(state, {
      tables: [...state.tables, newTable],
      selectedTableId: newTable.id,
    }));
  },

  updateTablePosition: (id, position) => {
    // Position updates are frequent (drag) — no history push to avoid spam.
    // History is pushed on drag-end via a separate mechanism (or we skip it).
    set(state => ({
      tables: state.tables.map(t => t.id === id ? { ...t, position } : t),
    }));
  },

  updateTableName: (id, name) => {
    const state = get();
    // Prevent duplicate names (case-insensitive, excluding self)
    let finalName = name;
    const nameExists = (n: string) => state.tables.some(t => t.id !== id && t.name.toLowerCase() === n.toLowerCase());
    if (nameExists(finalName)) {
      let suffix = 2;
      while (nameExists(`${name}_${suffix}`)) suffix++;
      finalName = `${name}_${suffix}`;
    }
    set(withHistory(state, {
      tables: state.tables.map(t => t.id === id ? { ...t, name: finalName } : t),
    }));
  },

  updateTableDescription: (id, description) => {
    const state = get();
    set(withHistory(state, {
      tables: state.tables.map(t => t.id === id ? { ...t, description } : t),
    }));
  },

  updateTableDomain: (tableId, domainId) => {
    const state = get();
    set(withHistory(state, {
      tables: state.tables.map(t => {
        if (t.id !== tableId) return t;
        if (!domainId) return { ...t, domainId: undefined, color: undefined };
        return { ...t, domainId };
      }),
    }));
  },

  deleteTable: (id) => {
    const state = get();
    const newSelectedTableIds = new Set(state.selectedTableIds);
    newSelectedTableIds.delete(id);
    set(withHistory(state, {
      tables: state.tables.filter(t => t.id !== id),
      relations: state.relations.filter(r => r.fromTableId !== id && r.toTableId !== id),
      selectedTableId: state.selectedTableId === id ? null : state.selectedTableId,
      selectedTableIds: newSelectedTableIds,
    }));
  },

  deleteTables: (ids) => {
    const state = get();
    const idSet = new Set(ids);
    set(withHistory(state, {
      tables: state.tables.filter(t => !idSet.has(t.id)),
      relations: state.relations.filter(r => !idSet.has(r.fromTableId) && !idSet.has(r.toTableId)),
      selectedTableId: state.selectedTableId && idSet.has(state.selectedTableId) ? null : state.selectedTableId,
      selectedTableIds: new Set(),
    }));
  },

  // ── Field CRUD ──
  addField: (tableId, field) => {
    const state = get();
    const newField: Field = { ...field, id: nextId() };
    set(withHistory(state, {
      tables: state.tables.map(t =>
        t.id === tableId ? { ...t, fields: [...t.fields, newField] } : t
      ),
    }));
    return newField.id;
  },

  updateField: (tableId, fieldId, updates) => {
    const state = get();
    const normalizedUpdates: Partial<Field> = { ...updates };
    if (normalizedUpdates.type && normalizedUpdates.type !== 'enum') {
      normalizedUpdates.enumId = undefined;
      normalizedUpdates.enumName = undefined;
    }
    if (normalizedUpdates.type && normalizedUpdates.type !== 'json' && normalizedUpdates.type !== 'jsonb') {
      normalizedUpdates.jsonSchemaId = undefined;
      normalizedUpdates.jsonSchemaName = undefined;
    }
    if (normalizedUpdates.type === 'enum') {
      if (normalizedUpdates.enumId) {
        const enumType = state.enums.find(e => e.id === normalizedUpdates.enumId);
        normalizedUpdates.enumName = enumType?.name;
      } else if (normalizedUpdates.enumName) {
        const enumType = state.enums.find(e => e.name.toLowerCase() === normalizedUpdates.enumName?.toLowerCase());
        normalizedUpdates.enumId = enumType?.id;
      }
    }
    set(withHistory(state, {
      tables: state.tables.map(t =>
        t.id === tableId
          ? { ...t, fields: t.fields.map(f => f.id === fieldId ? { ...f, ...normalizedUpdates } : f) }
          : t
      ),
    }));
  },

  deleteField: (tableId, fieldId) => {
    const state = get();
    set(withHistory(state, {
      tables: state.tables.map(t =>
        t.id === tableId ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) } : t
      ),
      relations: state.relations.filter(r => r.fromFieldId !== fieldId && r.toFieldId !== fieldId),
    }));
  },

  reorderField: (tableId, fromIndex, toIndex) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (!table) return;
    if (
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= table.fields.length ||
      toIndex >= table.fields.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const nextFields = [...table.fields];
    const [moved] = nextFields.splice(fromIndex, 1);
    nextFields.splice(toIndex, 0, moved);

    set(withHistory(state, {
      tables: state.tables.map((t) => (t.id === tableId ? { ...t, fields: nextFields } : t)),
    }));
  },

  // ── Relation CRUD ──
  addRelation: (relation) => {
    const state = get();
    const newRelation: Relation = { ...relation, id: nextId() };
    set(withHistory(state, {
      relations: [...state.relations, newRelation],
    }));
  },

  updateRelation: (id, type) => {
    const state = get();
    set(withHistory(state, {
      relations: state.relations.map(r => r.id === id ? { ...r, type } : r),
    }));
  },

  deleteRelation: (id) => {
    const state = get();
    set(withHistory(state, {
      relations: state.relations.filter(r => r.id !== id),
      selectedRelation: state.selectedRelation?.id === id ? null : state.selectedRelation,
    }));
  },

  // ── Domain CRUD ──
  addDomain: (name) => {
    const state = get();
    const usedColors = new Set(state.domains.map(d => d.color));
    const color = DOMAIN_COLORS.find(c => !usedColors.has(c)) || DOMAIN_COLORS[state.domains.length % DOMAIN_COLORS.length];
    const newDomain: Domain = { id: nextId(), name, color };
    set(withHistory(state, {
      domains: [...state.domains, newDomain],
    }));
    return newDomain;
  },

  updateDomain: (id, updates) => {
    const state = get();
    set(withHistory(state, {
      domains: state.domains.map(d => d.id === id ? { ...d, ...updates } : d),
    }));
  },

  deleteDomain: (id) => {
    const state = get();
    set(withHistory(state, {
      domains: state.domains.filter(d => d.id !== id),
      tables: state.tables.map(t => t.domainId === id ? { ...t, domainId: undefined } : t),
    }));
  },

  assignDomainToTables: (domainId, tableIds) => {
    const state = get();
    const idSet = new Set(tableIds);
    set(withHistory(state, {
      tables: state.tables.map(t => idSet.has(t.id) ? { ...t, domainId } : t),
    }));
  },

  reorderDomains: (orderedIds) => {
    const state = get();
    const current = state.domains;
    const idSet = new Set(current.map((d) => d.id));
    const uniqueOrdered = orderedIds.filter((id, idx) => idSet.has(id) && orderedIds.indexOf(id) === idx);
    if (uniqueOrdered.length === 0) return;
    const byId = new Map(current.map((d) => [d.id, d] as const));
    const next = uniqueOrdered.map((id) => byId.get(id)).filter((d): d is Domain => !!d);
    for (const d of current) {
      if (!uniqueOrdered.includes(d.id)) next.push(d);
    }
    set(withHistory(state, { domains: next }));
  },

  // ── Enum CRUD ──
  addEnum: (name, values = [], position) => {
    const state = get();
    const existingNames = new Set(state.enums.map(e => e.name.toLowerCase()));
    let finalName = name.trim() || 'Enum';
    if (existingNames.has(finalName.toLowerCase())) {
      let suffix = 2;
      while (existingNames.has(`${finalName}_${suffix}`.toLowerCase())) suffix += 1;
      finalName = `${finalName}_${suffix}`;
    }
    const uniqueValues = Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
    const nextEnum: EnumType = {
      id: nextId(),
      name: finalName,
      values: uniqueValues,
      valueComments: uniqueValues.map(() => undefined),
      position: position || { x: 260, y: 140 },
      sidebarOrder: getNextSidebarOrder(state),
    };
    set(withHistory(state, {
      enums: [...state.enums, nextEnum],
    }));
    return nextEnum;
  },

  updateEnum: (id, updates) => {
    const state = get();
    const prevEnum = state.enums.find(e => e.id === id);
    if (!prevEnum) return;
    const nextNameRaw = updates.name?.trim();
    const nextName = nextNameRaw && nextNameRaw.length > 0 ? nextNameRaw : prevEnum.name;
    let uniqueValues = prevEnum.values;
    let uniqueComments = [...(prevEnum.valueComments ?? prevEnum.values.map(() => undefined))];
    if (updates.values) {
      const prevComments = prevEnum.valueComments ?? prevEnum.values.map(() => undefined);
      const incomingComments = updates.valueComments ?? updates.values.map((_, idx) => prevComments[idx]);
      const valueCommentPairs = updates.values
        .map((v, idx) => ({ value: v.trim(), comment: (incomingComments[idx] ?? '').trim() || undefined }))
        .filter((item) => item.value.length > 0);
      const seen = new Set<string>();
      uniqueValues = [];
      uniqueComments = [];
      for (const item of valueCommentPairs) {
        if (seen.has(item.value)) continue;
        seen.add(item.value);
        uniqueValues.push(item.value);
        uniqueComments.push(item.comment);
      }
    }

    set(withHistory(state, {
      enums: state.enums.map(e => e.id === id ? { ...e, ...updates, name: nextName, values: uniqueValues, valueComments: uniqueComments } : e),
      tables: state.tables.map(table => ({
        ...table,
        fields: table.fields.map(field => {
          if (field.enumId !== id) return field;
          return { ...field, enumName: nextName };
        }),
      })),
    }));
  },

  deleteEnum: (id) => {
    const state = get();
    const enumFieldIds = new Set(
      state.tables.flatMap(table => table.fields.filter(field => field.enumId === id).map(field => field.id)),
    );
    set(withHistory(state, {
      enums: state.enums.filter(e => e.id !== id),
      tables: state.tables.map(table => ({
        ...table,
        fields: table.fields.map(field => {
          if (field.enumId !== id) return field;
          return { ...field, type: 'varchar', enumId: undefined, enumName: undefined, isForeignKey: false, foreignKeyField: undefined, foreignKeyTable: undefined };
        }),
      })),
      relations: state.relations.filter(rel => !enumFieldIds.has(rel.fromFieldId) && !enumFieldIds.has(rel.toFieldId)),
    }));
  },

  updateEnumPosition: (id, position) => {
    set(state => ({
      enums: state.enums.map((e) => (e.id === id ? { ...e, position } : e)),
    }));
  },

  reorderEnumValues: (id, fromIndex, toIndex) => {
    const state = get();
    const enumType = state.enums.find((e) => e.id === id);
    if (!enumType) return;
    if (
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= enumType.values.length ||
      toIndex >= enumType.values.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextValues = [...enumType.values];
    const nextComments = [...(enumType.valueComments ?? enumType.values.map(() => undefined))];
    const [moved] = nextValues.splice(fromIndex, 1);
    const [movedComment] = nextComments.splice(fromIndex, 1);
    nextValues.splice(toIndex, 0, moved);
    nextComments.splice(toIndex, 0, movedComment);
    set(withHistory(state, {
      enums: state.enums.map((e) => (e.id === id ? { ...e, values: nextValues, valueComments: nextComments } : e)),
    }));
  },

  reorderEnums: (orderedIds) => {
    set((state) => {
      const enumMap = new Map(state.enums.map((e) => [e.id, e]));
      const reordered: EnumType[] = [];
      for (const id of orderedIds) {
        const item = enumMap.get(id);
        if (item) {
          reordered.push(item);
          enumMap.delete(id);
        }
      }
      for (const item of enumMap.values()) reordered.push(item);
      return { enums: reordered };
    });
  },

  // ── JSON Schema CRUD ──
  addJsonSchema: (name, position) => {
    const state = get();
    const existingNames = new Set(state.jsonSchemas.map((d) => d.name.toLowerCase()));
    let finalName = name.trim() || 'json_schema';
    if (existingNames.has(finalName.toLowerCase())) {
      let suffix = 2;
      while (existingNames.has(`${finalName}_${suffix}`.toLowerCase())) suffix += 1;
      finalName = `${finalName}_${suffix}`;
    }
    const id = nextId();
    const rootNodeId = nextId();
    const doc: JsonSchemaDocument = {
      id,
      name: finalName,
      position: position || { x: 320, y: 220 },
      sidebarOrder: getNextSidebarOrder(state),
      nodes: [
        {
          id: rootNodeId,
          name: 'root',
          type: 'object',
          order: 0,
          required: false,
          nullable: true,
          collapsed: false,
        },
      ],
    };
    set(withHistory(state, {
      jsonSchemas: [...state.jsonSchemas, doc],
    }));
    return doc;
  },

  updateJsonSchema: (id, updates) => {
    const state = get();
    const previous = state.jsonSchemas.find((doc) => doc.id === id);
    if (!previous) return;
    const nextNameRaw = updates.name?.trim();
    const nextName = nextNameRaw && nextNameRaw.length > 0 ? nextNameRaw : previous.name;
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((doc) => (doc.id === id ? { ...doc, ...updates, name: nextName } : doc)),
    }));
  },

  deleteJsonSchema: (id) => {
    const state = get();
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.filter((doc) => doc.id !== id),
    }));
  },

  updateJsonSchemaPosition: (id, position) => {
    set((state) => ({
      jsonSchemas: state.jsonSchemas.map((doc) => (doc.id === id ? { ...doc, position } : doc)),
    }));
  },

  addJsonSchemaNode: (docId, parentId) => {
    const state = get();
    const doc = state.jsonSchemas.find((item) => item.id === docId);
    if (!doc) return;
    const siblings = doc.nodes.filter((node) => node.parentId === parentId);
    const nextOrder = siblings.length;
    const parentNode = parentId ? doc.nodes.find((node) => node.id === parentId) : null;
    const preferredType: JsonSchemaFieldType = parentNode?.type === 'array' ? 'object' : 'string';
    const newNode: JsonSchemaNode = {
      id: nextId(),
      name: `field_${doc.nodes.length + 1}`,
      type: preferredType,
      parentId,
      order: nextOrder,
      required: false,
      nullable: true,
      collapsed: false,
    };
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((item) => (
        item.id === docId
          ? { ...item, nodes: [...item.nodes, newNode] }
          : item
      )),
    }));
  },

  updateJsonSchemaNode: (docId, nodeId, updates) => {
    const state = get();
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((doc) => {
        if (doc.id !== docId) return doc;
        const nextNodes = doc.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const merged = { ...node, ...updates };
          if (merged.type !== 'object' && merged.type !== 'array') {
            merged.collapsed = false;
          }
          return merged;
        });
        return { ...doc, nodes: nextNodes };
      }),
    }));
  },

  deleteJsonSchemaNode: (docId, nodeId) => {
    const state = get();
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((doc) => {
        if (doc.id !== docId) return doc;
        const idsToDelete = new Set<string>([nodeId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const node of doc.nodes) {
            if (node.parentId && idsToDelete.has(node.parentId) && !idsToDelete.has(node.id)) {
              idsToDelete.add(node.id);
              changed = true;
            }
          }
        }
        const nextNodes = doc.nodes
          .filter((node) => !idsToDelete.has(node.id))
          .map((node, index) => ({ ...node, order: index }));
        return { ...doc, nodes: nextNodes };
      }),
    }));
  },

  toggleJsonSchemaNodeCollapsed: (docId, nodeId) => {
    const state = get();
    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((doc) => {
        if (doc.id !== docId) return doc;
        return {
          ...doc,
          nodes: doc.nodes.map((node) => (
            node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node
          )),
        };
      }),
    }));
  },

  moveJsonSchemaNode: (docId, nodeId, targetParentId, targetOrder) => {
    const state = get();
    const doc = state.jsonSchemas.find((item) => item.id === docId);
    if (!doc) return;
    const sourceNode = doc.nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    if (nodeId === targetParentId) return;

    // Cannot move a node into one of its descendants.
    const descendants = new Set<string>();
    let changed = true;
    descendants.add(nodeId);
    while (changed) {
      changed = false;
      for (const node of doc.nodes) {
        if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
          descendants.add(node.id);
          changed = true;
        }
      }
    }
    if (targetParentId && descendants.has(targetParentId)) return;

    const normalizedTargetOrder = Math.max(0, targetOrder);

    const nextNodes = doc.nodes.map((node) => ({ ...node }));
    const moving = nextNodes.find((node) => node.id === nodeId);
    if (!moving) return;

    const sourceParentId = moving.parentId;
    moving.parentId = targetParentId;

    const sourceSiblings = nextNodes
      .filter((node) => node.parentId === sourceParentId && node.id !== moving.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sourceSiblings.forEach((node, index) => {
      node.order = index;
    });

    const targetSiblings = nextNodes
      .filter((node) => node.parentId === targetParentId && node.id !== moving.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const insertAt = Math.min(normalizedTargetOrder, targetSiblings.length);
    targetSiblings.splice(insertAt, 0, moving);
    targetSiblings.forEach((node, index) => {
      node.order = index;
    });

    set(withHistory(state, {
      jsonSchemas: state.jsonSchemas.map((item) => (item.id === docId ? { ...item, nodes: nextNodes } : item)),
    }));
  },

  reorderJsonSchemas: (orderedIds) => {
    set((state) => {
      const docMap = new Map(state.jsonSchemas.map((d) => [d.id, d]));
      const reordered: JsonSchemaDocument[] = [];
      for (const id of orderedIds) {
        const item = docMap.get(id);
        if (item) {
          reordered.push(item);
          docMap.delete(id);
        }
      }
      for (const item of docMap.values()) reordered.push(item);
      return { jsonSchemas: reordered };
    });
  },

  // ── Multi-select (no history) ──
  toggleTableSelection: (id, additive) => {
    set(state => {
      const next = new Set(additive ? state.selectedTableIds : []);

      // If user starts additive selection from a single selected table,
      // promote that anchor table into the multi-selection set.
      if (additive && state.selectedTableId && !next.has(state.selectedTableId)) {
        next.add(state.selectedTableId);
      }

      if (state.selectedTableIds.has(id) && additive) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedTableIds: next };
    });
  },

  selectTablesInRect: (rect) => {
    const { tables } = get();
    const selected = new Set<string>();
    for (const table of tables) {
      const tx = table.position.x;
      const ty = table.position.y;
      const tw = 280;
      const th = 40 + table.fields.length * 36;
      if (tx < rect.x + rect.w && tx + tw > rect.x && ty < rect.y + rect.h && ty + th > rect.y) {
        selected.add(table.id);
      }
    }
    set({ selectedTableIds: selected });
  },

  clearMultiSelection: () => set({ selectedTableIds: new Set(), selectedTableId: null }),

  moveSelectedTables: (dx, dy) => {
    // No individual history push — called during drag. History can be pushed on drag-end.
    const { selectedTableIds } = get();
    set(state => ({
      tables: state.tables.map(t =>
        selectedTableIds.has(t.id)
          ? { ...t, position: { x: t.position.x + dx, y: t.position.y + dy } }
          : t
      ),
    }));
  },

  reorderTables: (orderedIds) => {
    set(state => {
      const tableMap = new Map(state.tables.map(t => [t.id, t]));
      const reordered: Table[] = [];
      for (const id of orderedIds) {
        const t = tableMap.get(id);
        if (t) { reordered.push(t); tableMap.delete(id); }
      }
      for (const t of tableMap.values()) reordered.push(t);
      return { tables: reordered };
    });
  },

  reorderSidebarEntities: (orderedIds) => {
    const state = get();
    const orderById = new Map<string, number>();
    orderedIds.forEach((id, index) => orderById.set(id, index));
    const fallbackBase = orderedIds.length;

    const nextTables = state.tables.map((table) => ({
      ...table,
      sidebarOrder: orderById.get(table.id) ?? table.sidebarOrder ?? fallbackBase,
    }));
    const nextEnums = state.enums.map((enumType) => ({
      ...enumType,
      sidebarOrder: orderById.get(`enum::${enumType.id}`) ?? enumType.sidebarOrder ?? fallbackBase,
    }));
    const nextJsonSchemas = state.jsonSchemas.map((doc) => ({
      ...doc,
      sidebarOrder: orderById.get(`jsonschema::${doc.id}`) ?? doc.sidebarOrder ?? fallbackBase,
    }));

    set(withHistory(state, {
      tables: nextTables,
      enums: nextEnums,
      jsonSchemas: nextJsonSchemas,
    }));
  },

  // ── History helper (push snapshot without data change — e.g. after drag-end) ──
  pushHistory: () => {
    const state = get();
    set(withHistory(state, {}));
  },

  // ── Auto-layout ──
  autoLayout: () => {
    const state = get();
    const { tables, relations, domains } = state;
    if (tables.length === 0) return;

    // Group tables by domain
    const domainGroups = new Map<string, string[]>();
    const noDomainTables: string[] = [];
    tables.forEach(t => {
      if (t.domainId) {
        const group = domainGroups.get(t.domainId) || [];
        group.push(t.id);
        domainGroups.set(t.domainId, group);
      } else {
        noDomainTables.push(t.id);
      }
    });

    const TABLE_W = 280;
    const COL_GAP = 60;
    const ROW_GAP = 120;
    const START_X = 80;
    const START_Y = 80;

    const newPositions = new Map<string, { x: number; y: number }>();
    let currentY = START_Y;

    // Domain tables → horizontal row per domain
    const sortedDomainIds = domains.map(d => d.id).filter(id => domainGroups.has(id));

    for (const domainId of sortedDomainIds) {
      const tableIds = domainGroups.get(domainId)!;
      let maxTableHeight = 0;
      tableIds.forEach((tableId, colIdx) => {
        const table = tables.find(t => t.id === tableId);
        const height = table ? 44 + table.fields.length * 36 + 20 : 120;
        maxTableHeight = Math.max(maxTableHeight, height);
        newPositions.set(tableId, { x: START_X + colIdx * (TABLE_W + COL_GAP), y: currentY });
      });
      currentY += maxTableHeight + ROW_GAP;
    }

    // No-domain tables → also horizontal row
    if (noDomainTables.length > 0) {
      let maxTableHeight = 0;
      noDomainTables.forEach((tableId, colIdx) => {
        const table = tables.find(t => t.id === tableId);
        const height = table ? 44 + table.fields.length * 36 + 20 : 120;
        maxTableHeight = Math.max(maxTableHeight, height);
        newPositions.set(tableId, { x: START_X + colIdx * (TABLE_W + COL_GAP), y: currentY });
      });
    }

    set(withHistory(state, {
      tables: tables.map(t => {
        const pos = newPositions.get(t.id);
        return pos ? { ...t, position: pos } : t;
      }),
    }));
  },

  // ─ Import/Export ──
  exportToFormat: (formatId) => {
    const { tables, relations, domains, enums, jsonSchemas } = get();
    const schema: Schema = { tables, relations, domains, enums, jsonSchemas };
    const serializer = getSerializer(formatId);
    if (!serializer) throw new Error(`Unknown format: ${formatId}`);
    return serializer.serialize(schema);
  },

  importFromFormat: (formatId, content) => {
    const state = get();
    const serializer = getSerializer(formatId);
    if (!serializer) throw new Error(`Unknown format: ${formatId}`);
    const schema = normalizeSchema(serializer.deserialize(content));
    // Deduplicate tables by id (safety net for parsers)
    const seenIds = new Set<string>();
    const dedupedTables = schema.tables.filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });
    // Deduplicate tables by name (case-insensitive) — keep first, rename subsequent
    const seenNames = new Set<string>();
    for (const t of dedupedTables) {
      const lower = t.name.toLowerCase();
      if (seenNames.has(lower)) {
        let suffix = 2;
        while (seenNames.has(`${t.name.toLowerCase()}_${suffix}`)) suffix++;
        t.name = `${t.name}_${suffix}`;
        seenNames.add(t.name.toLowerCase());
      } else {
        seenNames.add(lower);
      }
    }
    set(withHistory(state, {
      tables: dedupedTables,
      relations: schema.relations,
      domains: schema.domains ?? state.domains,
      enums: schema.enums ?? state.enums,
      jsonSchemas: schema.jsonSchemas ?? state.jsonSchemas,
      selectedTableId: dedupedTables.length > 0 ? dedupedTables[0].id : null,
      selectedRelation: null,
      selectedTableIds: new Set(),
    }));
  },

  exportSelectionForClipboard: (tableIds, enumIds = [], jsonSchemaIds = []) => {
    const { tables, relations, enums, jsonSchemas } = get();
    const idSet = new Set(tableIds);
    const enumIdSet = new Set(enumIds);
    const jsonSchemaIdSet = new Set(jsonSchemaIds);
    const selectedTables = tables.filter(t => idSet.has(t.id));
    // Auto-include enums referenced by copied table fields.
    for (const table of selectedTables) {
      for (const field of table.fields) {
        if (field.type === 'enum' && field.enumId) enumIdSet.add(field.enumId);
        if (field.jsonSchemaId) jsonSchemaIdSet.add(field.jsonSchemaId);
      }
    }
    const selectedEnums = enums.filter(e => enumIdSet.has(e.id));
    const selectedJsonSchemas = jsonSchemas.filter((doc) => jsonSchemaIdSet.has(doc.id));
    if (selectedTables.length === 0 && selectedEnums.length === 0 && selectedJsonSchemas.length === 0) return null;
    const selectedRelations = relations.filter(r => idSet.has(r.fromTableId) && idSet.has(r.toTableId));
    const payload: ClipboardSelectionPayload = {
      type: CLIPBOARD_SCHEMA_TYPE,
      version: CLIPBOARD_SCHEMA_VERSION,
      tables: deepClone(selectedTables),
      relations: deepClone(selectedRelations),
      enums: deepClone(selectedEnums),
      jsonSchemas: deepClone(selectedJsonSchemas),
    };
    return JSON.stringify(payload);
  },

  importSelectionFromClipboard: (content, offset = { x: 64, y: 64 }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    const payload = parsed as Partial<ClipboardSelectionPayload>;
    if (payload.type !== CLIPBOARD_SCHEMA_TYPE || payload.version !== CLIPBOARD_SCHEMA_VERSION) return null;
    if (!Array.isArray(payload.tables) || !Array.isArray(payload.relations) || !Array.isArray(payload.enums)) return null;
    if (payload.jsonSchemas != null && !Array.isArray(payload.jsonSchemas)) return null;
    if (payload.tables.length === 0 && payload.enums.length === 0 && (payload.jsonSchemas?.length ?? 0) === 0) return null;

    const state = get();
    const sourceTables = deepClone(payload.tables);
    const sourceRelations = deepClone(payload.relations);
    const sourceEnums = deepClone(payload.enums);
    const sourceJsonSchemas = deepClone(payload.jsonSchemas ?? []);

    const existingNames = new Set(state.tables.map(t => t.name.toLowerCase()));
    const existingEnumNames = new Set(state.enums.map(e => e.name.toLowerCase()));
    const tableIdMap = new Map<string, string>();
    const tableNameMap = new Map<string, string>();
    const fieldIdMap = new Map<string, string>();
    const enumIdMap = new Map<string, string>();
    const enumNameMap = new Map<string, string>();
    const jsonSchemaIdMap = new Map<string, string>();
    const jsonSchemaNameMap = new Map<string, string>();

    const pastedEnums: EnumType[] = sourceEnums.map((sourceEnum) => {
      const newEnumId = nextId();
      enumIdMap.set(sourceEnum.id, newEnumId);
      const uniqueEnumName = getUniqueTableName(sourceEnum.name, existingEnumNames);
      enumNameMap.set(sourceEnum.name, uniqueEnumName);
      return {
        ...sourceEnum,
        id: newEnumId,
        name: uniqueEnumName,
        position: sourceEnum.position
          ? { x: sourceEnum.position.x + offset.x, y: sourceEnum.position.y + offset.y }
          : { x: 260 + offset.x, y: 140 + offset.y },
      };
    });

    const pastedTables: Table[] = sourceTables.map((sourceTable) => {
      const newTableId = nextId();
      tableIdMap.set(sourceTable.id, newTableId);

      const uniqueName = getUniqueTableName(sourceTable.name, existingNames);
      tableNameMap.set(sourceTable.name, uniqueName);

      const newFields = sourceTable.fields.map((sourceField) => {
        const newFieldId = nextId();
        fieldIdMap.set(sourceField.id, newFieldId);
        return { ...sourceField, id: newFieldId };
      });

      return {
        ...sourceTable,
        id: newTableId,
        name: uniqueName,
        position: {
          x: sourceTable.position.x + offset.x,
          y: sourceTable.position.y + offset.y,
        },
        fields: newFields,
      };
    });

    const existingJsonSchemaNames = new Set(state.jsonSchemas.map((doc) => doc.name.toLowerCase()));
    const pastedJsonSchemas: JsonSchemaDocument[] = sourceJsonSchemas.map((sourceDoc) => {
      const newJsonSchemaId = nextId();
      jsonSchemaIdMap.set(sourceDoc.id, newJsonSchemaId);
      const uniqueName = getUniqueTableName(sourceDoc.name, existingJsonSchemaNames);
      jsonSchemaNameMap.set(sourceDoc.name, uniqueName);
      const nodeIdMap = new Map<string, string>();
      const nextNodes = sourceDoc.nodes.map((node) => {
        const newNodeId = nextId();
        nodeIdMap.set(node.id, newNodeId);
        return {
          ...node,
          id: newNodeId,
        };
      });
      for (const node of nextNodes) {
        if (node.parentId) {
          node.parentId = nodeIdMap.get(node.parentId);
        }
      }
      return {
        ...sourceDoc,
        id: newJsonSchemaId,
        name: uniqueName,
        position: sourceDoc.position
          ? { x: sourceDoc.position.x + offset.x, y: sourceDoc.position.y + offset.y }
          : { x: 320 + offset.x, y: 220 + offset.y },
        nodes: nextNodes,
      };
    });

    for (const table of pastedTables) {
      for (const field of table.fields) {
        if (field.type === 'enum' && field.enumId) {
          const remappedEnumId = enumIdMap.get(field.enumId);
          if (remappedEnumId) {
            field.enumId = remappedEnumId;
            if (field.enumName) {
              field.enumName = enumNameMap.get(field.enumName) ?? field.enumName;
            }
          }
        }
        if (field.jsonSchemaId) {
          const remappedJsonSchemaId = jsonSchemaIdMap.get(field.jsonSchemaId);
          if (remappedJsonSchemaId) {
            field.jsonSchemaId = remappedJsonSchemaId;
            if (field.jsonSchemaName) {
              field.jsonSchemaName = jsonSchemaNameMap.get(field.jsonSchemaName) ?? field.jsonSchemaName;
            }
          }
        }
        if (!field.foreignKeyTable) continue;
        const remappedName = tableNameMap.get(field.foreignKeyTable);
        if (remappedName) field.foreignKeyTable = remappedName;
      }
    }

    const pastedRelations: Relation[] = sourceRelations
      .map((relation) => {
        const mappedFromTableId = tableIdMap.get(relation.fromTableId);
        const mappedToTableId = tableIdMap.get(relation.toTableId);
        const mappedFromFieldId = fieldIdMap.get(relation.fromFieldId);
        const mappedToFieldId = fieldIdMap.get(relation.toFieldId);
        if (!mappedFromTableId || !mappedToTableId || !mappedFromFieldId || !mappedToFieldId) return null;
        return {
          ...relation,
          id: nextId(),
          fromTableId: mappedFromTableId,
          toTableId: mappedToTableId,
          fromFieldId: mappedFromFieldId,
          toFieldId: mappedToFieldId,
        };
      })
      .filter((relation): relation is Relation => relation !== null);

    const insertedTableIds = pastedTables.map(t => t.id);
    const insertedEnumIds = pastedEnums.map(e => e.id);
    const insertedJsonSchemaIds = pastedJsonSchemas.map((doc) => doc.id);
    const firstSelectedId = insertedTableIds[0]
      ?? (insertedEnumIds[0] ? `enum::${insertedEnumIds[0]}` : null)
      ?? (insertedJsonSchemaIds[0] ? `jsonschema::${insertedJsonSchemaIds[0]}` : null);
    set(withHistory(state, {
      tables: [...state.tables, ...pastedTables],
      relations: [...state.relations, ...pastedRelations],
      enums: [...state.enums, ...pastedEnums],
      jsonSchemas: [...state.jsonSchemas, ...pastedJsonSchemas],
      selectedTableId: firstSelectedId,
      selectedTableIds: new Set([
        ...insertedTableIds,
        ...insertedEnumIds.map(id => `enum::${id}`),
        ...insertedJsonSchemaIds.map((id) => `jsonschema::${id}`),
      ]),
      selectedRelation: null,
    }));

    return {
      insertedTableIds,
      insertedEnumIds,
      insertedJsonSchemaIds,
      tables: pastedTables.length,
      enums: pastedEnums.length,
      jsonSchemas: pastedJsonSchemas.length,
      relations: pastedRelations.length,
    };
  },

  // ── Helpers ──
  getTableColor: (table) => {
    const { domains } = get();
    if (table.domainId) {
      const domain = domains.find(d => d.id === table.domainId);
      if (domain) return domain.color;
    }
    return table.color || '#6366f1';
  },
}));
