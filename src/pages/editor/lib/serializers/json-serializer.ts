import type { SchemaSerializer } from './types';
import type { Schema } from '../../model/types';
import { safeJsonParse } from '@/shared/lib/json';
import { normalizeSchema } from '@/shared/lib/schema-normalizer';

export const jsonSerializer: SchemaSerializer = {
  id: 'json',
  name: 'JSON',
  description: 'Export/import as JSON schema representation',
  fileExtension: '.json',
  mimeType: 'application/json',
  canImport: true,
  canExport: true,

  serialize(schema: Schema): string {
    return JSON.stringify(schema, null, 2);
  },

  deserialize(content: string): Schema {
    const parsed = safeJsonParse<unknown>(content, null);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON schema: missing "tables" array');
    }
    return normalizeSchema(parsed);
  },
};
