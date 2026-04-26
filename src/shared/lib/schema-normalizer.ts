import {
  ALL_FIELD_TYPES,
  DEFAULT_PROJECT_SETTINGS,
  type Domain,
  type EnumType,
  type Field,
  type FieldType,
  type ProjectSettings,
  type Relation,
  type Table,
} from '@/shared/types/schema';
import type { ProjectData } from '@/shared/types/project';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeFieldType(value: unknown): FieldType {
  const type = asString(value, 'varchar') as FieldType;
  return ALL_FIELD_TYPES.includes(type) ? type : 'varchar';
}

function normalizeField(value: unknown, index: number): Field {
  const record = isRecord(value) ? value : {};
  const type = normalizeFieldType(record.type);
  return {
    id: asString(record.id, `field_${index}`),
    name: asString(record.name, `field_${index}`),
    type,
    enumId: type === 'enum' ? asString(record.enumId) || undefined : undefined,
    enumName: type === 'enum' ? asString(record.enumName) || undefined : undefined,
    isPrimaryKey: asBoolean(record.isPrimaryKey),
    isNullable: asBoolean(record.isNullable, true),
    isForeignKey: asBoolean(record.isForeignKey),
    foreignKeyTable: asString(record.foreignKeyTable) || undefined,
    foreignKeyField: asString(record.foreignKeyField) || undefined,
    defaultValue: asString(record.defaultValue) || undefined,
    isUnique: asBoolean(record.isUnique),
    isIndexed: asBoolean(record.isIndexed),
    isNotNull: asBoolean(record.isNotNull),
  };
}

function normalizeDomain(value: unknown, index: number): Domain {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `domain_${index}`),
    name: asString(record.name, `Domain ${index + 1}`),
    color: asString(record.color, '#6366f1'),
  };
}

function normalizeEnumType(value: unknown, index: number): EnumType {
  const record = isRecord(value) ? value : {};
  const rawValues = Array.isArray(record.values) ? record.values : [];
  const values = rawValues
    .map((item) => asString(item).trim())
    .filter((item) => item.length > 0);
  const uniqueValues = Array.from(new Set(values));

  return {
    id: asString(record.id, `enum_${index}`),
    name: asString(record.name, `Enum${index + 1}`),
    values: uniqueValues,
    description: asString(record.description) || undefined,
  };
}

function normalizeTable(value: unknown, index: number): Table {
  const record = isRecord(value) ? value : {};
  const fieldsRaw = Array.isArray(record.fields) ? record.fields : [];

  return {
    id: asString(record.id, `table_${index}`),
    name: asString(record.name, `table_${index + 1}`),
    description: asString(record.description) || undefined,
    fields: fieldsRaw.map((field, fieldIndex) => normalizeField(field, fieldIndex)),
    position: {
      x: asNumber(isRecord(record.position) ? record.position.x : undefined, 100 + index * 40),
      y: asNumber(isRecord(record.position) ? record.position.y : undefined, 100 + index * 40),
    },
    color: asString(record.color) || undefined,
    schema: asString(record.schema) || undefined,
    domainId: asString(record.domainId) || undefined,
  };
}

function normalizeRelation(value: unknown, index: number): Relation {
  const record = isRecord(value) ? value : {};
  const type = asString(record.type, '1:N');
  const relationType: Relation['type'] =
    type === '1:1' || type === '1:N' || type === 'N:1' || type === 'N:M' ? type : '1:N';

  return {
    id: asString(record.id, `relation_${index}`),
    fromTableId: asString(record.fromTableId),
    fromFieldId: asString(record.fromFieldId),
    toTableId: asString(record.toTableId),
    toFieldId: asString(record.toFieldId),
    type: relationType,
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeTableNames(tables: Table[]): Table[] {
  const seen = new Set<string>();

  return tables.map((table) => {
    const baseName = table.name || 'table';
    const lowerBase = baseName.toLowerCase();
    if (!seen.has(lowerBase)) {
      seen.add(lowerBase);
      return table;
    }

    let suffix = 2;
    let candidate = `${baseName}_${suffix}`;
    while (seen.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${baseName}_${suffix}`;
    }

    seen.add(candidate.toLowerCase());
    return { ...table, name: candidate };
  });
}

export function normalizeSchema(input: unknown): NormalizedSchema {
  const record = isRecord(input) ? input : {};

  const tables = dedupeTableNames(uniqueById((Array.isArray(record.tables) ? record.tables : []).map(normalizeTable)));
  const domains = uniqueById((Array.isArray(record.domains) ? record.domains : []).map(normalizeDomain));
  const enums = uniqueById((Array.isArray(record.enums) ? record.enums : []).map(normalizeEnumType));

  const tableById = new Map(tables.map((table) => [table.id, table]));
  const domainIdSet = new Set(domains.map((domain) => domain.id));
  const enumById = new Map(enums.map((enumType) => [enumType.id, enumType]));
  const enumByName = new Map(enums.map((enumType) => [enumType.name.toLowerCase(), enumType]));

  const normalizedTables = tables.map((table) => ({
    ...table,
    domainId: table.domainId && domainIdSet.has(table.domainId) ? table.domainId : undefined,
    fields: uniqueById(table.fields).map((field) => {
      if (field.type !== 'enum') {
        return { ...field, enumId: undefined, enumName: undefined };
      }

      const matchedById = field.enumId ? enumById.get(field.enumId) : undefined;
      const matchedByName = field.enumName ? enumByName.get(field.enumName.toLowerCase()) : undefined;
      const matched = matchedById ?? matchedByName;
      if (!matched) {
        return { ...field, enumId: undefined, enumName: undefined };
      }
      return { ...field, enumId: matched.id, enumName: matched.name };
    }),
  }));

  const relations = uniqueById((Array.isArray(record.relations) ? record.relations : []).map(normalizeRelation)).filter((relation) => {
    const fromTable = tableById.get(relation.fromTableId);
    const toTable = tableById.get(relation.toTableId);
    if (!fromTable || !toTable) return false;

    const fromFieldExists = fromTable.fields.some((field) => field.id === relation.fromFieldId);
    const toFieldExists = toTable.fields.some((field) => field.id === relation.toFieldId);
    return fromFieldExists && toFieldExists;
  });

  return {
    tables: normalizedTables,
    relations,
    domains,
    enums,
  };
}

function normalizeSettings(value: unknown): ProjectSettings {
  const record = isRecord(value) ? value : {};
  const lineType = asString(record.lineType, DEFAULT_PROJECT_SETTINGS.lineType);
  const enabledFieldTypesRaw = Array.isArray(record.enabledFieldTypes) ? record.enabledFieldTypes : DEFAULT_PROJECT_SETTINGS.enabledFieldTypes;
  const enabledFieldTypes = enabledFieldTypesRaw
    .map((item) => asString(item) as FieldType)
    .filter((item): item is FieldType => ALL_FIELD_TYPES.includes(item));

  return {
    lineType: lineType === 'curved' || lineType === 'orthogonal' || lineType === 'straight' ? lineType : DEFAULT_PROJECT_SETTINGS.lineType,
    enabledFieldTypes: enabledFieldTypes.length > 0 ? enabledFieldTypes : [...DEFAULT_PROJECT_SETTINGS.enabledFieldTypes],
  };
}

export function normalizeProjectData(input: unknown): ProjectData | null {
  if (!isRecord(input)) return null;
  if (!input.id || !input.name || !input.schema) return null;

  const schema = normalizeSchema(input.schema);
  const createdAt = asString(input.createdAt, new Date().toISOString());
  const updatedAt = asString(input.updatedAt, new Date().toISOString());

  return {
    id: asString(input.id),
    name: asString(input.name, 'Untitled project'),
    description: asString(input.description) || undefined,
    createdAt,
    updatedAt,
    snapshot: asString(input.snapshot) || undefined,
    schema: {
      tables: schema.tables,
      relations: schema.relations,
      domains: schema.domains ?? [],
      enums: schema.enums ?? [],
    },
    settings: normalizeSettings(input.settings),
  };
}
export interface NormalizedSchema {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
}
