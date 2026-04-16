export type { SchemaSerializer } from './types';
export { jsonSerializer } from './json-serializer';
export { ddlSerializer } from './ddl-serializer';
export { supabaseRlsSerializer } from './supabase-rls-serializer';
export { mermaidSerializer } from './mermaid-serializer';

import type { SchemaSerializer } from './types';
import { jsonSerializer } from './json-serializer';
import { ddlSerializer } from './ddl-serializer';
import { supabaseRlsSerializer } from './supabase-rls-serializer';
import { mermaidSerializer } from './mermaid-serializer';

/** Реестр всех доступных сериализаторов */
export const serializers: SchemaSerializer[] = [
  jsonSerializer,
  ddlSerializer,
  supabaseRlsSerializer,
  mermaidSerializer,
];

/** Получить сериализатор по ID */
export function getSerializer(id: string): SchemaSerializer | undefined {
  return serializers.find(s => s.id === id);
}

/** Получить все сериализаторы, поддерживающие экспорт */
export function getExportSerializers(): SchemaSerializer[] {
  return serializers.filter(s => s.canExport);
}

/** Получить все сериализаторы, поддерживающие импорт */
export function getImportSerializers(): SchemaSerializer[] {
  return serializers.filter(s => s.canImport);
}