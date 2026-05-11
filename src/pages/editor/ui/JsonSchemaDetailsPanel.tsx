import type { Domain, JsonSchemaDocument, JsonSchemaNode, JsonSchemaValidationRules } from '../model/types';
import { JSON_SCHEMA_CANONICAL_TYPES } from '../model/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ChevronDown, ChevronRight, GripVertical, Info, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PanelIconButton } from '@/shared/ui/panel';
import { PropertiesSection } from './properties/PropertiesSection';

interface JsonSchemaDetailsPanelProps {
  doc: JsonSchemaDocument;
  domains?: Domain[];
  allDocuments?: JsonSchemaDocument[];
  usageItems?: Array<{ tableName: string; fieldName: string }>;
  readOnly?: boolean;
  darkMode?: boolean;
  onUpdateDocument: (updates: Partial<Omit<JsonSchemaDocument, 'id'>>) => void;
  onRename: (name: string) => void;
  onDescription: (description: string) => void;
  onDomain?: (domainId: string | undefined) => void;
  onAddRootNode: () => void;
  onAddChildNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<JsonSchemaNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapsed: (nodeId: string) => void;
  onMoveNode: (nodeId: string, targetParentId: string | undefined, targetOrder: number) => void;
}

interface FlatNode {
  node: JsonSchemaNode;
  depth: number;
  hasChildren: boolean;
}

export function JsonSchemaDetailsPanel({
  doc,
  domains = [],
  allDocuments = [],
  usageItems = [],
  readOnly = false,
  darkMode = false,
  onUpdateDocument,
  onRename,
  onDescription,
  onDomain,
  onAddRootNode,
  onAddChildNode,
  onUpdateNode,
  onDeleteNode,
  onToggleCollapsed,
  onMoveNode,
}: JsonSchemaDetailsPanelProps) {
  const flat = flattenNodes(doc.nodes);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ nodeId: string; mode: 'after' | 'inside' } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const parentChildrenMap = useMemo(() => buildChildrenMap(doc.nodes), [doc.nodes]);
  const otherDocuments = allDocuments.filter((item) => item.id !== doc.id);

  const panelText = darkMode ? 'text-[#cdd6f4]' : 'text-gray-900';
  const mutedText = darkMode ? 'text-[#a6adc8]' : 'text-gray-600';
  const nodeBorder = darkMode ? 'border-[#585b70]' : 'border-gray-200';
  const nodeBg = darkMode ? 'bg-transparent' : 'bg-white';
  const inputCls = darkMode
    ? 'bg-white text-gray-900 border-gray-200'
    : 'bg-white text-gray-900 border-gray-200';
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };
  const handleAddRootNode = () => {
    setCollapsedSections((current) => ({ ...current, fields: false }));
    onAddRootNode();
  };
  const updateValidation = (node: JsonSchemaNode, patch: Partial<JsonSchemaValidationRules>) => {
    const nextValidation = { ...(node.validation ?? {}), ...patch };
    for (const key of Object.keys(nextValidation) as Array<keyof JsonSchemaValidationRules>) {
      const value = nextValidation[key];
      if (value === '' || value === undefined || value === null) {
        delete nextValidation[key];
      }
    }
    onUpdateNode(node.id, { validation: Object.keys(nextValidation).length > 0 ? nextValidation : undefined });
  };
  const updateNumberRule = (node: JsonSchemaNode, key: keyof JsonSchemaValidationRules, value: string) => {
    updateValidation(node, { [key]: value.trim() === '' ? undefined : Number(value) });
  };
  const handleAddRef = () => {
    const target = otherDocuments[0];
    const nextRefs = [
      ...(doc.refs ?? []),
      {
        id: `json_ref_${Date.now().toString(36)}`,
        name: target?.name,
        targetSchemaId: target?.id,
        targetSchemaName: target?.name,
      },
    ];
    onUpdateDocument({ refs: nextRefs });
    setCollapsedSections((current) => ({ ...current, refs: false }));
  };

  return (
    <div className={panelText}>
      <PropertiesSection
        title="JSON Schema"
        collapsed={!!collapsedSections.schema}
        onToggle={() => toggleSection('schema')}
        darkMode={darkMode}
      >
        <div className="space-y-3">
          <div>
            <label className={`text-xs ${mutedText} mb-1 block`}>Schema Name</label>
            <Input
              value={doc.name}
              onChange={(e) => onRename(e.target.value)}
              disabled={readOnly}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`text-xs ${mutedText} mb-1 block`}>Description</label>
            <textarea
              value={doc.description || ''}
              onChange={(e) => onDescription(e.target.value)}
              disabled={readOnly}
              placeholder="JSON Schema description"
              className={`w-full text-sm border rounded-md px-3 py-2 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputCls}`}
            />
          </div>
          <div>
            <label className={`text-xs ${mutedText} mb-1 block`}>Schema ID</label>
            <Input
              value={doc.schemaId || ''}
              onChange={(e) => onUpdateDocument({ schemaId: e.target.value || undefined })}
              disabled={readOnly}
              placeholder="https://schemas.example.com/brand-metadata"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-xs ${mutedText} mb-1 block`}>Root Type</label>
              <Select
                value={doc.rootType || 'object'}
                onValueChange={(value) => onUpdateDocument({ rootType: value === 'array' ? 'array' : 'object' })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  <SelectItem value="object" className="text-gray-200 focus:bg-gray-800 focus:text-white">object</SelectItem>
                  <SelectItem value="array" className="text-gray-200 focus:bg-gray-800 focus:text-white">array</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {domains.length > 0 && onDomain && (
              <div>
                <label className={`text-xs ${mutedText} mb-1 block`}>Domain</label>
                <Select
                  value={doc.domainId || '_none_'}
                  onValueChange={(value) => onDomain(value === '_none_' ? undefined : value)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-200 text-gray-900">
                    <SelectValue placeholder="No domain" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="_none_" className="text-gray-200 focus:bg-gray-800 focus:text-white">No domain</SelectItem>
                    {domains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id} className="text-gray-200 focus:bg-gray-800 focus:text-white">
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </PropertiesSection>

      <PropertiesSection
        title="Fields"
        collapsed={!!collapsedSections.fields}
        onToggle={() => toggleSection('fields')}
        action={(
          <PanelIconButton label="Add field" onClick={handleAddRootNode} disabled={readOnly} darkMode={darkMode}>
            <Plus className="size-3.5" />
          </PanelIconButton>
        )}
        darkMode={darkMode}
      >
        <div className="space-y-2">
          {flat.map(({ node, depth, hasChildren }) => {
            const canNest = node.type === 'object' || node.type === 'array';
            const isCollapsed = !!node.collapsed;
            const isDragging = dragNodeId === node.id;
            const showAfterHint = dropHint?.nodeId === node.id && dropHint.mode === 'after';
            const showInsideHint = dropHint?.nodeId === node.id && dropHint.mode === 'inside';
            const isDetailsOpen = expandedNodeId === node.id;
            const rules = node.validation ?? {};
            return (
              <div
                key={node.id}
                className={`rounded-lg border p-2 ${nodeBg} ${isDragging ? 'opacity-50 border-blue-300' : nodeBorder}`}
                draggable={!readOnly}
                onDragStart={(e) => {
                  if (readOnly) return;
                  setDragNodeId(node.id);
                  e.dataTransfer.setData('text/plain', node.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDragNodeId(null);
                  setDropHint(null);
                }}
                onDragOver={(e) => {
                  if (readOnly || !dragNodeId || dragNodeId === node.id) return;
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const nearBottom = e.clientY > rect.top + rect.height * 0.65;
                  if (canNest && !nearBottom) {
                    setDropHint({ nodeId: node.id, mode: 'inside' });
                  } else {
                    setDropHint({ nodeId: node.id, mode: 'after' });
                  }
                }}
                onDragLeave={() => {
                  setDropHint((prev) => (prev?.nodeId === node.id ? null : prev));
                }}
                onDrop={(e) => {
                  if (readOnly || !dragNodeId || dragNodeId === node.id) return;
                  e.preventDefault();
                  if (dropHint?.nodeId !== node.id) return;

                  if (dropHint.mode === 'inside' && canNest) {
                    const siblings = parentChildrenMap.get(node.id) || [];
                    onMoveNode(dragNodeId, node.id, siblings.length);
                  } else {
                    const siblings = parentChildrenMap.get(node.parentId) || [];
                    const targetIndex = siblings.findIndex((siblingId) => siblingId === node.id);
                    onMoveNode(dragNodeId, node.parentId, targetIndex >= 0 ? targetIndex + 1 : siblings.length);
                  }

                  setDragNodeId(null);
                  setDropHint(null);
                }}
              >
                {showInsideHint && (
                  <div className="mb-2 rounded border border-dashed border-blue-400 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                    Drop to nest into "{node.name}"
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div style={{ width: depth * 18 }} className="shrink-0" />
                  <GripVertical className={`size-3.5 ${mutedText}`} />
                  {canNest && hasChildren ? (
                    <button
                      onClick={() => onToggleCollapsed(node.id)}
                      className="size-5 rounded hover:bg-gray-100 flex items-center justify-center"
                      disabled={readOnly}
                    >
                      {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                  ) : (
                    <span className="inline-block size-5" />
                  )}
                  <Input
                    value={node.name}
                    onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
                    disabled={readOnly}
                    className={`h-8 text-sm ${inputCls}`}
                  />
                  <Select
                    value={node.type}
                    onValueChange={(value) => onUpdateNode(node.id, { type: value as JsonSchemaNode['type'] })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs bg-white border-gray-200 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-white">
                      {JSON_SCHEMA_CANONICAL_TYPES.map((type: JsonSchemaNode['type']) => (
                        <SelectItem key={type} value={type} className="text-gray-200 focus:bg-gray-800 focus:text-white">{type}</SelectItem>
                      ))}
                      <SelectItem value="json" className="text-gray-200 focus:bg-gray-800 focus:text-white">json</SelectItem>
                    </SelectContent>
                  </Select>
                  {canNest && (
                    <Button size="sm" variant="ghost" onClick={() => onAddChildNode(node.id)} disabled={readOnly} className="h-8 px-2">
                      <Plus className="size-3.5" />
                    </Button>
                  )}
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!node.required}
                      onChange={(e) => onUpdateNode(node.id, { required: e.target.checked })}
                      disabled={readOnly}
                    />
                    required
                  </label>
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!node.nullable}
                      onChange={(e) => onUpdateNode(node.id, { nullable: !e.target.checked })}
                      disabled={readOnly}
                    />
                    not null
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedNodeId(isDetailsOpen ? null : node.id)}
                    className="h-8 px-2"
                  >
                    <Info className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteNode(node.id)}
                    disabled={readOnly}
                    className="h-8 px-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {isDetailsOpen && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <label className={`text-xs ${mutedText} mb-1 block`}>Description</label>
                      <textarea
                        value={node.description || ''}
                        onChange={(e) => onUpdateNode(node.id, { description: e.target.value || undefined })}
                        disabled={readOnly}
                        placeholder="Field meaning and business context"
                        className={`w-full text-sm border rounded-md px-3 py-2 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputCls}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-xs ${mutedText} mb-1 block`}>Default</label>
                        <Input
                          value={rules.defaultValue || ''}
                          onChange={(e) => updateValidation(node, { defaultValue: e.target.value || undefined })}
                          disabled={readOnly}
                          placeholder="JSON value or text"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={`text-xs ${mutedText} mb-1 block`}>Const</label>
                        <Input
                          value={rules.constValue || ''}
                          onChange={(e) => updateValidation(node, { constValue: e.target.value || undefined })}
                          disabled={readOnly}
                          placeholder="Fixed value"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`text-xs ${mutedText} mb-1 block`}>Enum values</label>
                      <Input
                        value={(node.enumValues ?? []).join(', ')}
                        onChange={(e) => onUpdateNode(node.id, {
                          enumValues: e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                        })}
                        disabled={readOnly}
                        placeholder="draft, active, archived"
                        className={inputCls}
                      />
                    </div>
                    {node.type === 'string' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Format</label>
                            <Input
                              value={rules.format || ''}
                              onChange={(e) => updateValidation(node, { format: e.target.value || undefined })}
                              disabled={readOnly}
                              placeholder="email, uri, uuid"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Pattern</label>
                            <Input
                              value={rules.pattern || ''}
                              onChange={(e) => updateValidation(node, { pattern: e.target.value || undefined })}
                              disabled={readOnly}
                              placeholder="Regular expression"
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Min length</label>
                            <Input type="number" value={rules.minLength ?? ''} onChange={(e) => updateNumberRule(node, 'minLength', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Max length</label>
                            <Input type="number" value={rules.maxLength ?? ''} onChange={(e) => updateNumberRule(node, 'maxLength', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                        </div>
                      </div>
                    )}
                    {(node.type === 'number' || node.type === 'integer') && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Minimum</label>
                            <Input type="number" value={rules.minimum ?? ''} onChange={(e) => updateNumberRule(node, 'minimum', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Maximum</label>
                            <Input type="number" value={rules.maximum ?? ''} onChange={(e) => updateNumberRule(node, 'maximum', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs flex items-center gap-1">
                            <input type="checkbox" checked={!!rules.exclusiveMinimum} onChange={(e) => updateValidation(node, { exclusiveMinimum: e.target.checked })} disabled={readOnly} />
                            exclusive min
                          </label>
                          <label className="text-xs flex items-center gap-1">
                            <input type="checkbox" checked={!!rules.exclusiveMaximum} onChange={(e) => updateValidation(node, { exclusiveMaximum: e.target.checked })} disabled={readOnly} />
                            exclusive max
                          </label>
                        </div>
                        <div>
                          <label className={`text-xs ${mutedText} mb-1 block`}>Multiple of</label>
                          <Input type="number" value={rules.multipleOf ?? ''} onChange={(e) => updateNumberRule(node, 'multipleOf', e.target.value)} disabled={readOnly} className={inputCls} />
                        </div>
                      </div>
                    )}
                    {node.type === 'array' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Min items</label>
                            <Input type="number" value={rules.minItems ?? ''} onChange={(e) => updateNumberRule(node, 'minItems', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Max items</label>
                            <Input type="number" value={rules.maxItems ?? ''} onChange={(e) => updateNumberRule(node, 'maxItems', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                        </div>
                        <label className="text-xs flex items-center gap-1">
                          <input type="checkbox" checked={!!rules.uniqueItems} onChange={(e) => updateValidation(node, { uniqueItems: e.target.checked })} disabled={readOnly} />
                          unique items
                        </label>
                      </div>
                    )}
                    {node.type === 'object' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Min properties</label>
                            <Input type="number" value={rules.minProperties ?? ''} onChange={(e) => updateNumberRule(node, 'minProperties', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                          <div>
                            <label className={`text-xs ${mutedText} mb-1 block`}>Max properties</label>
                            <Input type="number" value={rules.maxProperties ?? ''} onChange={(e) => updateNumberRule(node, 'maxProperties', e.target.value)} disabled={readOnly} className={inputCls} />
                          </div>
                        </div>
                        <label className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={rules.additionalProperties === false}
                            onChange={(e) => updateValidation(node, { additionalProperties: e.target.checked ? false : undefined })}
                            disabled={readOnly}
                          />
                          forbid extra fields
                        </label>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs flex items-center gap-1">
                        <input type="checkbox" checked={!!rules.readOnly} onChange={(e) => updateValidation(node, { readOnly: e.target.checked })} disabled={readOnly} />
                        read only
                      </label>
                      <label className="text-xs flex items-center gap-1">
                        <input type="checkbox" checked={!!rules.writeOnly} onChange={(e) => updateValidation(node, { writeOnly: e.target.checked })} disabled={readOnly} />
                        write only
                      </label>
                      <label className="text-xs flex items-center gap-1">
                        <input type="checkbox" checked={!!rules.deprecated} onChange={(e) => updateValidation(node, { deprecated: e.target.checked })} disabled={readOnly} />
                        deprecated
                      </label>
                    </div>
                  </div>
                )}
                {showAfterHint && (
                  <div className="mt-2 rounded border border-dashed border-blue-300 px-2 py-1 text-xs text-blue-600">
                    Drop after "{node.name}"
                  </div>
                )}
              </div>
            );
          })}
          {flat.length === 0 && (
            <div className="text-sm text-gray-500 py-2">No fields yet.</div>
          )}
        </div>
      </PropertiesSection>

      <PropertiesSection
        title="Refs"
        collapsed={!!collapsedSections.refs}
        onToggle={() => toggleSection('refs')}
        action={(
          <PanelIconButton label="Add reference" onClick={handleAddRef} disabled={readOnly || otherDocuments.length === 0} darkMode={darkMode}>
            <Plus className="size-3.5" />
          </PanelIconButton>
        )}
        darkMode={darkMode}
      >
        <div className="space-y-2">
          {(doc.refs ?? []).map((ref) => (
            <div key={ref.id} className={`rounded-lg border p-2 ${nodeBg} ${nodeBorder}`}>
              <div className="flex items-center gap-2">
                <Input
                  value={ref.name || ''}
                  onChange={(e) => onUpdateDocument({
                    refs: (doc.refs ?? []).map((item) => item.id === ref.id ? { ...item, name: e.target.value || undefined } : item),
                  })}
                  disabled={readOnly}
                  placeholder="Local alias"
                  className={`h-8 text-sm ${inputCls}`}
                />
                <Select
                  value={ref.targetSchemaId || '_none_'}
                  onValueChange={(targetSchemaId) => {
                    if (targetSchemaId === '_none_') {
                      onUpdateDocument({
                        refs: (doc.refs ?? []).map((item) => item.id === ref.id
                          ? { ...item, targetSchemaId: undefined, targetSchemaName: undefined }
                          : item),
                      });
                      return;
                    }
                    const target = allDocuments.find((item) => item.id === targetSchemaId);
                    onUpdateDocument({
                      refs: (doc.refs ?? []).map((item) => item.id === ref.id
                        ? { ...item, targetSchemaId, targetSchemaName: target?.name }
                        : item),
                    });
                  }}
                  disabled={readOnly || otherDocuments.length === 0}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs bg-white border-gray-200 text-gray-900">
                    <SelectValue placeholder="Schema" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="_none_" className="text-gray-200 focus:bg-gray-800 focus:text-white">
                      No target
                    </SelectItem>
                    {otherDocuments.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-gray-200 focus:bg-gray-800 focus:text-white">
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onUpdateDocument({ refs: (doc.refs ?? []).filter((item) => item.id !== ref.id) })}
                  disabled={readOnly}
                  className="h-8 px-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <textarea
                value={ref.description || ''}
                onChange={(e) => onUpdateDocument({
                  refs: (doc.refs ?? []).map((item) => item.id === ref.id ? { ...item, description: e.target.value || undefined } : item),
                })}
                disabled={readOnly}
                placeholder="Reference purpose"
                className={`mt-2 w-full text-sm border rounded-md px-3 py-2 resize-none h-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputCls}`}
              />
            </div>
          ))}
          {(doc.refs ?? []).length === 0 && (
            <div className="text-sm text-gray-500 py-2">
              {otherDocuments.length === 0 ? 'No other JSON schemas to reference.' : 'No references yet.'}
            </div>
          )}
        </div>
      </PropertiesSection>

      <PropertiesSection
        title="Usage"
        collapsed={!!collapsedSections.usage}
        onToggle={() => toggleSection('usage')}
        darkMode={darkMode}
      >
        <div className="space-y-1">
          {usageItems.map((item) => (
            <div key={`${item.tableName}.${item.fieldName}`} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {item.tableName}.{item.fieldName}
            </div>
          ))}
          {usageItems.length === 0 && (
            <div className="text-sm text-gray-500 py-2">No linked table fields yet.</div>
          )}
        </div>
      </PropertiesSection>

      <PropertiesSection
        title="Note"
        collapsed={!!collapsedSections.note}
        onToggle={() => toggleSection('note')}
        darkMode={darkMode}
      >
        <textarea
          value={doc.notes || ''}
          onChange={(event) => onUpdateDocument({ notes: event.target.value })}
          disabled={readOnly}
          placeholder="Project notes for this JSON schema..."
          className={`w-full min-h-24 text-sm border rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputCls}`}
        />
      </PropertiesSection>
    </div>
  );
}

function buildChildrenMap(nodes: JsonSchemaNode[]): Map<string | undefined, string[]> {
  const map = new Map<string | undefined, string[]>();
  for (const node of nodes) {
    const key = node.parentId;
    const list = map.get(key) || [];
    list.push(node.id);
    map.set(key, list);
  }
  for (const [key, ids] of map.entries()) {
    const sorted = ids.slice().sort((a, b) => {
      const nodeA = nodes.find((node) => node.id === a);
      const nodeB = nodes.find((node) => node.id === b);
      return (nodeA?.order ?? 0) - (nodeB?.order ?? 0);
    });
    map.set(key, sorted);
  }
  return map;
}

function flattenNodes(nodes: JsonSchemaNode[]): FlatNode[] {
  const childrenByParent = new Map<string | undefined, JsonSchemaNode[]>();
  for (const node of nodes) {
    const key = node.parentId;
    const list = childrenByParent.get(key) || [];
    list.push(node);
    childrenByParent.set(key, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const output: FlatNode[] = [];

  const walk = (parentId: string | undefined, depth: number) => {
    const children = childrenByParent.get(parentId) || [];
    for (const child of children) {
      const hasChildren = (childrenByParent.get(child.id) || []).length > 0;
      output.push({ node: child, depth, hasChildren });
      if (hasChildren && !child.collapsed) {
        walk(child.id, depth + 1);
      }
    }
  };

  walk(undefined, 0);
  return output;
}
