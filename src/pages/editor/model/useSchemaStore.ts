import { create } from 'zustand';
import type { Table, Field, Relation, Schema, RelationType, Domain, EnumType } from './types';
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
}

interface HistorySnapshot {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
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

  // Enum CRUD
  addEnum: (name: string, values?: string[], position?: { x: number; y: number }) => EnumType;
  updateEnum: (id: string, updates: Partial<Omit<EnumType, 'id'>>) => void;
  deleteEnum: (id: string) => void;
  updateEnumPosition: (id: string, position: { x: number; y: number }) => void;
  reorderEnumValues: (id: string, fromIndex: number, toIndex: number) => void;

  // Multi-select
  toggleTableSelection: (id: string, additive: boolean) => void;
  selectTablesInRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  clearMultiSelection: () => void;
  moveSelectedTables: (dx: number, dy: number) => void;
  reorderTables: (orderedIds: string[]) => void;

  // History helper (push snapshot without data change — e.g. after drag-end)
  pushHistory: () => void;

  // Layout
  autoLayout: () => void;

  // Import/Export
  exportToFormat: (formatId: string) => string;
  importFromFormat: (formatId: string, content: string) => void;
  exportSelectionForClipboard: (tableIds: string[], enumIds?: string[]) => string | null;
  importSelectionFromClipboard: (content: string, offset?: { x: number; y: number }) => { insertedTableIds: string[]; insertedEnumIds: string[]; tables: number; enums: number; relations: number } | null;

  // Helpers
  getTableColor: (table: Table) => string;
}

// ── Helpers ──

function snapshot(state: { tables: Table[]; relations: Relation[]; domains: Domain[]; enums: EnumType[] }): HistorySnapshot {
  return {
    tables: deepClone(state.tables),
    relations: deepClone(state.relations),
    domains: deepClone(state.domains),
    enums: deepClone(state.enums),
  };
}

function withHistory(
  state: Pick<SchemaState, 'tables' | 'relations' | 'domains' | 'enums' | '_past'>,
  next: Partial<SchemaState>,
): Partial<SchemaState> {
  const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
  return { ...next, _past: past, _future: [] };
}

let _idCounter = Date.now();
function nextId(): string {
  return (++_idCounter).toString();
}

const CLIPBOARD_SCHEMA_TYPE = 'prodsql/canvas-selection';
const CLIPBOARD_SCHEMA_VERSION = 1;

interface ClipboardSelectionPayload {
  type: typeof CLIPBOARD_SCHEMA_TYPE;
  version: typeof CLIPBOARD_SCHEMA_VERSION;
  tables: Table[];
  relations: Relation[];
  enums: EnumType[];
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
    });
    const tables = normalized.tables;
    const relations = normalized.relations;
    const domains = normalized.domains ?? [];
    const enums = normalized.enums ?? [];
    set({
      tables,
      relations,
      domains,
      enums,
      selectedTableId: tables.length > 0 ? tables[0]?.id ?? null : null,
      selectedTableIds: new Set(),
      selectedRelation: null,
      _past: [],
      _future: [],
    });
  },

  // ── Undo / Redo ──
  undo: () => {
    const { _past, _future, tables, relations, domains, enums } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    set({
      tables: prev.tables,
      relations: prev.relations,
      domains: prev.domains,
      enums: prev.enums,
      _past: _past.slice(0, -1),
      _future: [..._future, snapshot({ tables, relations, domains, enums })],
    });
  },

  redo: () => {
    const { _past, _future, tables, relations, domains, enums } = get();
    if (_future.length === 0) return;
    const next = _future[_future.length - 1];
    set({
      tables: next.tables,
      relations: next.relations,
      domains: next.domains,
      enums: next.enums,
      _past: [..._past, snapshot({ tables, relations, domains, enums })],
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
    const { tables, relations, domains, enums } = get();
    const schema: Schema = { tables, relations, domains, enums };
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
      selectedTableId: dedupedTables.length > 0 ? dedupedTables[0].id : null,
      selectedRelation: null,
      selectedTableIds: new Set(),
    }));
  },

  exportSelectionForClipboard: (tableIds, enumIds = []) => {
    const { tables, relations, enums } = get();
    const idSet = new Set(tableIds);
    const enumIdSet = new Set(enumIds);
    const selectedTables = tables.filter(t => idSet.has(t.id));
    // Auto-include enums referenced by copied table fields.
    for (const table of selectedTables) {
      for (const field of table.fields) {
        if (field.type === 'enum' && field.enumId) enumIdSet.add(field.enumId);
      }
    }
    const selectedEnums = enums.filter(e => enumIdSet.has(e.id));
    if (selectedTables.length === 0 && selectedEnums.length === 0) return null;
    const selectedRelations = relations.filter(r => idSet.has(r.fromTableId) && idSet.has(r.toTableId));
    const payload: ClipboardSelectionPayload = {
      type: CLIPBOARD_SCHEMA_TYPE,
      version: CLIPBOARD_SCHEMA_VERSION,
      tables: deepClone(selectedTables),
      relations: deepClone(selectedRelations),
      enums: deepClone(selectedEnums),
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
    if (payload.tables.length === 0 && payload.enums.length === 0) return null;

    const state = get();
    const sourceTables = deepClone(payload.tables);
    const sourceRelations = deepClone(payload.relations);
    const sourceEnums = deepClone(payload.enums);

    const existingNames = new Set(state.tables.map(t => t.name.toLowerCase()));
    const existingEnumNames = new Set(state.enums.map(e => e.name.toLowerCase()));
    const tableIdMap = new Map<string, string>();
    const tableNameMap = new Map<string, string>();
    const fieldIdMap = new Map<string, string>();
    const enumIdMap = new Map<string, string>();
    const enumNameMap = new Map<string, string>();

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
    set(withHistory(state, {
      tables: [...state.tables, ...pastedTables],
      relations: [...state.relations, ...pastedRelations],
      enums: [...state.enums, ...pastedEnums],
      selectedTableId: insertedTableIds[0] ?? null,
      selectedTableIds: new Set([
        ...insertedTableIds,
        ...insertedEnumIds.map(id => `enum::${id}`),
      ]),
      selectedRelation: null,
    }));

    return { insertedTableIds, insertedEnumIds, tables: pastedTables.length, enums: pastedEnums.length, relations: pastedRelations.length };
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
