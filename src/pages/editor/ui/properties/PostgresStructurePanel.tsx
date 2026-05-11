import { CheckSquare, KeyRound, Link2, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { ReferentialAction, Table, TableConstraint, TableConstraintType, TableIndex } from '../../model/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

type StructureSection = 'constraints' | 'indexes';

interface PostgresStructurePanelProps {
  table: Table;
  tables: Table[];
  section: StructureSection;
  showHeader?: boolean;
  darkMode?: boolean;
  onAddConstraint?: (type: TableConstraintType) => string | null;
  onUpdateConstraint?: (constraintId: string, updates: Partial<TableConstraint>) => void;
  onDeleteConstraint?: (constraintId: string) => void;
  onAddIndex?: () => string | null;
  onUpdateIndex?: (indexId: string, updates: Partial<TableIndex>) => void;
  onDeleteIndex?: (indexId: string) => void;
}

const REFERENTIAL_ACTIONS = [
  { value: 'no_action', label: 'NO ACTION' },
  { value: 'restrict', label: 'RESTRICT' },
  { value: 'cascade', label: 'CASCADE' },
  { value: 'set_null', label: 'SET NULL' },
  { value: 'set_default', label: 'SET DEFAULT' },
] as const;

const INDEX_METHODS = ['btree', 'hash', 'gist', 'spgist', 'gin', 'brin'] as const;

function toggleItem(items: string[], id: string, enabled: boolean): string[] {
  if (enabled) return items.includes(id) ? items : [...items, id];
  return items.filter((item) => item !== id);
}

function getConstraintLabel(type: TableConstraintType): string {
  if (type === 'primary_key') return 'Primary key';
  if (type === 'foreign_key') return 'Foreign key';
  if (type === 'check') return 'Check';
  return 'Unique';
}

function getConstraintIcon(type: TableConstraintType) {
  if (type === 'primary_key') return <KeyRound className="size-3.5" />;
  if (type === 'foreign_key') return <Link2 className="size-3.5" />;
  if (type === 'check') return <CheckSquare className="size-3.5" />;
  return <ShieldCheck className="size-3.5" />;
}

function fieldLabel(field: Table['fields'][number]): string {
  return `${field.name} (${field.type === 'enum' ? field.enumName || 'enum' : field.type})`;
}

function getSelectClass(darkMode?: boolean): string {
  return darkMode
    ? 'h-8 w-full rounded-md border border-[#45475a] bg-[#313244] px-2 text-xs text-[#cdd6f4] outline-none focus:ring-2 focus:ring-blue-500'
    : 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-500';
}

function getTextareaClass(darkMode?: boolean): string {
  return darkMode
    ? 'w-full rounded-md border border-[#45475a] bg-[#313244] px-3 py-2 text-xs text-[#cdd6f4] placeholder-[#6c7086] outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500';
}

function ColumnsChecklist({
  fields,
  value,
  onChange,
  darkMode,
}: {
  fields: Table['fields'];
  value: string[];
  onChange: (nextValue: string[]) => void;
  darkMode?: boolean;
}) {
  if (fields.length === 0) {
    return <div className={`text-xs ${darkMode ? 'text-[#6c7086]' : 'text-gray-400'}`}>No columns yet.</div>;
  }

  return (
    <div className={`max-h-28 overflow-y-auto rounded-md border ${darkMode ? 'border-[#45475a]' : 'border-gray-200'}`}>
      {fields.map((field) => {
        const checked = value.includes(field.id);
        return (
          <label
            key={field.id}
            className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
              darkMode ? 'hover:bg-[#313244] text-[#cdd6f4]' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onChange(toggleItem(value, field.id, event.target.checked))}
              className="size-3.5"
            />
            <span className="min-w-0 truncate">{fieldLabel(field)}</span>
          </label>
        );
      })}
    </div>
  );
}

export function PostgresStructurePanel({
  table,
  tables,
  section,
  showHeader = true,
  darkMode,
  onAddConstraint,
  onUpdateConstraint,
  onDeleteConstraint,
  onAddIndex,
  onUpdateIndex,
  onDeleteIndex,
}: PostgresStructurePanelProps) {
  const cardClass = darkMode
    ? 'rounded-md border border-[#313244] bg-[#181825] p-3'
    : 'rounded-md border border-gray-200 bg-white p-3';
  const muted = darkMode ? 'text-[#6c7086]' : 'text-gray-500';
  const labelClass = `text-[11px] ${muted} mb-1 block`;
  const inputClass = `h-8 text-xs ${darkMode ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder-[#6c7086]' : ''}`;
  const selectClass = getSelectClass(darkMode);
  const textareaClass = getTextareaClass(darkMode);

  if (section === 'indexes') {
    const indexes = table.indexes ?? [];

    if (!showHeader && indexes.length === 0) return null;

    return (
      <div className="space-y-3">
        {showHeader && (
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Indexes</h3>
              <p className={`text-xs ${muted}`}>Multi-column PostgreSQL indexes.</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onAddIndex?.()}>
              <Plus className="size-3 mr-1" /> Add
            </Button>
          </div>
        )}

        {indexes.map((index) => {
          const fieldColumnIds = index.columns.flatMap((column) => column.fieldId ? [column.fieldId] : []);
          const expression = index.columns.find((column) => column.expression)?.expression ?? '';
          return (
            <div key={index.id} className={cardClass}>
              <div className="flex items-center gap-2">
                <Search className={`size-4 ${muted}`} />
                <Input
                  value={index.name ?? ''}
                  onChange={(event) => onUpdateIndex?.(index.id, { name: event.target.value || undefined })}
                  placeholder="index_name"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => onDeleteIndex?.(index.id)}
                  className={`size-8 flex items-center justify-center rounded-md ${darkMode ? 'text-red-300 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'}`}
                  title="Delete index"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 text-xs ${darkMode ? 'text-[#cdd6f4]' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={!!index.unique}
                    onChange={(event) => onUpdateIndex?.(index.id, { unique: event.target.checked })}
                    className="size-3.5"
                  />
                  Unique
                </label>
                <select
                  value={index.method ?? 'btree'}
                  onChange={(event) => onUpdateIndex?.(index.id, { method: event.target.value as TableIndex['method'] })}
                  className={selectClass}
                >
                  {INDEX_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </div>

              <div className="mt-3">
                <Label className={labelClass}>Columns</Label>
                <ColumnsChecklist
                  fields={table.fields}
                  value={fieldColumnIds}
                  darkMode={darkMode}
                  onChange={(nextIds) => {
                    const expressionColumns = index.columns.filter((column) => column.expression);
                    onUpdateIndex?.(index.id, {
                      columns: [...nextIds.map((fieldId) => ({ fieldId })), ...expressionColumns],
                    });
                  }}
                />
              </div>

              <div className="mt-3">
                <Label className={labelClass}>Expression column</Label>
                <Input
                  value={expression}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    const fieldColumns = index.columns.filter((column) => column.fieldId);
                    onUpdateIndex?.(index.id, {
                      columns: value ? [...fieldColumns, { expression: value }] : fieldColumns,
                    });
                  }}
                  placeholder="lower(email)"
                  className={inputClass}
                />
              </div>

              <div className="mt-3">
                <Label className={labelClass}>WHERE</Label>
                <Input
                  value={index.where ?? ''}
                  onChange={(event) => onUpdateIndex?.(index.id, { where: event.target.value || undefined })}
                  placeholder="deleted_at IS NULL"
                  className={inputClass}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const constraints = table.constraints ?? [];

  return (
    <div className="space-y-3">
      {showHeader && (
        <div>
          <h3 className="text-sm font-semibold">Constraints</h3>
          <p className={`text-xs ${muted}`}>Table-level keys and rules.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {(['primary_key', 'unique', 'foreign_key', 'check'] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant="outline"
            className="h-8 justify-start text-xs"
            onClick={() => onAddConstraint?.(type)}
          >
            {getConstraintIcon(type)}
            <span className="ml-1.5 truncate">{getConstraintLabel(type)}</span>
          </Button>
        ))}
      </div>

      {constraints.map((constraint) => {
        const referencedTable = constraint.type === 'foreign_key'
          ? tables.find((candidate) => candidate.id === constraint.referencedTableId)
          : undefined;

        return (
          <div key={constraint.id} className={cardClass}>
            <div className="flex items-center gap-2">
              <span className={muted}>{getConstraintIcon(constraint.type)}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] uppercase ${muted}`}>{getConstraintLabel(constraint.type)}</div>
                <Input
                  value={constraint.name ?? ''}
                  onChange={(event) => onUpdateConstraint?.(constraint.id, { name: event.target.value || undefined })}
                  placeholder="constraint_name"
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => onDeleteConstraint?.(constraint.id)}
                className={`size-8 flex items-center justify-center rounded-md ${darkMode ? 'text-red-300 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'}`}
                title="Delete constraint"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {constraint.type !== 'check' && (
              <div className="mt-3">
                <Label className={labelClass}>Columns</Label>
                <ColumnsChecklist
                  fields={table.fields}
                  value={constraint.columnIds}
                  darkMode={darkMode}
                  onChange={(nextIds) => onUpdateConstraint?.(constraint.id, { columnIds: nextIds })}
                />
              </div>
            )}

            {constraint.type === 'unique' && (
              <label className={`mt-3 flex items-center gap-2 text-xs ${darkMode ? 'text-[#cdd6f4]' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={!!constraint.nullsNotDistinct}
                  onChange={(event) => onUpdateConstraint?.(constraint.id, { nullsNotDistinct: event.target.checked })}
                  className="size-3.5"
                />
                NULLS NOT DISTINCT
              </label>
            )}

            {constraint.type === 'foreign_key' && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label className={labelClass}>References table</Label>
                  <select
                    value={constraint.referencedTableId}
                    onChange={(event) => {
                      const nextTable = tables.find((candidate) => candidate.id === event.target.value);
                      onUpdateConstraint?.(constraint.id, {
                        referencedTableId: event.target.value,
                        referencedColumnIds: nextTable?.fields[0] ? [nextTable.fields[0].id] : [],
                      });
                    }}
                    className={selectClass}
                  >
                    {tables.filter((candidate) => candidate.id !== table.id).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                </div>

                {referencedTable && (
                  <div>
                    <Label className={labelClass}>Referenced columns</Label>
                    <ColumnsChecklist
                      fields={referencedTable.fields}
                      value={constraint.referencedColumnIds}
                      darkMode={darkMode}
                      onChange={(nextIds) => onUpdateConstraint?.(constraint.id, { referencedColumnIds: nextIds })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className={labelClass}>ON DELETE</Label>
                    <select
                      value={constraint.onDelete ?? 'no_action'}
                      onChange={(event) => onUpdateConstraint?.(constraint.id, { onDelete: event.target.value as ReferentialAction })}
                      className={selectClass}
                    >
                      {REFERENTIAL_ACTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className={labelClass}>ON UPDATE</Label>
                    <select
                      value={constraint.onUpdate ?? 'no_action'}
                      onChange={(event) => onUpdateConstraint?.(constraint.id, { onUpdate: event.target.value as ReferentialAction })}
                      className={selectClass}
                    >
                      {REFERENTIAL_ACTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {constraint.type === 'check' && (
              <div className="mt-3">
                <Label className={labelClass}>Expression</Label>
                <textarea
                  value={constraint.expression}
                  onChange={(event) => onUpdateConstraint?.(constraint.id, { expression: event.target.value })}
                  placeholder="price >= 0"
                  className={`${textareaClass} min-h-20 resize-y`}
                />
              </div>
            )}

            <div className="mt-3">
              <Label className={labelClass}>Description</Label>
              <Input
                value={constraint.description ?? ''}
                onChange={(event) => onUpdateConstraint?.(constraint.id, { description: event.target.value || undefined })}
                placeholder="Optional note"
                className={inputClass}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
