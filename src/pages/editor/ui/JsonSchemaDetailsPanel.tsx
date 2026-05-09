import type { JsonSchemaDocument, JsonSchemaNode } from '../model/types';
import { JSON_SCHEMA_CANONICAL_TYPES } from '../model/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface JsonSchemaDetailsPanelProps {
  doc: JsonSchemaDocument;
  readOnly?: boolean;
  darkMode?: boolean;
  onRename: (name: string) => void;
  onDescription: (description: string) => void;
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
  readOnly = false,
  darkMode = false,
  onRename,
  onDescription,
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
  const parentChildrenMap = useMemo(() => buildChildrenMap(doc.nodes), [doc.nodes]);

  const panelText = darkMode ? 'text-[#cdd6f4]' : 'text-gray-900';
  const mutedText = darkMode ? 'text-[#a6adc8]' : 'text-gray-600';
  const nodeBorder = darkMode ? 'border-[#585b70]' : 'border-gray-200';
  const nodeBg = darkMode ? 'bg-transparent' : 'bg-white';
  const inputCls = darkMode
    ? 'bg-white text-gray-900 border-gray-200'
    : 'bg-white text-gray-900 border-gray-200';

  return (
    <div className={`p-4 space-y-4 ${panelText}`}>
      <div className="space-y-2">
        <Input
          value={doc.name}
          onChange={(e) => onRename(e.target.value)}
          disabled={readOnly}
          className={inputCls}
        />
        <textarea
          value={doc.description || ''}
          onChange={(e) => onDescription(e.target.value)}
          disabled={readOnly}
          placeholder="JSON Schema description"
          className={`w-full text-sm border rounded-md px-3 py-2 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputCls}`}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Schema Fields</h3>
        <Button size="sm" variant="outline" onClick={onAddRootNode} disabled={readOnly}>
          <Plus className="size-3 mr-1" /> Add root field
        </Button>
      </div>

      <div className="space-y-2">
        {flat.map(({ node, depth, hasChildren }) => {
          const canNest = node.type === 'object' || node.type === 'array';
          const isCollapsed = !!node.collapsed;
          const isDragging = dragNodeId === node.id;
          const showAfterHint = dropHint?.nodeId === node.id && dropHint.mode === 'after';
          const showInsideHint = dropHint?.nodeId === node.id && dropHint.mode === 'inside';
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
                  onClick={() => onDeleteNode(node.id)}
                  disabled={readOnly}
                  className="h-8 px-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
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
