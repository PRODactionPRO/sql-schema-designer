/**
 * DBML Serializer -- converts schema objects into DBML text.
 *
 * DBML spec: https://dbml.dbdiagram.io/docs/
 *
 * Output example:
 *   Table users {
 *     id uuid [pk]
 *     name varchar [not null]
 *     email text [unique, not null, default: 'user@example.com']
 *   }
 *
 *   Ref: posts.author_id > users.id
 */

import type { Table, Field, Relation, Domain, EnumType } from '../../model/types';

export function serializeToDBML(
  tables: Table[],
  relations: Relation[],
  domains: Domain[],
  enums: EnumType[],
): string {
  const lines: string[] = [];

  // ─── Enums ───
  for (const enumType of enums) {
    lines.push(`Enum ${enumType.name} {`);
    for (const value of enumType.values) {
      lines.push(`  ${value}`);
    }
    lines.push('}');
    lines.push('');
  }

  // ─── Domain groups as DBML TableGroups ───
  const domainTablesMap = new Map<string, string[]>();
  for (const table of tables) {
    if (table.domainId) {
      const list = domainTablesMap.get(table.domainId) || [];
      list.push(table.name);
      domainTablesMap.set(table.domainId, list);
    }
  }

  for (const domain of domains) {
    const dTables = domainTablesMap.get(domain.id) || [];
    lines.push(`// Domain: ${domain.name} (${domain.color})`);
    lines.push(`TableGroup ${safeName(domain.name)} {`);
    for (const tn of dTables) {
      lines.push(`  ${tn}`);
    }
    lines.push('}');
    lines.push('');
  }

  // ─── Tables ───
  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    if (ti > 0 || lines.length > 0) lines.push('');
    lines.push(`Table ${table.name} {`);

    for (const field of table.fields) {
      const attrs = buildFieldAttrs(field);
      const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
      const fieldTypeLabel = field.type === 'enum' ? (field.enumName || 'enum') : field.type;
      lines.push(`  ${field.name} ${fieldTypeLabel}${attrStr}`);
    }

    // Indexes block for indexed fields
    const indexedFields = table.fields.filter(f => f.isIndexed);
    if (indexedFields.length > 0) {
      lines.push('');
      lines.push('  indexes {');
      for (const f of indexedFields) {
        lines.push(`    ${f.name}`);
      }
      lines.push('  }');
    }

    lines.push('}');
  }

  // ─── Relations (Ref) ───
  const refs = buildRefs(tables, relations);
  if (refs.length > 0) {
    lines.push('');
    for (const ref of refs) {
      lines.push(ref);
    }
  }

  return lines.join('\n') + '\n';
}

function buildFieldAttrs(field: Field): string[] {
  const attrs: string[] = [];
  if (field.isPrimaryKey) attrs.push('pk');
  if (field.isUnique) attrs.push('unique');
  if (!field.isNullable && !field.isPrimaryKey) attrs.push('not null');
  if (field.isNotNull && field.isNullable && !field.isPrimaryKey) attrs.push('not null');
  if (field.defaultValue) attrs.push(`default: '${field.defaultValue}'`);
  if (field.comment?.trim()) attrs.push(`note: '${field.comment.trim().replace(/'/g, "\\'").replace(/\n+/g, ' | ')}'`);
  return attrs;
}

function buildRefs(tables: Table[], relations: Relation[]): string[] {
  const refs: string[] = [];
  for (const rel of relations) {
    const fromTable = tables.find(t => t.id === rel.fromTableId);
    const toTable = tables.find(t => t.id === rel.toTableId);
    if (!fromTable || !toTable) continue;
    const fromField = fromTable.fields.find(f => f.id === rel.fromFieldId);
    const toField = toTable.fields.find(f => f.id === rel.toFieldId);
    if (!fromField || !toField) continue;

    let symbol = '>';
    if (rel.type === '1:1') symbol = '-';
    else if (rel.type === 'N:1') symbol = '<';
    else if (rel.type === 'N:M') symbol = '<>';

    refs.push(`Ref: ${fromTable.name}.${fromField.name} ${symbol} ${toTable.name}.${toField.name}`);
  }
  return refs;
}

/** Make a name safe for DBML identifiers (replace spaces with underscores) */
function safeName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}
