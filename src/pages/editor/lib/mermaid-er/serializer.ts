/**
 * Mermaid ER Serializer -- converts schema objects into Mermaid ER diagram text.
 *
 * Output example:
 *   erDiagram
 *     users {
 *       uuid id PK
 *       varchar name
 *       text email UK
 *     }
 *     posts {
 *       uuid id PK
 *       varchar title
 *       uuid author_id FK
 *     }
 *     users ||--o{ posts : "has"
 *
 * Note: Mermaid ER uses type-first notation (type before field name).
 */

import type { Table, Relation, Domain, EnumType } from '../../model/types';

export function serializeToMermaidER(
  tables: Table[],
  relations: Relation[],
  _domains: Domain[],
  enums: EnumType[],
): string {
  const lines: string[] = ['erDiagram'];

  for (const enumType of enums) {
    lines.push(`  %% Enum: ${enumType.name}: ${enumType.values.join(', ')}`);
  }
  if (enums.length > 0) lines.push('');

  // ─── Domain comments ───
  const domainTablesMap = new Map<string, string[]>();
  for (const table of tables) {
    if (table.domainId) {
      const list = domainTablesMap.get(table.domainId) || [];
      list.push(table.name);
      domainTablesMap.set(table.domainId, list);
    }
  }

  for (const domain of _domains) {
    const dTables = domainTablesMap.get(domain.id) || [];
    if (dTables.length > 0) {
      lines.push(`  %% Domain: ${domain.name} (${domain.color}): ${dTables.join(', ')}`);
    }
  }

  if (_domains.length > 0) lines.push('');

  // ─── Tables ───
  for (const table of tables) {
    lines.push(`  ${table.name} {`);

    for (const field of table.fields) {
      // Mermaid format: type name [PK|FK|UK] ["comment"]
      const fieldTypeLabel = field.type === 'enum' ? (field.enumName || 'enum') : field.type;
      const mermaidType = formatMermaidType(fieldTypeLabel);
      let constraint = '';
      if (field.isPrimaryKey) constraint = ' PK';
      else if (field.isForeignKey) constraint = ' FK';
      else if (field.isUnique) constraint = ' UK';

      // Add comment for defaults/nullable/indexed
      const comments: string[] = [];
      if (field.defaultValue) comments.push(field.defaultValue);
      if ((!field.isNullable || field.isNotNull) && !field.isPrimaryKey) comments.push('NOT NULL');
      if (field.isIndexed) comments.push('INDEXED');
      const comment = comments.length > 0 ? ` "${comments.join(', ')}"` : '';

      lines.push(`    ${mermaidType} ${field.name}${constraint}${comment}`);
    }

    lines.push('  }');
  }

  // ─── Relations ───
  if (relations.length > 0) {
    lines.push('');
    for (const rel of relations) {
      const fromTable = tables.find(t => t.id === rel.fromTableId);
      const toTable = tables.find(t => t.id === rel.toTableId);
      if (!fromTable || !toTable) continue;

      const symbol = getMermaidRelSymbol(rel.type);
      // Use table names as the label via field names
      const fromField = fromTable.fields.find(f => f.id === rel.fromFieldId);
      const toField = toTable.fields.find(f => f.id === rel.toFieldId);
      const label = fromField && toField ? `${fromField.name}` : 'fk';

      lines.push(`  ${fromTable.name} ${symbol} ${toTable.name} : "${label}"`);
    }
  }

  return lines.join('\n') + '\n';
}

/** Format type for Mermaid (replace spaces with underscores) */
function formatMermaidType(type: string): string {
  return type.replace(/\s+/g, '_');
}

function getMermaidRelSymbol(type: string): string {
  switch (type) {
    case '1:1': return '||--||';
    case '1:N': return '||--o{';
    case 'N:1': return '}o--||';
    case 'N:M': return '}o--o{';
    default: return '||--o{';
  }
}
