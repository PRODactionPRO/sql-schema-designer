/**
 * Schema Validation Engine
 * Validates the schema for common issues and best practices.
 */

import type { Table, Relation, Field } from '../model/types';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: string;
  message: string;
  tableId?: string;
  tableName?: string;
  fieldId?: string;
  fieldName?: string;
  suggestion?: string;
}

export function validateSchema(tables: Table[], relations: Relation[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let issueIdx = 0;
  const nextId = () => `v_${issueIdx++}`;

  // ── Table-level checks ──

  for (const table of tables) {
    // 1. Table without PK
    const hasPK = table.fields.some(f => f.isPrimaryKey);
    if (!hasPK) {
      issues.push({
        id: nextId(), severity: 'error', category: 'Primary Key',
        message: `Table "${table.name}" has no primary key.`,
        tableId: table.id, tableName: table.name,
        suggestion: 'Add a primary key field (e.g., id UUID or BIGINT).',
      });
    }

    // 2. Table without fields
    if (table.fields.length === 0) {
      issues.push({
        id: nextId(), severity: 'error', category: 'Schema Structure',
        message: `Table "${table.name}" has no fields.`,
        tableId: table.id, tableName: table.name,
        suggestion: 'Add at least one field to the table.',
      });
    }

    // 3. Duplicate field names
    const fieldNames = new Map<string, number>();
    for (const f of table.fields) {
      const lower = f.name.toLowerCase();
      fieldNames.set(lower, (fieldNames.get(lower) || 0) + 1);
    }
    for (const [name, count] of fieldNames) {
      if (count > 1) {
        issues.push({
          id: nextId(), severity: 'error', category: 'Naming',
          message: `Table "${table.name}" has ${count} fields named "${name}".`,
          tableId: table.id, tableName: table.name,
          suggestion: 'Rename duplicate fields to unique names.',
        });
      }
    }

    // 4. Naming convention check (snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(table.name)) {
      issues.push({
        id: nextId(), severity: 'warning', category: 'Naming Convention',
        message: `Table "${table.name}" doesn't follow snake_case convention.`,
        tableId: table.id, tableName: table.name,
        suggestion: `Consider renaming to "${table.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}".`,
      });
    }

    // 5. Field naming convention
    for (const field of table.fields) {
      if (!/^[a-z][a-z0-9_]*$/.test(field.name)) {
        issues.push({
          id: nextId(), severity: 'warning', category: 'Naming Convention',
          message: `Field "${table.name}.${field.name}" doesn't follow snake_case convention.`,
          tableId: table.id, tableName: table.name,
          fieldId: field.id, fieldName: field.name,
          suggestion: `Consider renaming to "${field.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}".`,
        });
      }
    }

    // 6. FK field without relation
    for (const field of table.fields) {
      if (field.isForeignKey) {
        const hasRelation = relations.some(r =>
          (r.fromTableId === table.id && r.fromFieldId === field.id) ||
          (r.toTableId === table.id && r.toFieldId === field.id)
        );
        if (!hasRelation) {
          issues.push({
            id: nextId(), severity: 'warning', category: 'Foreign Key',
            message: `Field "${table.name}.${field.name}" is marked as FK but has no relation.`,
            tableId: table.id, tableName: table.name,
            fieldId: field.id, fieldName: field.name,
            suggestion: 'Create a relation or remove the FK flag.',
          });
        }
      }
    }

    // 7. Missing timestamps
    const hasCreatedAt = table.fields.some(f => f.name.toLowerCase() === 'created_at');
    const hasUpdatedAt = table.fields.some(f => f.name.toLowerCase() === 'updated_at');
    if (!hasCreatedAt || !hasUpdatedAt) {
      issues.push({
        id: nextId(), severity: 'info', category: 'Best Practice',
        message: `Table "${table.name}" is missing ${!hasCreatedAt && !hasUpdatedAt ? 'created_at and updated_at' : !hasCreatedAt ? 'created_at' : 'updated_at'} timestamps.`,
        tableId: table.id, tableName: table.name,
        suggestion: 'Consider adding timestamp fields for auditing.',
      });
    }

    // 8. Nullable FK (warning)
    for (const field of table.fields) {
      if (field.isForeignKey && field.isNullable) {
        issues.push({
          id: nextId(), severity: 'info', category: 'Nullable FK',
          message: `FK field "${table.name}.${field.name}" is nullable. This creates optional relationships.`,
          tableId: table.id, tableName: table.name,
          fieldId: field.id, fieldName: field.name,
          suggestion: 'Consider whether this should be NOT NULL for referential integrity.',
        });
      }
    }

    // 9. Indexed FK fields
    for (const field of table.fields) {
      if (field.isForeignKey && !field.isIndexed && !field.isPrimaryKey) {
        issues.push({
          id: nextId(), severity: 'warning', category: 'Performance',
          message: `FK field "${table.name}.${field.name}" is not indexed.`,
          tableId: table.id, tableName: table.name,
          fieldId: field.id, fieldName: field.name,
          suggestion: 'Add an index on FK fields for better JOIN performance.',
        });
      }
    }
  }

  // ── Relation-level checks ──

  // 10. Duplicate table names
  const tableNames = new Map<string, number>();
  for (const t of tables) {
    const lower = t.name.toLowerCase();
    tableNames.set(lower, (tableNames.get(lower) || 0) + 1);
  }
  for (const [name, count] of tableNames) {
    if (count > 1) {
      issues.push({
        id: nextId(), severity: 'error', category: 'Naming',
        message: `There are ${count} tables named "${name}".`,
        suggestion: 'Rename tables to have unique names.',
      });
    }
  }

  // 11. Orphan relations (pointing to missing tables/fields)
  for (const rel of relations) {
    const fromTable = tables.find(t => t.id === rel.fromTableId);
    const toTable = tables.find(t => t.id === rel.toTableId);
    if (!fromTable || !toTable) {
      issues.push({
        id: nextId(), severity: 'error', category: 'Broken Relation',
        message: `Relation references a missing table.`,
        suggestion: 'Delete this orphan relation.',
      });
      continue;
    }
    const fromField = fromTable.fields.find(f => f.id === rel.fromFieldId);
    const toField = toTable.fields.find(f => f.id === rel.toFieldId);
    if (!fromField || !toField) {
      issues.push({
        id: nextId(), severity: 'error', category: 'Broken Relation',
        message: `Relation between "${fromTable.name}" and "${toTable.name}" references missing fields.`,
        suggestion: 'Delete this orphan relation.',
      });
    }
  }

  // 12. Isolated tables (no relations)
  for (const table of tables) {
    const hasRelation = relations.some(r => r.fromTableId === table.id || r.toTableId === table.id);
    if (!hasRelation && tables.length > 1) {
      issues.push({
        id: nextId(), severity: 'info', category: 'Schema Design',
        message: `Table "${table.name}" has no relations to other tables.`,
        tableId: table.id, tableName: table.name,
        suggestion: 'This might be intentional, but consider if FK relationships are needed.',
      });
    }
  }

  return issues;
}
