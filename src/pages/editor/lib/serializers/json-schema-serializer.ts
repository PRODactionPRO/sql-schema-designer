import type { SchemaSerializer } from './types';
import type { JsonSchemaDocument, JsonSchemaNode, Schema } from '../../model/types';

interface CanonicalJsonSchema {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  $id?: string;
  title: string;
  description?: string;
  type: 'object' | 'array';
  properties?: Record<string, unknown>;
  items?: unknown;
  required?: string[];
  $defs?: Record<string, unknown>;
  examples?: unknown[];
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
    ...(doc.schemaId?.trim() ? { $id: doc.schemaId.trim() } : {}),
    title: doc.name,
    description: doc.description,
    ...(doc.examples && doc.examples.length > 0 ? { examples: doc.examples.map((example) => parseJsonishValue(example.value)) } : {}),
    ...(doc.rootType === 'array'
      ? {
          type: 'array' as const,
          items: {
            type: 'object',
            properties: objectResult.properties,
            ...(objectResult.required.length > 0 ? { required: objectResult.required } : {}),
          },
        }
      : {
          type: 'object' as const,
          properties: objectResult.properties,
          ...(objectResult.required.length > 0 ? { required: objectResult.required } : {}),
        }),
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

  applyValidationRules(base, node);

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

function applyValidationRules(base: Record<string, unknown>, node: JsonSchemaNode): void {
  const rules = node.validation;
  if (!rules) return;

  if (rules.defaultValue?.trim()) base.default = parseJsonishValue(rules.defaultValue);
  if (rules.constValue?.trim()) base.const = parseJsonishValue(rules.constValue);
  if (node.enumValues && node.enumValues.length > 0) base.enum = node.enumValues;
  if (rules.format?.trim()) base.format = rules.format.trim();
  if (rules.pattern?.trim()) base.pattern = rules.pattern.trim();

  for (const key of ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'minItems', 'maxItems', 'minProperties', 'maxProperties'] as const) {
    const value = rules[key];
    if (typeof value === 'number' && Number.isFinite(value)) base[key] = value;
  }

  if (rules.exclusiveMinimum && typeof rules.minimum === 'number') {
    base.exclusiveMinimum = rules.minimum;
    delete base.minimum;
  }
  if (rules.exclusiveMaximum && typeof rules.maximum === 'number') {
    base.exclusiveMaximum = rules.maximum;
    delete base.maximum;
  }
  if (rules.uniqueItems) base.uniqueItems = true;
  if (typeof rules.additionalProperties === 'boolean') base.additionalProperties = rules.additionalProperties;
  if (rules.readOnly) base.readOnly = true;
  if (rules.writeOnly) base.writeOnly = true;
  if (rules.deprecated) base.deprecated = true;
}

function parseJsonishValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
