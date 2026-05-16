import { JsonSchemaDetailsPanel } from '@/pages/editor/ui/JsonSchemaDetailsPanel';
import type { ProjectData } from '@/shared/types/project';
import type { Domain, JsonSchemaDocument, JsonSchemaNode } from '@/shared/types/schema';
import { nextWorkspaceId } from '../model/workspace-project-utils';

export function JsonSchemaProperties({
  project,
  doc,
  domains,
  onUpdateJsonSchema,
}: {
  project: ProjectData;
  doc: JsonSchemaDocument;
  domains: Domain[];
  onUpdateJsonSchema: (docId: string, updates: Partial<Omit<JsonSchemaDocument, 'id'>>) => void;
}) {
  const updateNodes = (nodes: JsonSchemaNode[]) => onUpdateJsonSchema(doc.id, { nodes });

  return (
    <div className="h-full overflow-auto bg-white p-4">
      <JsonSchemaDetailsPanel
        doc={doc}
        domains={domains}
        allDocuments={project.schema.jsonSchemas ?? []}
        usageItems={project.schema.tables.flatMap((table) => table.fields
          .filter((field) => field.jsonSchemaId === doc.id || field.jsonSchemaName === doc.name)
          .map((field) => ({ tableName: table.name, fieldName: field.name })))}
        onUpdateDocument={(updates) => onUpdateJsonSchema(doc.id, updates)}
        onRename={(name) => onUpdateJsonSchema(doc.id, { name })}
        onDescription={(description) => onUpdateJsonSchema(doc.id, { description })}
        onDomain={(domainId) => onUpdateJsonSchema(doc.id, { domainId })}
        onAddRootNode={() => updateNodes([
          ...doc.nodes,
          { id: nextWorkspaceId('json_node'), name: `field_${doc.nodes.filter((node) => !node.parentId).length + 1}`, type: 'string', order: doc.nodes.length },
        ])}
        onAddChildNode={(nodeId) => {
          const childCount = doc.nodes.filter((node) => node.parentId === nodeId).length;
          updateNodes([
            ...doc.nodes,
            { id: nextWorkspaceId('json_node'), name: `field_${childCount + 1}`, type: 'string', parentId: nodeId, order: childCount },
          ]);
        }}
        onUpdateNode={(nodeId, updates) => updateNodes(doc.nodes.map((node) => node.id === nodeId ? { ...node, ...updates } : node))}
        onDeleteNode={(nodeId) => {
          const removeIds = new Set<string>([nodeId]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const node of doc.nodes) {
              if (node.parentId && removeIds.has(node.parentId) && !removeIds.has(node.id)) {
                removeIds.add(node.id);
                changed = true;
              }
            }
          }
          updateNodes(doc.nodes.filter((node) => !removeIds.has(node.id)));
        }}
        onToggleCollapsed={(nodeId) => updateNodes(doc.nodes.map((node) => node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node))}
        onMoveNode={(nodeId, targetParentId, targetOrder) => updateNodes(doc.nodes.map((node) => (
          node.id === nodeId ? { ...node, parentId: targetParentId, order: targetOrder } : node
        )))}
      />
    </div>
  );
}
