/**
 * DSL Serializer — converts schema objects into our custom DSL text.
 */

import type { Table, Relation, Domain, EnumType } from '../../model/types';

export function serializeToDSL(
  tables: Table[],
  relations: Relation[],
  domains: Domain[],
  enums: EnumType[],
): string {
  const lines: string[] = [];

  // ─── Enums ───
  for (const enumType of enums) {
    lines.push(`enum ${enumType.name} {`);
    for (const value of enumType.values) {
      lines.push(`  ${value}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Build a lookup: fromFieldId → { toTableName, toFieldName }
  const fkMap = new Map<string, { toTableName: string; toFieldName: string }>();
  for (const rel of relations) {
    const toTable = tables.find(t => t.id === rel.toTableId);
    const toField = toTable?.fields.find(f => f.id === rel.toFieldId);
    if (toTable && toField) {
      fkMap.set(rel.fromFieldId, { toTableName: toTable.name, toFieldName: toField.name });
    }
  }

  // ─── Tables ───
  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    if (ti > 0) lines.push('');
    lines.push(`table ${table.name} {`);

    for (const field of table.fields) {
      const fieldTypeLabel = field.type === 'enum' ? (field.enumName || 'enum') : field.type;
      const parts: string[] = [`  ${field.name}`, fieldTypeLabel];

      if (field.isPrimaryKey) parts.push('pk');
      if (field.isUnique) parts.push('unique');
      if (field.isIndexed) parts.push('indexed');
      if (!field.isNullable && !field.isPrimaryKey) parts.push('not null');
      if (field.isNotNull && field.isNullable && !field.isPrimaryKey) parts.push('not null');
      if (field.defaultValue) parts.push(`default=${field.defaultValue}`);

      // FK arrow
      const fk = fkMap.get(field.id);
      if (fk) {
        parts.push(`-> ${fk.toTableName}.${fk.toFieldName}`);
      }

      const inlineComment = field.comment?.trim() ? ` // ${field.comment.trim().replace(/\n+/g, ' | ')}` : '';
      lines.push(`${parts.join(' ')}${inlineComment}`);
    }

    lines.push('}');
  }

  // ─── Domains ───
  // Group tables by domain
  const domainTables = new Map<string, string[]>();
  for (const table of tables) {
    if (table.domainId) {
      const list = domainTables.get(table.domainId) || [];
      list.push(table.name);
      domainTables.set(table.domainId, list);
    }
  }

  for (const domain of domains) {
    const dTables = domainTables.get(domain.id) || [];
    lines.push('');
    lines.push(`domain "${domain.name}" ${domain.color} {`);
    if (dTables.length > 0) {
      lines.push(`  ${dTables.join(', ')}`);
    }
    lines.push('}');
  }

  return lines.join('\n') + '\n';
}
