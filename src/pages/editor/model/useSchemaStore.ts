import { create } from 'zustand';
import type { Table, Field, Relation, Schema, RelationType, Domain } from './types';
import { DOMAIN_COLORS } from './types';
import { getSerializer } from '../lib/serializers';

// ── Types ──

export interface SchemaStoreInitialData {
  tables?: Table[];
  relations?: Relation[];
  domains?: Domain[];
}

interface HistorySnapshot {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
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

  // Relation CRUD
  addRelation: (relation: Omit<Relation, 'id'>) => void;
  updateRelation: (id: string, type: RelationType) => void;
  deleteRelation: (id: string) => void;

  // Domain CRUD
  addDomain: (name: string) => Domain;
  updateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  deleteDomain: (id: string) => void;
  assignDomainToTables: (domainId: string, tableIds: string[]) => void;

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

  // Helpers
  getTableColor: (table: Table) => string;
}

// ── Helpers ──

function snapshot(state: { tables: Table[]; relations: Relation[]; domains: Domain[] }): HistorySnapshot {
  return {
    tables: JSON.parse(JSON.stringify(state.tables)),
    relations: JSON.parse(JSON.stringify(state.relations)),
    domains: JSON.parse(JSON.stringify(state.domains)),
  };
}

let _idCounter = Date.now();
function nextId(): string {
  return (++_idCounter).toString();
}

// ── Store ──

export const useSchemaStore = create<SchemaState>()((set, get) => ({
  // Initial state
  tables: DEFAULT_TABLES,
  relations: DEFAULT_RELATIONS,
  domains: [],
  selectedTableId: DEFAULT_TABLES[0]?.id ?? null,
  selectedTableIds: new Set<string>(),
  selectedRelation: null,
  _past: [],
  _future: [],

  // ── Initialization ──
  initialize: (data?: SchemaStoreInitialData) => {
    const tables = data?.tables ?? DEFAULT_TABLES;
    const relations = data?.relations ?? DEFAULT_RELATIONS;
    const domains = data?.domains ?? [];
    set({
      tables,
      relations,
      domains,
      selectedTableId: tables.length > 0 ? tables[0]?.id ?? null : null,
      selectedTableIds: new Set(),
      selectedRelation: null,
      _past: [],
      _future: [],
    });
  },

  // ── Undo / Redo ──
  undo: () => {
    const { _past, _future, tables, relations, domains } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    set({
      tables: prev.tables,
      relations: prev.relations,
      domains: prev.domains,
      _past: _past.slice(0, -1),
      _future: [..._future, snapshot({ tables, relations, domains })],
    });
  },

  redo: () => {
    const { _past, _future, tables, relations, domains } = get();
    if (_future.length === 0) return;
    const next = _future[_future.length - 1];
    set({
      tables: next.tables,
      relations: next.relations,
      domains: next.domains,
      _past: [..._past, snapshot({ tables, relations, domains })],
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
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
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
    set({
      tables: [...state.tables, newTable],
      selectedTableId: newTable.id,
      _past: past,
      _future: [],
    });
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
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    // Prevent duplicate names (case-insensitive, excluding self)
    let finalName = name;
    const nameExists = (n: string) => state.tables.some(t => t.id !== id && t.name.toLowerCase() === n.toLowerCase());
    if (nameExists(finalName)) {
      let suffix = 2;
      while (nameExists(`${name}_${suffix}`)) suffix++;
      finalName = `${name}_${suffix}`;
    }
    set({
      tables: state.tables.map(t => t.id === id ? { ...t, name: finalName } : t),
      _past: past,
      _future: [],
    });
  },

  updateTableDescription: (id, description) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      tables: state.tables.map(t => t.id === id ? { ...t, description } : t),
      _past: past,
      _future: [],
    });
  },

  updateTableDomain: (tableId, domainId) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      tables: state.tables.map(t => {
        if (t.id !== tableId) return t;
        if (!domainId) return { ...t, domainId: undefined, color: undefined };
        return { ...t, domainId };
      }),
      _past: past,
      _future: [],
    });
  },

  deleteTable: (id) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const newSelectedTableIds = new Set(state.selectedTableIds);
    newSelectedTableIds.delete(id);
    set({
      tables: state.tables.filter(t => t.id !== id),
      relations: state.relations.filter(r => r.fromTableId !== id && r.toTableId !== id),
      selectedTableId: state.selectedTableId === id ? null : state.selectedTableId,
      selectedTableIds: newSelectedTableIds,
      _past: past,
      _future: [],
    });
  },

  deleteTables: (ids) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const idSet = new Set(ids);
    set({
      tables: state.tables.filter(t => !idSet.has(t.id)),
      relations: state.relations.filter(r => !idSet.has(r.fromTableId) && !idSet.has(r.toTableId)),
      selectedTableId: state.selectedTableId && idSet.has(state.selectedTableId) ? null : state.selectedTableId,
      selectedTableIds: new Set(),
      _past: past,
      _future: [],
    });
  },

  // ── Field CRUD ──
  addField: (tableId, field) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const newField: Field = { ...field, id: nextId() };
    set({
      tables: state.tables.map(t =>
        t.id === tableId ? { ...t, fields: [...t.fields, newField] } : t
      ),
      _past: past,
      _future: [],
    });
    return newField.id;
  },

  updateField: (tableId, fieldId, updates) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      tables: state.tables.map(t =>
        t.id === tableId
          ? { ...t, fields: t.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) }
          : t
      ),
      _past: past,
      _future: [],
    });
  },

  deleteField: (tableId, fieldId) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      tables: state.tables.map(t =>
        t.id === tableId ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) } : t
      ),
      relations: state.relations.filter(r => r.fromFieldId !== fieldId && r.toFieldId !== fieldId),
      _past: past,
      _future: [],
    });
  },

  // ── Relation CRUD ──
  addRelation: (relation) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const newRelation: Relation = { ...relation, id: nextId() };
    set({
      relations: [...state.relations, newRelation],
      _past: past,
      _future: [],
    });
  },

  updateRelation: (id, type) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      relations: state.relations.map(r => r.id === id ? { ...r, type } : r),
      _past: past,
      _future: [],
    });
  },

  deleteRelation: (id) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      relations: state.relations.filter(r => r.id !== id),
      selectedRelation: state.selectedRelation?.id === id ? null : state.selectedRelation,
      _past: past,
      _future: [],
    });
  },

  // ── Domain CRUD ──
  addDomain: (name) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const usedColors = new Set(state.domains.map(d => d.color));
    const color = DOMAIN_COLORS.find(c => !usedColors.has(c)) || DOMAIN_COLORS[state.domains.length % DOMAIN_COLORS.length];
    const newDomain: Domain = { id: nextId(), name, color };
    set({
      domains: [...state.domains, newDomain],
      _past: past,
      _future: [],
    });
    return newDomain;
  },

  updateDomain: (id, updates) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      domains: state.domains.map(d => d.id === id ? { ...d, ...updates } : d),
      _past: past,
      _future: [],
    });
  },

  deleteDomain: (id) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      domains: state.domains.filter(d => d.id !== id),
      tables: state.tables.map(t => t.domainId === id ? { ...t, domainId: undefined } : t),
      _past: past,
      _future: [],
    });
  },

  assignDomainToTables: (domainId, tableIds) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const idSet = new Set(tableIds);
    set({
      tables: state.tables.map(t => idSet.has(t.id) ? { ...t, domainId } : t),
      _past: past,
      _future: [],
    });
  },

  // ── Multi-select (no history) ──
  toggleTableSelection: (id, additive) => {
    set(state => {
      const next = new Set(additive ? state.selectedTableIds : []);
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
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    set({
      _past: past,
      _future: [],
    });
  },

  // ── Auto-layout ──
  autoLayout: () => {
    const state = get();
    const { tables, relations, domains } = state;
    if (tables.length === 0) return;

    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);

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

    set({
      tables: tables.map(t => {
        const pos = newPositions.get(t.id);
        return pos ? { ...t, position: pos } : t;
      }),
      _past: past,
      _future: [],
    });
  },

  // ─ Import/Export ──
  exportToFormat: (formatId) => {
    const { tables, relations, domains } = get();
    const schema: Schema = { tables, relations, domains };
    const serializer = getSerializer(formatId);
    if (!serializer) throw new Error(`Unknown format: ${formatId}`);
    return serializer.serialize(schema);
  },

  importFromFormat: (formatId, content) => {
    const state = get();
    const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
    const serializer = getSerializer(formatId);
    if (!serializer) throw new Error(`Unknown format: ${formatId}`);
    const schema = serializer.deserialize(content);
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
    set({
      tables: dedupedTables,
      relations: schema.relations,
      domains: schema.domains ?? state.domains,
      selectedTableId: dedupedTables.length > 0 ? dedupedTables[0].id : null,
      selectedRelation: null,
      selectedTableIds: new Set(),
      _past: past,
      _future: [],
    });
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