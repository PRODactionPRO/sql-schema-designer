import type { Schema } from '../../model/types';

export interface SchemaSerializer {
  /** Unique format identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Format description */
  description: string;
  /** File extension */
  fileExtension: string;
  /** MIME type */
  mimeType: string;

  /** Serialize schema to string */
  serialize(schema: Schema): string;

  /** Deserialize string into schema */
  deserialize(content: string): Schema;

  /** Whether format supports import */
  canImport: boolean;

  /** Whether format supports export */
  canExport: boolean;
}
