import type { SchemaSerializer } from './types';
import type { Schema } from '../../model/types';

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
    const parsed = JSON.parse(content);

    if (!parsed.tables || !Array.isArray(parsed.tables)) {
      throw new Error('Invalid JSON schema: missing "tables" array');
    }

    return {
      tables: parsed.tables,
      relations: parsed.relations || [],
      domains: parsed.domains || [],
    };
  },
};