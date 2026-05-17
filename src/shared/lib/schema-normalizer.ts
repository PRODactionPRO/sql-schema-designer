import {
  ALL_FIELD_TYPES,
  DEFAULT_PROJECT_SETTINGS,
  DOMAIN_COLORS,
  type Domain,
  type EnumType,
  type EnumStorageStrategy,
  type EnumValueMetadata,
  type Field,
  type FieldType,
  type IndexMethod,
  type ProjectSettings,
  type JsonSchemaDocument,
  type JsonSchemaExample,
  type JsonSchemaNode,
  type JsonSchemaReference,
  type JsonSchemaRootType,
  type JsonSchemaValidationRules,
  type Relation,
  type ReferentialAction,
  type Table,
  type TableConstraint,
  type TableIndex,
} from '@/shared/types/schema';
import {
  createErdProjectDocument,
  type ClassAttribute,
  type ClassAttributeMultiplicity,
  type ClassAttributeValueType,
  type ClassDiagramModel,
  type ClassEntity,
  type ClassEntityKind,
  type ClassMemberVisibility,
  type ClassMethod,
  type ClassRelation,
  type ClassRelationType,
  type ProjectData,
  type ProjectDocument,
  type ProjectDocumentType,
  type ProjectSchemaModel,
} from '@/shared/types/project';
import {
  IDEF0_ARROW_ROLES,
  IDEF0_ARROW_STATUSES,
  IDEF0_ATTRIBUTE_VALUE_TYPES,
  IDEF0_CONCEPT_KINDS,
  IDEF0_CONCEPT_SUBTYPES,
  IDEF0_CONCEPT_STATUSES,
  IDEF0_FUNCTION_STATUSES,
  type Idef0Arrow,
  type Idef0ArrowEndpoint,
  type Idef0ArrowRole,
  type Idef0ArrowStatus,
  type Idef0Attribute,
  type Idef0DataReference,
  type Idef0AttributeValueType,
  type Idef0Concept,
  type Idef0ConceptKind,
  type Idef0ConceptStatus,
  type Idef0ConceptSubtype,
  type Idef0DiagramModel,
  type Idef0Function,
  type Idef0FunctionStatus,
} from '@/shared/types/idef0';

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

function asPosition(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  const record = isRecord(value) ? value : {};
  return {
    x: asNumber(record.x, fallback.x),
    y: asNumber(record.y, fallback.y),
  };
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
    comment: asString(record.comment) || undefined,
    enumId: type === 'enum' ? asString(record.enumId) || undefined : undefined,
    enumName: type === 'enum' ? asString(record.enumName) || undefined : undefined,
    jsonSchemaId: asString(record.jsonSchemaId) || undefined,
    jsonSchemaName: asString(record.jsonSchemaName) || undefined,
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function normalizeReferentialAction(value: unknown): ReferentialAction | undefined {
  const action = asString(value);
  if (
    action === 'no_action' ||
    action === 'restrict' ||
    action === 'cascade' ||
    action === 'set_null' ||
    action === 'set_default'
  ) {
    return action;
  }
  return undefined;
}

function normalizeIndexMethod(value: unknown): IndexMethod | undefined {
  const method = asString(value);
  if (method === 'btree' || method === 'hash' || method === 'gist' || method === 'spgist' || method === 'gin' || method === 'brin') {
    return method;
  }
  return undefined;
}

function normalizeTableConstraint(value: unknown, index: number, fieldIds: Set<string>): TableConstraint | null {
  const record = isRecord(value) ? value : {};
  const type = asString(record.type);
  const base = {
    id: asString(record.id, `constraint_${index}`),
    name: asString(record.name) || undefined,
    description: asString(record.description) || undefined,
  };

  if (type === 'primary_key') {
    const columnIds = asStringArray(record.columnIds).filter((id) => fieldIds.has(id));
    if (columnIds.length === 0) return null;
    return { ...base, type, columnIds };
  }

  if (type === 'unique') {
    const columnIds = asStringArray(record.columnIds).filter((id) => fieldIds.has(id));
    if (columnIds.length === 0) return null;
    return { ...base, type, columnIds, nullsNotDistinct: asBoolean(record.nullsNotDistinct) };
  }

  if (type === 'foreign_key') {
    const columnIds = asStringArray(record.columnIds).filter((id) => fieldIds.has(id));
    const referencedTableId = asString(record.referencedTableId);
    const referencedColumnIds = asStringArray(record.referencedColumnIds);
    if (columnIds.length === 0 || !referencedTableId || referencedColumnIds.length === 0) return null;
    return {
      ...base,
      type,
      columnIds,
      referencedTableId,
      referencedColumnIds,
      onDelete: normalizeReferentialAction(record.onDelete),
      onUpdate: normalizeReferentialAction(record.onUpdate),
    };
  }

  if (type === 'check') {
    const expression = asString(record.expression).trim();
    if (!expression) return null;
    return { ...base, type, expression };
  }

  return null;
}

function normalizeTableIndex(value: unknown, index: number, fieldIds: Set<string>): TableIndex | null {
  const record = isRecord(value) ? value : {};
  const rawColumns = Array.isArray(record.columns) ? record.columns : [];
  const columns = rawColumns
    .map((item) => {
      const col = isRecord(item) ? item : {};
      const fieldId = asString(col.fieldId);
      const expression = asString(col.expression).trim();
      if (fieldId && fieldIds.has(fieldId)) {
        return {
          fieldId,
          sort: asString(col.sort) === 'desc' ? 'desc' as const : asString(col.sort) === 'asc' ? 'asc' as const : undefined,
          nulls: asString(col.nulls) === 'first' ? 'first' as const : asString(col.nulls) === 'last' ? 'last' as const : undefined,
        };
      }
      if (expression) return { expression };
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (columns.length === 0) return null;

  return {
    id: asString(record.id, `index_${index}`),
    name: asString(record.name) || undefined,
    columns,
    unique: asBoolean(record.unique),
    method: normalizeIndexMethod(record.method),
    includeFieldIds: asStringArray(record.includeFieldIds).filter((id) => fieldIds.has(id)),
    where: asString(record.where).trim() || undefined,
    description: asString(record.description) || undefined,
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

function normalizeEnumStorageStrategy(value: unknown): EnumStorageStrategy {
  const strategy = asString(value);
  if (strategy === 'check_constraint' || strategy === 'lookup_table') return strategy;
  return 'postgres_enum';
}

function normalizeEnumValueMetadata(value: unknown, fallbackDescription?: string, fallbackOrder?: number): EnumValueMetadata {
  const record = isRecord(value) ? value : {};
  const aliasesRaw = Array.isArray(record.aliases) ? record.aliases : [];
  return {
    label: asString(record.label) || undefined,
    description: asString(record.description) || fallbackDescription || undefined,
    sortOrder: asNumber(record.sortOrder, fallbackOrder ?? 0),
    color: asString(record.color) || undefined,
    isActive: asBoolean(record.isActive, true),
    deprecated: asBoolean(record.deprecated),
    aliases: aliasesRaw.map((item) => asString(item).trim()).filter(Boolean),
  };
}

function normalizeEnumType(value: unknown, index: number): EnumType {
  const record = isRecord(value) ? value : {};
  const rawValues = Array.isArray(record.values) ? record.values : [];
  const rawValueComments = Array.isArray(record.valueComments) ? record.valueComments : [];
  const rawValueMetadata = Array.isArray(record.valueMetadata) ? record.valueMetadata : [];
  const values = rawValues
    .map((item) => asString(item).trim())
    .filter((item) => item.length > 0);
  const uniqueValues: string[] = [];
  const uniqueComments: Array<string | undefined> = [];
  const uniqueMetadata: EnumValueMetadata[] = [];
  const seenValues = new Set<string>();
  for (let i = 0; i < values.length; i += 1) {
    const valueItem = values[i];
    if (seenValues.has(valueItem)) continue;
    seenValues.add(valueItem);
    uniqueValues.push(valueItem);
    const rawComment = asString(rawValueComments[i]).trim();
    const normalizedMetadata = normalizeEnumValueMetadata(rawValueMetadata[i], rawComment || undefined, uniqueValues.length);
    uniqueComments.push(normalizedMetadata.description || rawComment || undefined);
    uniqueMetadata.push(normalizedMetadata);
  }

  return {
    id: asString(record.id, `enum_${index}`),
    name: asString(record.name, `Enum${index + 1}`),
    values: uniqueValues,
    valueComments: uniqueComments,
    valueMetadata: uniqueMetadata,
    description: asString(record.description) || undefined,
    notes: asString(record.notes) || undefined,
    storageStrategy: normalizeEnumStorageStrategy(record.storageStrategy),
    domainId: asString(record.domainId) || undefined,
    position: isRecord(record.position)
      ? {
          x: asNumber(record.position.x, 260 + index * 40),
          y: asNumber(record.position.y, 140 + index * 40),
        }
      : undefined,
    sidebarOrder: asNumber(record.sidebarOrder, 10_000 + index),
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeJsonSchemaValidation(value: unknown): JsonSchemaValidationRules | undefined {
  const record = isRecord(value) ? value : {};
  const rules: JsonSchemaValidationRules = {
    defaultValue: asString(record.defaultValue) || undefined,
    constValue: asString(record.constValue) || undefined,
    format: asString(record.format) || undefined,
    pattern: asString(record.pattern) || undefined,
    minLength: optionalNumber(record.minLength),
    maxLength: optionalNumber(record.maxLength),
    minimum: optionalNumber(record.minimum),
    maximum: optionalNumber(record.maximum),
    exclusiveMinimum: asBoolean(record.exclusiveMinimum),
    exclusiveMaximum: asBoolean(record.exclusiveMaximum),
    multipleOf: optionalNumber(record.multipleOf),
    minItems: optionalNumber(record.minItems),
    maxItems: optionalNumber(record.maxItems),
    uniqueItems: asBoolean(record.uniqueItems),
    minProperties: optionalNumber(record.minProperties),
    maxProperties: optionalNumber(record.maxProperties),
    additionalProperties: typeof record.additionalProperties === 'boolean' ? record.additionalProperties : undefined,
    readOnly: asBoolean(record.readOnly),
    writeOnly: asBoolean(record.writeOnly),
    deprecated: asBoolean(record.deprecated),
  };
  const hasRules = Object.entries(rules).some(([key, item]) => (
    item !== undefined && (item !== false || key === 'additionalProperties')
  ));
  return hasRules ? rules : undefined;
}

function normalizeJsonSchemaNode(value: unknown, index: number): JsonSchemaNode {
  const record = isRecord(value) ? value : {};
  const rawType = asString(record.type, 'json');
  const allowedTypes: JsonSchemaNode['type'][] = [
    'string', 'integer', 'number', 'boolean', 'null', 'object', 'array', 'json',
  ];
  const type = allowedTypes.includes(rawType as JsonSchemaNode['type'])
    ? (rawType as JsonSchemaNode['type'])
    : 'json';
  const enumValuesRaw = Array.isArray(record.enumValues) ? record.enumValues : [];
  const enumValues = enumValuesRaw.map((item) => asString(item).trim()).filter(Boolean);
  return {
    id: asString(record.id, `json_node_${index}`),
    name: asString(record.name, `field_${index + 1}`),
    type,
    parentId: asString(record.parentId) || undefined,
    order: asNumber(record.order, index),
    required: asBoolean(record.required),
    nullable: asBoolean(record.nullable),
    collapsed: asBoolean(record.collapsed),
    enumValues: enumValues.length > 0 ? Array.from(new Set(enumValues)) : undefined,
    validation: normalizeJsonSchemaValidation(record.validation),
    description: asString(record.description) || undefined,
  };
}

function normalizeJsonSchemaRootType(value: unknown): JsonSchemaRootType {
  return asString(value) === 'array' ? 'array' : 'object';
}

function normalizeJsonSchemaExample(value: unknown, index: number): JsonSchemaExample {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `json_example_${index}`),
    name: asString(record.name, `Example ${index + 1}`),
    description: asString(record.description) || undefined,
    value: asString(record.value, '{\n  \n}'),
  };
}

function normalizeJsonSchemaReference(value: unknown, index: number): JsonSchemaReference {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `json_ref_${index}`),
    name: asString(record.name) || undefined,
    targetSchemaId: asString(record.targetSchemaId) || undefined,
    targetSchemaName: asString(record.targetSchemaName) || undefined,
    description: asString(record.description) || undefined,
  };
}

function normalizeJsonSchemaDocument(value: unknown, index: number): JsonSchemaDocument {
  const record = isRecord(value) ? value : {};
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
  const nodes = uniqueById(rawNodes.map((node, nodeIndex) => normalizeJsonSchemaNode(node, nodeIndex)));
  const rawExamples = Array.isArray(record.examples) ? record.examples : [];
  const rawRefs = Array.isArray(record.refs) ? record.refs : [];
  return {
    id: asString(record.id, `json_schema_${index}`),
    name: asString(record.name, `json_schema_${index + 1}`),
    description: asString(record.description) || undefined,
    schemaId: asString(record.schemaId) || undefined,
    rootType: normalizeJsonSchemaRootType(record.rootType),
    nodes,
    refs: uniqueById(rawRefs.map((item, itemIndex) => normalizeJsonSchemaReference(item, itemIndex))),
    examples: uniqueById(rawExamples.map((item, itemIndex) => normalizeJsonSchemaExample(item, itemIndex))),
    notes: asString(record.notes) || undefined,
    domainId: asString(record.domainId) || undefined,
    position: isRecord(record.position)
      ? {
          x: asNumber(record.position.x, 260 + index * 40),
          y: asNumber(record.position.y, 220 + index * 40),
        }
      : undefined,
    sidebarOrder: asNumber(record.sidebarOrder, 20_000 + index),
  };
}

function normalizeTable(value: unknown, index: number): Table {
  const record = isRecord(value) ? value : {};
  const fieldsRaw = Array.isArray(record.fields) ? record.fields : [];
  const fields = fieldsRaw.map((field, fieldIndex) => normalizeField(field, fieldIndex));
  const fieldIds = new Set(fields.map((field) => field.id));
  const constraintsRaw = Array.isArray(record.constraints) ? record.constraints : [];
  const indexesRaw = Array.isArray(record.indexes) ? record.indexes : [];

  return {
    id: asString(record.id, `table_${index}`),
    name: asString(record.name, `table_${index + 1}`),
    description: asString(record.description) || undefined,
    notes: asString(record.notes) || undefined,
    fields,
    constraints: uniqueById(
      constraintsRaw
        .map((constraint, constraintIndex) => normalizeTableConstraint(constraint, constraintIndex, fieldIds))
        .filter((constraint): constraint is TableConstraint => constraint !== null),
    ),
    indexes: uniqueById(
      indexesRaw
        .map((tableIndexValue, tableIndexIndex) => normalizeTableIndex(tableIndexValue, tableIndexIndex, fieldIds))
        .filter((tableIndex): tableIndex is TableIndex => tableIndex !== null),
    ),
    position: {
      x: asNumber(isRecord(record.position) ? record.position.x : undefined, 100 + index * 40),
      y: asNumber(isRecord(record.position) ? record.position.y : undefined, 100 + index * 40),
    },
    color: asString(record.color) || undefined,
    schema: asString(record.schema) || undefined,
    domainId: asString(record.domainId) || undefined,
    sidebarOrder: asNumber(record.sidebarOrder, index),
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

function normalizeVisibility(value: unknown): ClassMemberVisibility {
  const visibility = asString(value, 'public');
  return visibility === 'protected' || visibility === 'private' ? visibility : 'public';
}

function normalizeClassEntityKind(value: unknown): ClassEntityKind {
  const kind = asString(value, 'class');
  if (kind === 'abstract-class' || kind === 'interface' || kind === 'enum' || kind === 'datatype') return kind;
  return 'class';
}

function normalizeAttributeMultiplicity(value: unknown, requiredValue: unknown): ClassAttributeMultiplicity {
  const multiplicity = asString(value);
  if (multiplicity === 'optional' || multiplicity === 'many') return multiplicity;
  if (multiplicity === 'one') return 'one';
  return asBoolean(requiredValue, true) ? 'one' : 'optional';
}

function inferClassAttributeValueType(type: string): ClassAttributeValueType {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'string' || normalized === 'text') return 'string';
  if (normalized === 'number' || normalized === 'int' || normalized === 'integer' || normalized === 'float' || normalized === 'decimal') return 'number';
  if (normalized === 'boolean' || normalized === 'bool') return 'boolean';
  if (normalized === 'date') return 'date';
  if (normalized === 'datetime' || normalized === 'timestamp') return 'datetime';
  if (normalized === 'uuid') return 'uuid';
  if (normalized === 'json' || normalized === 'jsonb') return 'json';
  if (normalized === 'enum') return 'enum';
  if (normalized === 'reference' || normalized === 'ref') return 'reference';
  return 'custom';
}

function normalizeClassAttributeValueType(value: unknown, type: string): ClassAttributeValueType {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === 'string'
    || normalized === 'number'
    || normalized === 'boolean'
    || normalized === 'date'
    || normalized === 'datetime'
    || normalized === 'uuid'
    || normalized === 'json'
    || normalized === 'enum'
    || normalized === 'reference'
    || normalized === 'custom'
  ) {
    return normalized;
  }

  return inferClassAttributeValueType(type);
}

function normalizeClassAttribute(value: unknown, index: number): ClassAttribute {
  const record = isRecord(value) ? value : {};
  const multiplicity = normalizeAttributeMultiplicity(record.multiplicity, record.required);
  const type = asString(record.type, 'string');
  return {
    id: asString(record.id, `attribute_${index}`),
    name: asString(record.name, `attribute_${index + 1}`),
    type,
    valueType: normalizeClassAttributeValueType(record.valueType, type),
    referencedObjectId: asString(record.referencedObjectId) || undefined,
    visibility: normalizeVisibility(record.visibility),
    multiplicity,
    description: asString(record.description) || undefined,
    required: asBoolean(record.required, multiplicity === 'one'),
  };
}

function normalizeClassMethod(value: unknown, index: number): ClassMethod {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `method_${index}`),
    name: asString(record.name, `method_${index + 1}`),
    returnType: asString(record.returnType) || undefined,
    visibility: normalizeVisibility(record.visibility),
    parameters: asString(record.parameters) || undefined,
    description: asString(record.description) || undefined,
  };
}

function normalizeClassEntity(value: unknown, index: number): ClassEntity {
  const record = isRecord(value) ? value : {};
  const rawAttributes = Array.isArray(record.attributes) ? record.attributes : [];
  const rawMethods = Array.isArray(record.methods) ? record.methods : [];

  return {
    id: asString(record.id, `class_${index}`),
    name: asString(record.name, `Class${index + 1}`),
    kind: normalizeClassEntityKind(record.kind),
    description: asString(record.description) || undefined,
    attributes: uniqueById(rawAttributes.map(normalizeClassAttribute)),
    methods: uniqueById(rawMethods.map(normalizeClassMethod)),
    position: asPosition(record.position, { x: 120 + index * 48, y: 120 + index * 48 }),
    color: asString(record.color) || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    domainId: asString(record.domainId) || undefined,
    mappedTableId: asString(record.mappedTableId) || undefined,
    sidebarOrder: asNumber(record.sidebarOrder, index),
  };
}

function normalizeClassRelationType(value: unknown): ClassRelationType {
  const type = asString(value, 'association');
  return type === 'inheritance' || type === 'composition' || type === 'aggregation' || type === 'dependency'
    ? type
    : 'association';
}

function normalizeClassRelation(value: unknown, index: number): ClassRelation {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `class_relation_${index}`),
    fromClassId: asString(record.fromClassId),
    toClassId: asString(record.toClassId),
    type: normalizeClassRelationType(record.type),
    label: asString(record.label) || undefined,
    description: asString(record.description) || undefined,
    fromRole: asString(record.fromRole) || undefined,
    toRole: asString(record.toRole) || undefined,
    fromMultiplicity: asString(record.fromMultiplicity) || undefined,
    toMultiplicity: asString(record.toMultiplicity) || undefined,
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

function buildLegacyConstraints(table: Table, relations: Relation[]): TableConstraint[] {
  const constraints: TableConstraint[] = [];
  const primaryKeyColumnIds = table.fields.filter((field) => field.isPrimaryKey).map((field) => field.id);
  if (primaryKeyColumnIds.length > 0) {
    constraints.push({
      id: `constraint:${table.id}:primary_key`,
      type: 'primary_key',
      name: `${table.name}_pkey`,
      columnIds: primaryKeyColumnIds,
    });
  }

  for (const field of table.fields) {
    if (field.isUnique && !field.isPrimaryKey) {
      constraints.push({
        id: `constraint:${table.id}:${field.id}:unique`,
        type: 'unique',
        name: `${table.name}_${field.name}_key`,
        columnIds: [field.id],
      });
    }
  }

  for (const relation of relations.filter((item) => item.fromTableId === table.id)) {
    constraints.push({
      id: `constraint:${table.id}:${relation.id}:foreign_key`,
      type: 'foreign_key',
      name: `fk_${table.name}_${relation.toTableId}`,
      columnIds: [relation.fromFieldId],
      referencedTableId: relation.toTableId,
      referencedColumnIds: [relation.toFieldId],
      onDelete: 'no_action',
      onUpdate: 'no_action',
    });
  }

  return constraints;
}

function buildLegacyIndexes(table: Table): TableIndex[] {
  return table.fields
    .filter((field) => field.isIndexed)
    .map((field) => ({
      id: `index:${table.id}:${field.id}`,
      name: `idx_${table.name}_${field.name}`,
      columns: [{ fieldId: field.id }],
      method: 'btree' as const,
    }));
}

function getConstraintKey(constraint: TableConstraint): string {
  if (constraint.type === 'check') return `check:${constraint.expression.trim()}`;
  if (constraint.type === 'foreign_key') {
    return [
      'foreign_key',
      constraint.columnIds.join(','),
      constraint.referencedTableId,
      constraint.referencedColumnIds.join(','),
    ].join(':');
  }
  return `${constraint.type}:${constraint.columnIds.join(',')}`;
}

function mergeConstraints(explicitConstraints: TableConstraint[], legacyConstraints: TableConstraint[]): TableConstraint[] {
  const seen = new Set(explicitConstraints.map(getConstraintKey));
  const merged = [...explicitConstraints];
  for (const constraint of legacyConstraints) {
    const key = getConstraintKey(constraint);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(constraint);
  }
  return merged;
}

function getIndexKey(index: TableIndex): string {
  return [
    index.unique ? 'unique' : 'index',
    index.method ?? 'btree',
    index.columns.map((column) => column.fieldId || column.expression || '').join(','),
    index.where ?? '',
  ].join(':');
}

function mergeIndexes(explicitIndexes: TableIndex[], legacyIndexes: TableIndex[]): TableIndex[] {
  const seen = new Set(explicitIndexes.map(getIndexKey));
  const merged = [...explicitIndexes];
  for (const index of legacyIndexes) {
    const key = getIndexKey(index);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(index);
  }
  return merged;
}

function applyConstraintFieldFlags(table: Table): Table {
  const primaryKeyIds = new Set<string>();
  const foreignKeyIds = new Set<string>();
  const singleUniqueIds = new Set<string>();
  const indexedIds = new Set<string>();

  for (const constraint of table.constraints ?? []) {
    if (constraint.type === 'primary_key') {
      constraint.columnIds.forEach((id) => primaryKeyIds.add(id));
    }
    if (constraint.type === 'foreign_key') {
      constraint.columnIds.forEach((id) => foreignKeyIds.add(id));
    }
    if (constraint.type === 'unique' && constraint.columnIds.length === 1) {
      singleUniqueIds.add(constraint.columnIds[0]);
    }
  }

  for (const index of table.indexes ?? []) {
    index.columns.forEach((column) => {
      if (column.fieldId) indexedIds.add(column.fieldId);
    });
  }

  return {
    ...table,
    fields: table.fields.map((field) => ({
      ...field,
      isPrimaryKey: primaryKeyIds.has(field.id),
      isForeignKey: foreignKeyIds.has(field.id),
      isUnique: singleUniqueIds.has(field.id),
      isIndexed: indexedIds.has(field.id),
      isNullable: primaryKeyIds.has(field.id) ? false : field.isNullable,
    })),
  };
}

function isValidConstraint(constraint: TableConstraint, table: Table, tableById: Map<string, Table>): boolean {
  const fieldIds = new Set(table.fields.map((field) => field.id));
  if (constraint.type === 'check') return constraint.expression.trim().length > 0;
  if (constraint.columnIds.length === 0 || constraint.columnIds.some((id) => !fieldIds.has(id))) return false;
  if (constraint.type !== 'foreign_key') return true;

  const referencedTable = tableById.get(constraint.referencedTableId);
  if (!referencedTable) return false;
  const referencedFieldIds = new Set(referencedTable.fields.map((field) => field.id));
  return (
    constraint.referencedColumnIds.length === constraint.columnIds.length &&
    constraint.referencedColumnIds.every((id) => referencedFieldIds.has(id))
  );
}

function isValidIndex(index: TableIndex, table: Table): boolean {
  const fieldIds = new Set(table.fields.map((field) => field.id));
  return index.columns.length > 0 && index.columns.every((column) => {
    if (column.fieldId) return fieldIds.has(column.fieldId);
    return !!column.expression?.trim();
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
  const jsonSchemas = uniqueById((Array.isArray(record.jsonSchemas) ? record.jsonSchemas : []).map(normalizeJsonSchemaDocument));

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

  const normalizedTableById = new Map(normalizedTables.map((table) => [table.id, table]));

  const relations = uniqueById((Array.isArray(record.relations) ? record.relations : []).map(normalizeRelation)).filter((relation) => {
    const fromTable = normalizedTableById.get(relation.fromTableId);
    const toTable = normalizedTableById.get(relation.toTableId);
    if (!fromTable || !toTable) return false;

    const fromFieldExists = fromTable.fields.some((field) => field.id === relation.fromFieldId);
    const toFieldExists = toTable.fields.some((field) => field.id === relation.toFieldId);
    return fromFieldExists && toFieldExists;
  });

  const tablesWithConstraints = normalizedTables.map((table) => {
    const explicitConstraints = table.constraints ?? [];
    const explicitIndexes = table.indexes ?? [];
    const constraints = mergeConstraints(explicitConstraints, buildLegacyConstraints(table, relations))
      .filter((constraint) => isValidConstraint(constraint, table, normalizedTableById));
    const indexes = mergeIndexes(explicitIndexes, buildLegacyIndexes(table))
      .filter((index) => isValidIndex(index, table));
    return applyConstraintFieldFlags({ ...table, constraints, indexes });
  });

  return {
    schemaVersion: 2,
    tables: tablesWithConstraints,
    relations,
    domains,
    enums: enums.map((enumType) => ({
      ...enumType,
      domainId: enumType.domainId && domainIdSet.has(enumType.domainId) ? enumType.domainId : undefined,
    })),
    jsonSchemas: jsonSchemas.map((doc) => ({
      ...doc,
      domainId: doc.domainId && domainIdSet.has(doc.domainId) ? doc.domainId : undefined,
    })),
  };
}

export function normalizeProjectSchema(input: unknown): ProjectSchemaModel {
  const schema = normalizeSchema(input);
  return {
    schemaVersion: schema.schemaVersion,
    tables: schema.tables,
    relations: schema.relations,
    domains: schema.domains ?? [],
    enums: schema.enums ?? [],
    jsonSchemas: schema.jsonSchemas ?? [],
  };
}

function mergeDomains(...domainGroups: Domain[][]): Domain[] {
  return uniqueById(domainGroups.flat().filter((domain) => domain.name.trim().length > 0));
}

function normalizeDomainList(value: unknown): Domain[] {
  return uniqueById((Array.isArray(value) ? value : []).map(normalizeDomain));
}

function applyProjectDomainsToSchema(schema: ProjectSchemaModel, domains: Domain[]): ProjectSchemaModel {
  const domainIds = new Set(domains.map((domain) => domain.id));
  return {
    ...schema,
    domains,
    tables: schema.tables.map((table) => ({
      ...table,
      domainId: table.domainId && domainIds.has(table.domainId) ? table.domainId : undefined,
    })),
    enums: schema.enums.map((enumType) => ({
      ...enumType,
      domainId: enumType.domainId && domainIds.has(enumType.domainId) ? enumType.domainId : undefined,
    })),
    jsonSchemas: (schema.jsonSchemas ?? []).map((doc) => ({
      ...doc,
      domainId: doc.domainId && domainIds.has(doc.domainId) ? doc.domainId : undefined,
    })),
  };
}

function extractDocumentDomains(value: unknown): Domain[] {
  const record = isRecord(value) ? value : {};
  const type = normalizeDocumentType(record.type);
  if (type === 'erd') {
    const erdRecord = isRecord(record.erd) ? record.erd : isRecord(record.schema) ? record.schema : {};
    return normalizeDomainList(erdRecord.domains);
  }
  if (type === 'class-diagram') {
    const diagramRecord = isRecord(record.classDiagram) ? record.classDiagram : {};
    return normalizeDomainList(diagramRecord.domains);
  }
  return [];
}

export function normalizeClassDiagram(input: unknown, projectDomains?: Domain[]): ClassDiagramModel {
  const record = isRecord(input) ? input : {};
  const classes = uniqueById((Array.isArray(record.classes) ? record.classes : []).map(normalizeClassEntity));
  const domains = projectDomains ?? normalizeDomainList(record.domains);
  const classIds = new Set(classes.map((entity) => entity.id));
  const domainIds = new Set(domains.map((domain) => domain.id));

  return {
    classes: classes.map((entity) => ({
      ...entity,
      domainId: entity.domainId && domainIds.has(entity.domainId) ? entity.domainId : undefined,
    })),
    relations: uniqueById((Array.isArray(record.relations) ? record.relations : []).map(normalizeClassRelation))
      .filter((relation) => classIds.has(relation.fromClassId) && classIds.has(relation.toClassId)),
    domains,
  };
}

function normalizeIdef0FunctionStatus(value: unknown): Idef0FunctionStatus {
  return IDEF0_FUNCTION_STATUSES.includes(value as Idef0FunctionStatus) ? value as Idef0FunctionStatus : 'draft';
}

function normalizeIdef0ConceptKind(value: unknown): Idef0ConceptKind {
  return IDEF0_CONCEPT_KINDS.includes(value as Idef0ConceptKind) ? value as Idef0ConceptKind : 'dataset';
}

function normalizeIdef0ConceptSubtype(value: unknown): Idef0ConceptSubtype | undefined {
  return IDEF0_CONCEPT_SUBTYPES.includes(value as Idef0ConceptSubtype) ? value as Idef0ConceptSubtype : undefined;
}

function normalizeIdef0ConceptStatus(value: unknown): Idef0ConceptStatus {
  return IDEF0_CONCEPT_STATUSES.includes(value as Idef0ConceptStatus) ? value as Idef0ConceptStatus : 'draft';
}

function normalizeIdef0ArrowRole(value: unknown): Idef0ArrowRole {
  return IDEF0_ARROW_ROLES.includes(value as Idef0ArrowRole) ? value as Idef0ArrowRole : 'input';
}

function normalizeIdef0ArrowStatus(value: unknown): Idef0ArrowStatus {
  return IDEF0_ARROW_STATUSES.includes(value as Idef0ArrowStatus) ? value as Idef0ArrowStatus : 'required';
}

function normalizeIdef0AttributeValueType(value: unknown): Idef0AttributeValueType {
  return IDEF0_ATTRIBUTE_VALUE_TYPES.includes(value as Idef0AttributeValueType) ? value as Idef0AttributeValueType : 'text';
}

function normalizeIdef0Attribute(value: unknown, index: number): Idef0Attribute {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `idef0_attr_${index}`),
    name: asString(record.name, `attribute_${index + 1}`),
    value: asString(record.value) || undefined,
    valueType: normalizeIdef0AttributeValueType(record.valueType),
    description: asString(record.description) || undefined,
  };
}

function normalizeIdef0Attributes(value: unknown): Idef0Attribute[] {
  return uniqueById((Array.isArray(value) ? value : []).map(normalizeIdef0Attribute));
}

function normalizeIdef0DataReference(value: unknown, index: number): Idef0DataReference {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `idef0_data_ref_${index}`),
    objectId: asString(record.objectId) || undefined,
    legacyId: asString(record.legacyId) || undefined,
    classId: asString(record.classId) || undefined,
    className: asString(record.className) || undefined,
    attributeId: asString(record.attributeId) || undefined,
    attributeName: asString(record.attributeName, `attribute_${index + 1}`),
    valueType: asString(record.valueType) || undefined,
    domainId: asString(record.domainId) || undefined,
    domainName: asString(record.domainName) || undefined,
  };
}

function normalizeIdef0DataReferences(value: unknown): Idef0DataReference[] {
  return uniqueById((Array.isArray(value) ? value : []).map(normalizeIdef0DataReference));
}

function normalizeIdef0Endpoint(value: unknown): Idef0ArrowEndpoint {
  const record = isRecord(value) ? value : {};
  const kind = record.kind === 'function' || record.kind === 'concept' || record.kind === 'boundary'
    ? record.kind
    : 'boundary';
  return {
    kind,
    id: asString(record.id) || undefined,
  };
}

function normalizeIdef0Function(value: unknown, index: number): Idef0Function {
  const record = isRecord(value) ? value : {};
  const size = isRecord(record.size) ? record.size : {};
  return {
    id: asString(record.id, `idef0_function_${index}`),
    name: asString(record.name, `Function ${index + 1}`),
    description: asString(record.description) || undefined,
    status: normalizeIdef0FunctionStatus(record.status),
    position: asPosition(record.position, { x: 160 + index * 56, y: 140 + index * 40 }),
    size: {
      width: asNumber(size.width, 220),
      height: asNumber(size.height, 120),
    },
    domainId: asString(record.domainId) || undefined,
    parentFunctionId: asString(record.parentFunctionId) || undefined,
    decompositionDiagramId: asString(record.decompositionDiagramId) || undefined,
    ownerId: asString(record.ownerId) || undefined,
    sidebarOrder: typeof record.sidebarOrder === 'number' ? record.sidebarOrder : undefined,
    attributes: normalizeIdef0Attributes(record.attributes),
  };
}

function normalizeIdef0Concept(value: unknown, index: number): Idef0Concept {
  const record = isRecord(value) ? value : {};
  const size = isRecord(record.size) ? record.size : {};
  return {
    id: asString(record.id, `idef0_concept_${index}`),
    name: asString(record.name, `Concept ${index + 1}`),
    kind: normalizeIdef0ConceptKind(record.kind),
    subtype: normalizeIdef0ConceptSubtype(record.subtype),
    description: asString(record.description) || undefined,
    status: normalizeIdef0ConceptStatus(record.status),
    position: asPosition(record.position, { x: 120 + index * 48, y: 120 + index * 36 }),
    size: {
      width: asNumber(size.width, 180),
      height: asNumber(size.height, 56),
    },
    domainId: asString(record.domainId) || undefined,
    ownerId: asString(record.ownerId) || undefined,
    linkedObjectId: asString(record.linkedObjectId) || undefined,
    dataReferences: normalizeIdef0DataReferences(record.dataReferences),
    attributes: normalizeIdef0Attributes(record.attributes),
    metadata: isRecord(record.metadata) ? record.metadata : undefined,
  };
}

function normalizeIdef0Arrow(value: unknown, index: number): Idef0Arrow {
  const record = isRecord(value) ? value : {};
  return {
    id: asString(record.id, `idef0_arrow_${index}`),
    role: normalizeIdef0ArrowRole(record.role),
    source: normalizeIdef0Endpoint(record.source),
    target: normalizeIdef0Endpoint(record.target),
    conceptId: asString(record.conceptId) || undefined,
    label: asString(record.label) || undefined,
    description: asString(record.description) || undefined,
    status: normalizeIdef0ArrowStatus(record.status),
    condition: asString(record.condition) || undefined,
  };
}

export function normalizeIdef0Diagram(input: unknown, projectDomains?: Domain[]): Idef0DiagramModel {
  const record = isRecord(input) ? input : {};
  const domains = projectDomains ?? normalizeDomainList(record.domains);
  const domainIds = new Set(domains.map((domain) => domain.id));
  const functions = uniqueById((Array.isArray(record.functions) ? record.functions : []).map(normalizeIdef0Function))
    .map((fn) => ({
      ...fn,
      domainId: fn.domainId && domainIds.has(fn.domainId) ? fn.domainId : undefined,
    }));
  const concepts = uniqueById((Array.isArray(record.concepts) ? record.concepts : []).map(normalizeIdef0Concept))
    .map((concept) => ({
      ...concept,
      domainId: concept.domainId && domainIds.has(concept.domainId) ? concept.domainId : undefined,
    }));
  const functionIds = new Set(functions.map((fn) => fn.id));
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const endpointExists = (endpoint: Idef0ArrowEndpoint) => (
    endpoint.kind === 'boundary'
    || (endpoint.kind === 'function' && endpoint.id && functionIds.has(endpoint.id))
    || (endpoint.kind === 'concept' && endpoint.id && conceptIds.has(endpoint.id))
  );

  return {
    id: asString(record.id) || undefined,
    processModelId: asString(record.processModelId) || undefined,
    parentFunctionId: asString(record.parentFunctionId) || undefined,
    name: asString(record.name) || undefined,
    functions,
    concepts,
    arrows: uniqueById((Array.isArray(record.arrows) ? record.arrows : []).map(normalizeIdef0Arrow))
      .filter((arrow) => endpointExists(arrow.source) && endpointExists(arrow.target)),
    domains,
  };
}

function normalizeDocumentType(value: unknown): ProjectDocumentType | null {
  const type = asString(value);
  if (type === 'erd' || type === 'class-diagram' || type === 'idef0' || type === 'bpmn' || type === 'openapi' || type === 'sequence') {
    return type;
  }
  return null;
}

function normalizeProjectDocument(value: unknown, index: number, fallbackSchema: ProjectSchemaModel, projectDomains: Domain[]): ProjectDocument | null {
  const record = isRecord(value) ? value : {};
  const type = normalizeDocumentType(record.type);
  if (!type) return null;

  const createdAt = asString(record.createdAt, new Date().toISOString());
  const base = {
    id: asString(record.id, `document_${index}`),
    name: asString(record.name, type === 'class-diagram' ? 'Class Diagram' : type === 'idef0' ? 'IDEF0 Functional Model' : type === 'erd' ? 'ERD Diagram' : 'Document'),
    description: asString(record.description) || undefined,
    createdAt,
    updatedAt: asString(record.updatedAt, createdAt),
    snapshot: asString(record.snapshot) || undefined,
  };

  if (type === 'erd') {
    return {
      ...base,
      type,
      erd: applyProjectDomainsToSchema(normalizeProjectSchema(record.erd ?? record.schema ?? fallbackSchema), projectDomains),
    };
  }

  if (type === 'class-diagram') {
    return {
      ...base,
      type,
      classDiagram: normalizeClassDiagram(record.classDiagram, projectDomains),
    };
  }

  if (type === 'idef0') {
    return {
      ...base,
      type,
      idef0: normalizeIdef0Diagram(record.idef0 ?? record.payload, projectDomains),
    };
  }

  return {
    ...base,
    type,
  };
}

function normalizeProjectDocuments(value: unknown, fallbackSchema: ProjectSchemaModel, projectDomains: Domain[]): ProjectDocument[] {
  const rawDocuments = Array.isArray(value) ? value : [];
  const documents = uniqueById(
    rawDocuments
      .map((item, index) => normalizeProjectDocument(item, index, fallbackSchema, projectDomains))
      .filter((item): item is ProjectDocument => !!item),
  );

  if (documents.length > 0) return documents;

  const hasLegacySchemaContent =
    fallbackSchema.tables.length > 0 ||
    fallbackSchema.relations.length > 0 ||
    fallbackSchema.domains.length > 0 ||
    fallbackSchema.enums.length > 0 ||
    (fallbackSchema.jsonSchemas?.length ?? 0) > 0;

  return hasLegacySchemaContent ? [createErdProjectDocument('ERD Diagram', applyProjectDomainsToSchema(fallbackSchema, projectDomains))] : [];
}

function normalizeSettings(value: unknown): ProjectSettings {
  const record = isRecord(value) ? value : {};
  const lineType = asString(record.lineType, DEFAULT_PROJECT_SETTINGS.lineType);
  const enabledFieldTypesRaw = Array.isArray(record.enabledFieldTypes) ? record.enabledFieldTypes : DEFAULT_PROJECT_SETTINGS.enabledFieldTypes;
  const enabledFieldTypes = enabledFieldTypesRaw
    .map((item) => asString(item) as FieldType)
    .filter((item): item is FieldType => ALL_FIELD_TYPES.includes(item));
  const autoSaveIntervalSecRaw = asNumber(record.autoSaveIntervalSec, DEFAULT_PROJECT_SETTINGS.autoSaveIntervalSec);
  const autoSaveIntervalSec = Math.max(15, Math.min(autoSaveIntervalSecRaw, 3600));

  return {
    lineType: lineType === 'curved' || lineType === 'orthogonal' || lineType === 'straight' ? lineType : DEFAULT_PROJECT_SETTINGS.lineType,
    enabledFieldTypes: enabledFieldTypes.length > 0 ? enabledFieldTypes : [...DEFAULT_PROJECT_SETTINGS.enabledFieldTypes],
    autoSaveIntervalSec,
  };
}

export function normalizeProjectData(input: unknown): ProjectData | null {
  if (!isRecord(input)) return null;
  if (!input.id || !input.name) return null;

  const schema = normalizeProjectSchema(input.schema ?? input);
  const rawDocuments = Array.isArray(input.documents) ? input.documents : [];
  const projectDomains = mergeDomains(
    normalizeDomainList(input.domains),
    schema.domains,
    ...rawDocuments.map(extractDocumentDomains),
  );
  const schemaWithProjectDomains = applyProjectDomainsToSchema(schema, projectDomains);
  const documents = normalizeProjectDocuments(input.documents, schemaWithProjectDomains, projectDomains);
  const primaryErdDocument = documents.find((document) => document.type === 'erd');
  const createdAt = asString(input.createdAt, new Date().toISOString());
  const updatedAt = asString(input.updatedAt, new Date().toISOString());

  return {
    id: asString(input.id),
    name: asString(input.name, 'Untitled project'),
    description: asString(input.description) || undefined,
    createdAt,
    updatedAt,
    snapshot: asString(input.snapshot) || undefined,
    pinned: asBoolean(input.pinned),
    domains: projectDomains,
    schema: primaryErdDocument?.erd ?? schemaWithProjectDomains,
    documents,
    settings: normalizeSettings(input.settings),
  };
}
export interface NormalizedSchema {
  schemaVersion: number;
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  jsonSchemas: JsonSchemaDocument[];
}
