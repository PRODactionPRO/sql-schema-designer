import type { SchemaSerializer } from './types';
import type { JsonSchemaDocument, JsonSchemaNode, Schema } from '../../model/types';

interface CanonicalJsonSchema {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  $id?: string;
  title: string;
  description?: string;
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export const jsonSchemaSerializer: SchemaSerializer = {
  id: 'json-schema',
  name: 'JSON Schema 2020-12',
  description: 'Export JSON Schema documents as canonical JSON Schema draft 2020-12',
  fileExtension: '.json',
  mimeType: 'application/json',
  canImport: false,
  canExport: true,

  serialize(schema: Schema): string {
    const docs = schema.jsonSchemas ?? [];
    const payload = docs.map((doc) => serializeDocument(doc));
    return JSON.stringify(payload, null, 2);
  },

  deserialize(): Schema {
    throw new Error('Import for JSON Schema format is not supported yet');
  },
};

function serializeDocument(doc: JsonSchemaDocument): CanonicalJsonSchema {
  const rootNodes = doc.nodes
    .filter((node) => !node.parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const objectResult = buildObjectFromChildren(doc.nodes, rootNodes);

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: doc.name,
    description: doc.description,
    type: 'object',
    properties: objectResult.properties,
    ...(objectResult.required.length > 0 ? { required: objectResult.required } : {}),
  };
}

function buildObjectFromChildren(
  allNodes: JsonSchemaNode[],
  children: JsonSchemaNode[],
): { properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const child of children) {
    properties[child.name] = nodeToCanonicalSchema(child, allNodes);
    if (child.required) required.push(child.name);
  }

  return { properties, required };
}

function nodeToCanonicalSchema(node: JsonSchemaNode, allNodes: JsonSchemaNode[]): unknown {
  const directChildren = allNodes
    .filter((item) => item.parentId === node.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let base: Record<string, unknown>;
  switch (node.type) {
    case 'string':
      base = { type: 'string' };
      break;
    case 'number':
      base = { type: 'number' };
      break;
    case 'integer':
      base = { type: 'integer' };
      break;
    case 'boolean':
      base = { type: 'boolean' };
      break;
    case 'null':
      base = { type: 'null' };
      break;
    case 'object': {
      const objectResult = buildObjectFromChildren(allNodes, directChildren);
      base = {
        type: 'object',
        properties: objectResult.properties,
        ...(objectResult.required.length > 0 ? { required: objectResult.required } : {}),
      };
      break;
    }
    case 'array': {
      // MVP: list arrays only. If multiple children are present, represent list item as object.
      let items: unknown = {};
      if (directChildren.length === 1) {
        items = nodeToCanonicalSchema(directChildren[0], allNodes);
      } else if (directChildren.length > 1) {
        const objectResult = buildObjectFromChildren(allNodes, directChildren);
        items = {
          type: 'object',
          properties: objectResult.properties,
          ...(objectResult.required.length > 0 ? { required: objectResult.required } : {}),
        };
      }
      base = { type: 'array', items };
      break;
    }
    case 'json':
      base = {};
      break;
    default:
      base = {};
  }

  if (node.description?.trim()) {
    base.description = node.description.trim();
  }

  if (!node.nullable) return base;
  if (Object.keys(base).length === 0) return {};

  const typeValue = base.type;
  if (typeof typeValue === 'string') {
    const next = { ...base };
    delete next.type;
    return { ...next, type: [typeValue, 'null'] };
  }

  return {
    anyOf: [base, { type: 'null' }],
  };
}
