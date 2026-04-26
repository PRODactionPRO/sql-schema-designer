// Re-export all schema types from shared layer
// This file exists for backward compatibility within the editor page.
// New code should import directly from '@/shared/types/schema'.

export {
  type FieldType,
  ALL_FIELD_TYPES,
  type Field,
  type Domain,
  type EnumType,
  type Table,
  type RelationType,
  type Relation,
  type Schema,
  type SerializationFormat,
  type LineType,
  type ProjectSettings,
  DEFAULT_PROJECT_SETTINGS,
  DOMAIN_COLORS,
  type TypeCompatibility,
  getTypeGroup,
  areTypesCompatible,
  getTypeCompatibility,
} from '@/shared/types/schema';
