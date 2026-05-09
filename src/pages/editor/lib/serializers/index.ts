export type { SchemaSerializer } from './types';
export { jsonSerializer } from './json-serializer';
export { ddlSerializer } from './ddl-serializer';
export { supabaseRlsSerializer } from './supabase-rls-serializer';
export { mermaidSerializer } from './mermaid-serializer';
export { jsonSchemaSerializer } from './json-schema-serializer';

import type { SchemaSerializer } from './types';
import { jsonSerializer } from './json-serializer';
import { ddlSerializer } from './ddl-serializer';
import { supabaseRlsSerializer } from './supabase-rls-serializer';
import { mermaidSerializer } from './mermaid-serializer';
import { jsonSchemaSerializer } from './json-schema-serializer';

/** Registry of all available serializers */
export const serializers: SchemaSerializer[] = [
  jsonSerializer,
  ddlSerializer,
  supabaseRlsSerializer,
  mermaidSerializer,
  jsonSchemaSerializer,
];

/** Get serializer by ID */
export function getSerializer(id: string): SchemaSerializer | undefined {
  return serializers.find(s => s.id === id);
}

/** Get all serializers that support export */
export function getExportSerializers(): SchemaSerializer[] {
  return serializers.filter(s => s.canExport);
}

/** Get all serializers that support import */
export function getImportSerializers(): SchemaSerializer[] {
  return serializers.filter(s => s.canImport);
}
