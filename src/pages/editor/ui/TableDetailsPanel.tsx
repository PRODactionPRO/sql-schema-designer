import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Table, Field, FieldType, Relation, Domain } from '../model/types';
import { ALL_FIELD_TYPES } from '../model/types';
import {
  Plus, Trash2, Key, Link, PanelRightClose, PanelRight,
  Info, X, MessageSquare, Hash, Type, ToggleLeft, Calendar,
  Clock, Braces, Binary, Globe, MapPin, Circle, FileCode, List, Tag,
  Fingerprint, DollarSign, Network, Hexagon, Ruler, Box, Database, Zap,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Label } from '@/shared/ui/label';

// Map field types to lucide icons
const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  uuid: <Fingerprint className="size-3.5" />,
  bigint: <Hash className="size-3.5" />,
  integer: <Hash className="size-3.5" />,
  smallint: <Hash className="size-3.5" />,
  serial: <Hash className="size-3.5" />,
  bigserial: <Hash className="size-3.5" />,
  varchar: <Type className="size-3.5" />,
  text: <Type className="size-3.5" />,
  citext: <Type className="size-3.5" />,
  boolean: <ToggleLeft className="size-3.5" />,
  timestamp: <Calendar className="size-3.5" />,
  timestamptz: <Calendar className="size-3.5" />,
  date: <Calendar className="size-3.5" />,
  time: <Clock className="size-3.5" />,
  interval: <Clock className="size-3.5" />,
  json: <Braces className="size-3.5" />,
  jsonb: <Braces className="size-3.5" />,
  decimal: <DollarSign className="size-3.5" />,
  numeric: <Hash className="size-3.5" />,
  real: <Hash className="size-3.5" />,
  'double precision': <Hash className="size-3.5" />,
  money: <DollarSign className="size-3.5" />,
  bytea: <Binary className="size-3.5" />,
  inet: <Globe className="size-3.5" />,
  cidr: <Network className="size-3.5" />,
  macaddr: <Hexagon className="size-3.5" />,
  point: <MapPin className="size-3.5" />,
  line: <Ruler className="size-3.5" />,
  polygon: <Box className="size-3.5" />,
  circle: <Circle className="size-3.5" />,
  xml: <FileCode className="size-3.5" />,
  array: <List className="size-3.5" />,
  enum: <Tag className="size-3.5" />,
};

function getTypeIcon(type: string) {
  return FIELD_TYPE_ICONS[type] || <Database className="size-3.5" />;
}

interface TableDetailsPanelProps {
  table: Table | null;
  tables: Table[];
  domains: Domain[];
  relations: Relation[];
  collapsed: boolean;
  selectedTableIds: Set<string>;
  onToggleCollapse: () => void;
  darkMode?: boolean;
  onUpdateTableName: (name: string) => void;
  onUpdateTableDescription: (description: string) => void;
  onUpdateTableDomain: (domainId: string | undefined) => void;
  onAddField: (field: Omit<Field, 'id'>) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  onAddRelation: (relation: Omit<Relation, 'id'>) => void;
  onDeleteRelation: (relationId: string) => void;
  enabledFieldTypes?: FieldType[];
  onBulkAssignDomain?: (domainId: string, tableIds: string[]) => void;
  onBulkDelete?: (tableIds: string[]) => void;
}

// Tooltip wrapper
function Tip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
        {label}
      </div>
    </div>
  );
}

export function TableDetailsPanel({
  table, tables, domains, relations, collapsed, onToggleCollapse,
  onUpdateTableName, onUpdateTableDescription, onUpdateTableDomain,
  onAddField, onUpdateField, onDeleteField, onAddRelation, onDeleteRelation,
  enabledFieldTypes,
  selectedTableIds,
  onBulkAssignDomain,
  onBulkDelete,
  darkMode,
}: TableDetailsPanelProps) {
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('varchar');
  const [moreOpenFieldId, setMoreOpenFieldId] = useState<string | null>(null);
  const [fieldComments, setFieldComments] = useState<Record<string, string>>({});
  const moreBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [fkDropdownFieldId, setFkDropdownFieldId] = useState<string | null>(null);

  const availableTypes = enabledFieldTypes && enabledFieldTypes.length > 0
    ? ALL_FIELD_TYPES.filter(t => enabledFieldTypes.includes(t))
    : ALL_FIELD_TYPES;

  // Calculate popover position when opening
  useEffect(() => {
    if (moreOpenFieldId) {
      const btn = moreBtnRefs.current[moreOpenFieldId];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const popoverH = 360; // approximate popover height
        const popoverW = 288; // w-72 = 18rem = 288px
        // Prefer opening below; if not enough space, open above
        let top = rect.bottom + 4;
        if (top + popoverH > window.innerHeight) {
          top = rect.top - popoverH - 4;
        }
        // Ensure it doesn't go above viewport
        if (top < 8) top = 8;
        // Align right edge with button right edge
        let left = rect.right - popoverW;
        if (left < 8) left = 8;
        setPopoverPos({ top, left });
      }
    } else {
      setPopoverPos(null);
    }
  }, [moreOpenFieldId]);

  // Dark theme color helpers
  const dk = darkMode;
  const panelBg = dk ? 'bg-[#1e1e2e]/95' : 'bg-white/95';
  const borderClr = dk ? 'border-[#313244]' : 'border-gray-200';
  const textMuted = dk ? 'text-[#6c7086]' : 'text-gray-400';
  const textSecondary = dk ? 'text-[#a6adc8]' : 'text-gray-500';
  const textPrimary = dk ? 'text-[#cdd6f4]' : '';
  const hoverBg = dk ? 'hover:bg-[#313244]' : 'hover:bg-gray-100';
  const rowHover = dk ? 'hover:bg-[#313244]/60' : 'hover:bg-gray-50';
  const inputBg = dk ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder-[#6c7086]' : '';
  const collapsedBg = dk ? 'bg-[#1e1e2e]/95' : 'bg-white/95';
  const inactiveIcon = dk ? 'text-[#45475a] hover:text-[#6c7086] hover:bg-[#313244]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100';

  if (collapsed) {
    return (
      <div className={`w-10 ${collapsedBg} backdrop-blur-sm flex flex-col items-center pt-2 h-full rounded-l-lg`}>
        <button onClick={onToggleCollapse} className={`p-1.5 ${hoverBg} rounded ${textSecondary}`} title="Expand panel (F)">
          <PanelRight className="size-4" />
        </button>
      </div>
    );
  }

  if (!table) {
    // Multi-selection view
    if (selectedTableIds.size > 1) {
      return (
        <div className={`w-80 ${panelBg} backdrop-blur-sm flex flex-col h-full rounded-l-lg ${textPrimary}`}>
          <div className={`flex items-center justify-between p-2 border-b ${borderClr}`}>
            <span className={`text-xs ${textMuted} px-2`}>Bulk Actions</span>
            <button onClick={onToggleCollapse} className={`p-1.5 ${hoverBg} rounded ${textMuted}`} title="Collapse">
              <PanelRightClose className="size-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-blue-50 text-blue-600 mb-2">
                <Database className="size-5" />
              </div>
              <p className="text-sm text-gray-700">
                Selected <span className="font-semibold">{selectedTableIds.size}</span> table{selectedTableIds.size > 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-2">
              {/* Assign to Domain */}
              {domains.length > 0 && onBulkAssignDomain && (
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Add to Domain</Label>
                  <div className="space-y-1">
                    {domains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => onBulkAssignDomain(d.id, Array.from(selectedTableIds))}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                      >
                        <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete all */}
              {onBulkDelete && (
                <button
                  onClick={() => onBulkDelete(Array.from(selectedTableIds))}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Delete {selectedTableIds.size} table{selectedTableIds.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`w-80 ${panelBg} backdrop-blur-sm flex flex-col h-full rounded-l-lg ${textPrimary}`}>
        <div className={`flex items-center justify-between p-2 border-b ${borderClr}`}>
          <span className={`text-xs ${textMuted} px-2`}>Properties</span>
          <button onClick={onToggleCollapse} className={`p-1.5 ${hoverBg} rounded ${textMuted}`} title="Collapse">
            <PanelRightClose className="size-3.5" />
          </button>
        </div>
        <div className={`flex-1 flex items-center justify-center ${textSecondary} p-4`}>
          <p className="text-sm text-center">Select a table to view details</p>
        </div>
      </div>
    );
  }

  const handleAddField = () => {
    if (newFieldName.trim()) {
      onAddField({ name: newFieldName.trim(), type: newFieldType, isPrimaryKey: false, isNullable: true, isForeignKey: false });
      setNewFieldName('');
      setNewFieldType('varchar');
      setIsAddingField(false);
    }
  };

  const otherTables = tables.filter(t => t.id !== table.id);

  const getFieldRelation = (fieldId: string): Relation | undefined => {
    return relations.find(r => r.fromTableId === table.id && r.fromFieldId === fieldId);
  };

  const handleSetForeignKey = (fieldId: string, refTableId: string, refFieldId: string) => {
    const existingRel = getFieldRelation(fieldId);
    if (existingRel) onDeleteRelation(existingRel.id);
    const refTable = tables.find(t => t.id === refTableId);
    const refField = refTable?.fields.find(f => f.id === refFieldId);
    if (refTable && refField) {
      onUpdateField(fieldId, { isForeignKey: true, foreignKeyTable: refTable.name, foreignKeyField: refField.name });
      onAddRelation({ fromTableId: table.id, fromFieldId: fieldId, toTableId: refTableId, toFieldId: refFieldId, type: '1:N' });
    }
  };

  const handleRemoveForeignKey = (fieldId: string) => {
    const existingRel = getFieldRelation(fieldId);
    if (existingRel) onDeleteRelation(existingRel.id);
    onUpdateField(fieldId, { isForeignKey: false, foreignKeyTable: undefined, foreignKeyField: undefined });
  };

  return (
    <div className={`w-80 ${panelBg} backdrop-blur-sm flex flex-col h-full overflow-hidden rounded-l-lg ${textPrimary}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-2 border-b ${borderClr}`}>
        <span className={`text-xs ${textMuted} px-2`}>Properties</span>
        <button onClick={onToggleCollapse} className={`p-1.5 ${hoverBg} rounded ${textMuted}`} title="Collapse">
          <PanelRightClose className="size-3.5" />
        </button>
      </div>

      {/* Table Name & Meta */}
      <div className={`p-4 border-b ${borderClr} space-y-3`}>
        <div>
          <Label className={`text-xs ${textSecondary} mb-1 block`}>Table Name</Label>
          <Input type="text" value={table.name} onChange={(e) => onUpdateTableName(e.target.value)} className={`font-semibold h-8 text-sm ${inputBg}`} />
        </div>
        <div>
          <Label className={`text-xs ${textSecondary} mb-1 block`}>Description</Label>
          <textarea
            value={table.description || ''}
            onChange={(e) => onUpdateTableDescription(e.target.value)}
            placeholder="SQL comment for this table..."
            className={`w-full text-sm border rounded-md px-3 py-2 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${dk ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder-[#6c7086]' : 'border-gray-200'}`}
          />
        </div>
        {domains.length > 0 && (
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Domain</Label>
            <Select value={table.domainId || '_none_'} onValueChange={(val) => onUpdateTableDomain(val === '_none_' ? undefined : val)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No domain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">No domain</SelectItem>
                {domains.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Fields</h3>
            <Button onClick={() => setIsAddingField(true)} size="sm" variant="outline" className="h-7">
              <Plus className="size-3 mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-1">
            {table.fields.map(field => {
              const isMoreOpen = moreOpenFieldId === field.id;
              const refRel = getFieldRelation(field.id);
              const refTable = refRel ? tables.find(t => t.id === refRel.toTableId) : null;
              const refField = refTable?.fields.find(f => f.id === refRel?.toFieldId);

              return (
                <div key={field.id} className="relative">
                  {/* Single-line field row */}
                  <div className={`flex items-center gap-1 py-1 px-1 rounded ${rowHover} group/row`}>
                    {/* Field name - editable */}
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => onUpdateField(field.id, { name: e.target.value })}
                      className={`flex-1 min-w-0 text-sm bg-transparent border-none outline-none px-1 py-0.5 rounded truncate ${dk ? 'hover:bg-[#313244] focus:bg-[#313244] text-[#cdd6f4]' : 'hover:bg-gray-100 focus:bg-gray-100'} focus:ring-1 focus:ring-blue-400`}
                    />

                    {/* Type selector */}
                    <Select value={field.type} onValueChange={(value) => onUpdateField(field.id, { type: value as FieldType })}>
                      <SelectTrigger className={`h-6 w-[90px] text-xs border-none rounded px-1.5 gap-0.5 flex-shrink-0 ${dk ? 'bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4]' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <span className="flex items-center gap-1 truncate">
                          {getTypeIcon(field.type)}
                          <span className="truncate">{field.type}</span>
                        </span>
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-white">
                        {availableTypes.map(type => (
                          <SelectItem key={type} value={type} className="text-gray-200 focus:bg-gray-800 focus:text-white">
                            <span className="flex items-center gap-2">
                              <span className="text-gray-400">{getTypeIcon(type)}</span>
                              {type}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Icon buttons */}
                    <div className="flex items-center gap-0 flex-shrink-0">
                      <Tip label={field.isNullable ? 'Nullable (click to toggle)' : 'Not Null (click to toggle)'}>
                        <button
                          onClick={() => onUpdateField(field.id, { isNullable: !field.isNullable })}
                          className={`size-6 flex items-center justify-center rounded text-xs font-medium transition-colors ${field.isNullable ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' : inactiveIcon}`}
                        >
                          N
                        </button>
                      </Tip>

                      <Tip label={field.isPrimaryKey ? 'Primary Key (click to remove)' : 'Set as Primary Key'}>
                        <button
                          onClick={() => onUpdateField(field.id, { isPrimaryKey: !field.isPrimaryKey })}
                          className={`size-6 flex items-center justify-center rounded transition-colors ${field.isPrimaryKey ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' : inactiveIcon}`}
                        >
                          <Key className="size-3" />
                        </button>
                      </Tip>

                      <Tip label={field.isUnique ? 'Unique (click to remove)' : 'Set as Unique'}>
                        <button
                          onClick={() => onUpdateField(field.id, { isUnique: !field.isUnique })}
                          className={`size-6 flex items-center justify-center rounded text-[10px] transition-colors ${field.isUnique ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : inactiveIcon}`}
                          style={{ lineHeight: 1 }}
                        >
                          U
                        </button>
                      </Tip>

                      <Tip label={field.isIndexed ? 'Indexed (click to remove)' : 'Add Index'}>
                        <button
                          onClick={() => onUpdateField(field.id, { isIndexed: !field.isIndexed })}
                          className={`size-6 flex items-center justify-center rounded transition-colors ${field.isIndexed ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : inactiveIcon}`}
                        >
                          <Zap className="size-3" />
                        </button>
                      </Tip>

                      <Tip label={field.isForeignKey ? `FK → ${field.foreignKeyTable}.${field.foreignKeyField}` : 'Foreign Key'}>
                        <button
                          onClick={() => {
                            if (field.isForeignKey) {
                              handleRemoveForeignKey(field.id);
                            } else {
                              setFkDropdownFieldId(fkDropdownFieldId === field.id ? null : field.id);
                            }
                          }}
                          className={`size-6 flex items-center justify-center rounded transition-colors ${field.isForeignKey ? 'text-blue-500 bg-blue-50 hover:bg-blue-100' : inactiveIcon}`}
                        >
                          <Link className="size-3" />
                        </button>
                      </Tip>

                      <Tip label="Column details">
                        <button
                          ref={el => moreBtnRefs.current[field.id] = el}
                          onClick={() => setMoreOpenFieldId(isMoreOpen ? null : field.id)}
                          className={`size-6 flex items-center justify-center rounded transition-colors ${isMoreOpen ? 'text-white bg-gray-800' : `${dk ? 'text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#313244]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'} opacity-0 group-hover/row:opacity-100`}`}
                        >
                          <Info className="size-3.5" />
                        </button>
                      </Tip>
                    </div>
                  </div>

                  {/* FK reference info (if FK) */}
                  {field.isForeignKey && refTable && refField && (
                    <div className="ml-2 mb-1 flex items-center gap-1 text-xs text-blue-500">
                      <Link className="size-2.5" />
                      <span>→ {refTable.name}.{refField.name}</span>
                    </div>
                  )}

                  {/* FK dropdown selector (when clicking FK button on non-FK field) */}
                  {fkDropdownFieldId === field.id && !field.isForeignKey && (
                    <div className={`ml-2 mb-1 p-2 rounded-lg border ${dk ? 'bg-[#313244] border-[#45475a]' : 'bg-gray-50 border-gray-200'}`}>
                      <FKSelector
                        tables={otherTables}
                        darkMode={dk}
                        onSelect={(tableId, fieldId) => {
                          handleSetForeignKey(field.id, tableId, fieldId);
                          setFkDropdownFieldId(null);
                        }}
                      />
                      <button
                        onClick={() => setFkDropdownFieldId(null)}
                        className={`mt-1.5 text-xs ${dk ? 'text-[#6c7086] hover:text-[#a6adc8]' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Dark "More" popover – rendered via portal to avoid overflow clipping */}
                  {isMoreOpen && popoverPos && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setMoreOpenFieldId(null)} />
                      <div className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-72" style={{ top: popoverPos.top, left: popoverPos.left }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Column Attributes</h4>
                          <button onClick={() => setMoreOpenFieldId(null)} className="text-gray-500 hover:text-white transition-colors">
                            <X className="size-4" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Default */}
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Default</label>
                            <input
                              type="text"
                              value={field.defaultValue || ''}
                              onChange={(e) => onUpdateField(field.id, { defaultValue: e.target.value || undefined })}
                              placeholder="Default value"
                              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Comment */}
                          <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                              Comment <MessageSquare className="size-3" />
                            </label>
                            <textarea
                              value={fieldComments[field.id] || ''}
                              onChange={(e) => setFieldComments(prev => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder="Optional description for this column"
                              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Actions */}
                          <div className="pt-2 border-t border-gray-700">
                            <h5 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Actions</h5>
                            <button
                              onClick={() => { onDeleteField(field.id); setMoreOpenFieldId(null); }}
                              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 px-3 py-2 rounded-lg w-full text-left transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                              Delete column
                            </button>
                          </div>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              );
            })}
          </div>

          {/* Add field inline */}
          {isAddingField && (
            <div className={`mt-2 p-2 border border-dashed rounded-lg space-y-2 ${dk ? 'border-[#45475a]' : 'border-gray-300'}`}>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="field_name"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddField(); if (e.key === 'Escape') setIsAddingField(false); }}
                  autoFocus
                  className={`flex-1 min-w-0 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${dk ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder-[#6c7086]' : 'border-gray-200'}`}
                />
                <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                  <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {availableTypes.map(type => (
                      <SelectItem key={type} value={type} className="text-gray-200 focus:bg-gray-800 focus:text-white">
                        <span className="flex items-center gap-2">
                          <span className="text-gray-400">{getTypeIcon(type)}</span>
                          {type}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddField} size="sm" className="flex-1 h-7">Add</Button>
                <Button onClick={() => { setIsAddingField(false); setNewFieldName(''); }} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FKSelector({ tables, darkMode, onSelect }: { tables: Table[]; darkMode?: boolean; onSelect: (tableId: string, fieldId: string) => void; }) {
  const [selectedTableId, setSelectedTableId] = useState('');
  const selectedTable = tables.find(t => t.id === selectedTableId);
  const selectCls = darkMode
    ? 'w-full text-sm bg-[#313244] border border-[#45475a] rounded-lg px-3 py-1.5 text-[#cdd6f4] focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div className="space-y-1.5">
      <select
        value={selectedTableId}
        onChange={(e) => setSelectedTableId(e.target.value)}
        className={selectCls}
      >
        <option value="">Select table...</option>
        {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {selectedTable && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) onSelect(selectedTableId, e.target.value); }}
          className={selectCls}
        >
          <option value="">Select field...</option>
          {selectedTable.fields.map(f => <option key={f.id} value={f.id}>{f.isPrimaryKey ? '🔑 ' : ''}{f.name} ({f.type})</option>)}
        </select>
      )}
    </div>
  );
}