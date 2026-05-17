// ── Shared schema domain types ──
// Used across pages/editor and pages/projects

export type FieldType =
  | 'uuid'
  | 'bigint'
  | 'integer'
  | 'smallint'
  | 'serial'
  | 'bigserial'
  | 'varchar'
  | 'text'
  | 'citext'
  | 'boolean'
  | 'timestamp'
  | 'timestamptz'
  | 'date'
  | 'time'
  | 'interval'
  | 'json'
  | 'jsonb'
  | 'decimal'
  | 'numeric'
  | 'real'
  | 'double precision'
  | 'money'
  | 'bytea'
  | 'inet'
  | 'cidr'
  | 'macaddr'
  | 'point'
  | 'line'
  | 'polygon'
  | 'circle'
  | 'xml'
  | 'array'
  | 'vector'
  | 'enum';

export const ALL_FIELD_TYPES: FieldType[] = [
  'uuid', 'bigint', 'integer', 'smallint', 'serial', 'bigserial',
  'varchar', 'text', 'citext',
  'boolean',
  'timestamp', 'timestamptz', 'date', 'time', 'interval',
  'json', 'jsonb',
  'decimal', 'numeric', 'real', 'double precision', 'money',
  'bytea', 'inet', 'cidr', 'macaddr',
  'point', 'line', 'polygon', 'circle',
  'xml', 'array', 'vector', 'enum'
];

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  comment?: string;
  enumId?: string;
  enumName?: string;
  jsonSchemaId?: string;
  jsonSchemaName?: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyField?: string;
  defaultValue?: string;
  isUnique?: boolean;
  isIndexed?: boolean;
  isNotNull?: boolean;
}

export type TableConstraintType = 'primary_key' | 'unique' | 'foreign_key' | 'check';

export type ReferentialAction = 'no_action' | 'restrict' | 'cascade' | 'set_null' | 'set_default';

export interface BaseTableConstraint {
  id: string;
  type: TableConstraintType;
  name?: string;
  description?: string;
}

export interface PrimaryKeyConstraint extends BaseTableConstraint {
  type: 'primary_key';
  columnIds: string[];
}

export interface UniqueConstraint extends BaseTableConstraint {
  type: 'unique';
  columnIds: string[];
  nullsNotDistinct?: boolean;
}

export interface ForeignKeyConstraint extends BaseTableConstraint {
  type: 'foreign_key';
  columnIds: string[];
  referencedTableId: string;
  referencedColumnIds: string[];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
}

export interface CheckConstraint extends BaseTableConstraint {
  type: 'check';
  expression: string;
}

export type TableConstraint =
  | PrimaryKeyConstraint
  | UniqueConstraint
  | ForeignKeyConstraint
  | CheckConstraint;

export type IndexMethod = 'btree' | 'hash' | 'gist' | 'spgist' | 'gin' | 'brin';

export interface TableIndexColumn {
  fieldId?: string;
  expression?: string;
  sort?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface TableIndex {
  id: string;
  name?: string;
  columns: TableIndexColumn[];
  unique?: boolean;
  method?: IndexMethod;
  includeFieldIds?: string[];
  where?: string;
  description?: string;
}

export interface Domain {
  id: string;
  name: string;
  color: string;
}

export interface EnumType {
  id: string;
  name: string;
  values: string[];
  valueComments?: Array<string | undefined>;
  valueMetadata?: EnumValueMetadata[];
  description?: string;
  notes?: string;
  storageStrategy?: EnumStorageStrategy;
  position?: { x: number; y: number };
  domainId?: string;
  sidebarOrder?: number;
  collapsed?: boolean; // UI-only canvas state
}

export type EnumStorageStrategy = 'postgres_enum' | 'check_constraint' | 'lookup_table';

export interface EnumValueMetadata {
  label?: string;
  description?: string;
  sortOrder?: number;
  color?: string;
  isActive?: boolean;
  deprecated?: boolean;
  aliases?: string[];
}

export type JsonSchemaFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'json';

export const JSON_SCHEMA_CANONICAL_TYPES: JsonSchemaFieldType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
];

export interface JsonSchemaNode {
  id: string;
  name: string;
  type: JsonSchemaFieldType;
  parentId?: string;
  order?: number;
  required?: boolean; // Applies on parent object level in canonical JSON Schema
  nullable?: boolean; // Maps to union with null
  collapsed?: boolean; // UI-only convenience
  enumValues?: string[]; // Used when type === 'enum'
  validation?: JsonSchemaValidationRules;
  description?: string;
}

export type JsonSchemaRootType = 'object' | 'array';

export interface JsonSchemaValidationRules {
  defaultValue?: string;
  constValue?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
}

export interface JsonSchemaExample {
  id: string;
  name: string;
  description?: string;
  value: string;
}

export interface JsonSchemaReference {
  id: string;
  name?: string;
  targetSchemaId?: string;
  targetSchemaName?: string;
  description?: string;
}

export interface JsonSchemaDocument {
  id: string;
  name: string;
  description?: string;
  schemaId?: string;
  rootType?: JsonSchemaRootType;
  nodes: JsonSchemaNode[];
  refs?: JsonSchemaReference[];
  examples?: JsonSchemaExample[];
  notes?: string;
  position?: { x: number; y: number };
  domainId?: string;
  sidebarOrder?: number;
  collapsed?: boolean; // UI-only canvas state
}

export interface Table {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  fields: Field[];
  constraints?: TableConstraint[];
  indexes?: TableIndex[];
  position: { x: number; y: number };
  color?: string;
  schema?: string; // e.g. 'public'
  domainId?: string;
  sidebarOrder?: number;
  collapsed?: boolean; // UI-only canvas state
}

export type RelationType = '1:1' | '1:N' | 'N:1' | 'N:M';

export interface Relation {
  id: string;
  fromTableId: string;
  fromFieldId: string;
  toTableId: string;
  toFieldId: string;
  type: RelationType;
}

export interface Schema {
  schemaVersion?: number;
  tables: Table[];
  relations: Relation[];
  domains?: Domain[];
  enums?: EnumType[];
  jsonSchemas?: JsonSchemaDocument[];
}

// Serialization format identifier
export type SerializationFormat = 'json' | 'postgresql' | 'supabase-rls' | 'mermaid';

export type LineType = 'curved' | 'orthogonal' | 'straight';

export interface ProjectSettings {
  lineType: LineType;
  enabledFieldTypes: FieldType[];
  autoSaveIntervalSec: number;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  lineType: 'curved',
  enabledFieldTypes: [...ALL_FIELD_TYPES],
  autoSaveIntervalSec: 60,
};

// Default domain colors
export const DOMAIN_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

// ── Type Compatibility Groups ──
// Fields within the same group can be linked via FK (compatible implicit casts in PostgreSQL)
const TYPE_COMPATIBILITY_GROUPS: Record<string, FieldType[]> = {
  integer: ['bigint', 'integer', 'smallint', 'serial', 'bigserial'],
  text: ['varchar', 'text', 'citext'],
  uuid: ['uuid'],
  boolean: ['boolean'],
  timestamp: ['timestamp', 'timestamptz'],
  date: ['date'],
  time: ['time'],
  interval: ['interval'],
  json: ['json', 'jsonb'],
  numeric: ['decimal', 'numeric', 'real', 'double precision', 'money'],
  binary: ['bytea'],
  network: ['inet', 'cidr', 'macaddr'],
  geometric: ['point', 'line', 'polygon', 'circle'],
  xml: ['xml'],
  array: ['array'],
  vector: ['vector'],
  enum: ['enum'],
};

/** Get the compatibility group name for a field type */
export function getTypeGroup(type: FieldType): string {
  for (const [group, types] of Object.entries(TYPE_COMPATIBILITY_GROUPS)) {
    if ((types as string[]).includes(type)) return group;
  }
  return type; // fallback: self-group
}

/** Check if two field types are compatible for FK linking */
export function areTypesCompatible(type1: FieldType, type2: FieldType): boolean {
  return getTypeGroup(type1) === getTypeGroup(type2);
}

// ── Three-level type compatibility ──

export type TypeCompatibility = 'exact' | 'compatible' | 'warning' | 'forbidden';

type CompatibilityFieldLike = Pick<Field, 'type' | 'enumId' | 'enumName'>;
type CompatibilityInput = FieldType | CompatibilityFieldLike;

function toCompatibilityField(input: CompatibilityInput): CompatibilityFieldLike {
  if (typeof input === 'string') {
    return { type: input };
  }
  return input;
}

/**
 * Cross-group casts that PostgreSQL supports via explicit CAST.
 * These produce a "warning" level — the link is allowed but risky.
 * Format: "groupA:groupB" (order-independent, checked both ways).
 */
const CASTABLE_CROSS_GROUPS = new Set<string>([
  'integer:numeric',   // int <-> decimal/numeric — explicit cast
  'timestamp:date',    // timestamp -> date extraction
  'timestamp:time',    // timestamp -> time extraction
  'text:uuid',         // text representation of uuid
  'text:integer',      // text can hold numbers
  'text:numeric',      // text can hold decimals
  'text:boolean',      // text 'true'/'false'
  'text:date',         // text '2024-01-01'
  'text:timestamp',    // text iso timestamp
  'text:json',         // text is valid json
  'text:enum',         // text <-> enum
]);

/** Get detailed compatibility level between two types for FK linking */
export function getTypeCompatibility(
  input1: CompatibilityInput,
  input2: CompatibilityInput,
): TypeCompatibility {
  const left = toCompatibilityField(input1);
  const right = toCompatibilityField(input2);
  const type1 = left.type;
  const type2 = right.type;

  // Enum fields are compatible only with the same enum type.
  if (type1 === 'enum' || type2 === 'enum') {
    if (type1 !== 'enum' || type2 !== 'enum') return 'forbidden';
    if (left.enumId && right.enumId) return left.enumId === right.enumId ? 'exact' : 'forbidden';
    if (left.enumName && right.enumName) return left.enumName.toLowerCase() === right.enumName.toLowerCase() ? 'exact' : 'forbidden';
    return 'forbidden';
  }

  if (type1 === type2) return 'exact';
  const g1 = getTypeGroup(type1);
  const g2 = getTypeGroup(type2);
  if (g1 === g2) return 'compatible';
  // Check cross-group castable pairs
  if (CASTABLE_CROSS_GROUPS.has(`${g1}:${g2}`) || CASTABLE_CROSS_GROUPS.has(`${g2}:${g1}`)) {
    return 'warning';
  }
  return 'forbidden';
}
