import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Command, CommandRunner, Option } from 'nest-commander';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ExportDbSchemaOptions {
  out?: string;
  schema?: string;
  includeInternal?: boolean;
}

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  ordinal_position: number;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

interface IndexRow {
  table_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
  column_count: number;
}

interface ForeignKeyRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface EnumRow {
  enum_name: string;
  enum_value: string;
  enum_order: number;
}

const DEFAULT_PROJECT_SETTINGS = {
  lineType: 'curved',
  enabledFieldTypes: [
    'uuid', 'bigint', 'integer', 'smallint', 'serial', 'bigserial',
    'varchar', 'text', 'citext',
    'boolean',
    'timestamp', 'timestamptz', 'date', 'time', 'interval',
    'json', 'jsonb',
    'decimal', 'numeric', 'real', 'double precision', 'money',
    'bytea', 'inet', 'cidr', 'macaddr',
    'point', 'line', 'polygon', 'circle',
    'xml', 'array', 'vector', 'enum',
  ],
  autoSaveIntervalSec: 60,
} as const;

@Command({
  name: 'export-db-schema',
  description: 'Export PostgreSQL schema into the app JSON import format',
})
export class ExportDbSchemaCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(_params: string[], options: ExportDbSchemaOptions): Promise<void> {
    const schemaName = (options.schema?.trim() || 'public').toLowerCase();
    if (!/^[a-z_][a-z0-9_]*$/.test(schemaName)) {
      throw new Error(`Invalid schema name "${schemaName}"`);
    }

    const tables = await this.getTables(schemaName, Boolean(options.includeInternal));
    if (tables.length === 0) {
      throw new Error(`No tables found in schema "${schemaName}"`);
    }

    const [columns, indexes, foreignKeys, enumRows] = await Promise.all([
      this.getColumns(schemaName, tables),
      this.getIndexes(schemaName, tables),
      this.getForeignKeys(schemaName, tables),
      this.getEnums(schemaName),
    ]);

    const enumValuesByName = new Map<string, string[]>();
    for (const row of enumRows) {
      const list = enumValuesByName.get(row.enum_name) || [];
      list.push(row.enum_value);
      enumValuesByName.set(row.enum_name, list);
    }

    const indexMap = new Map<string, { isPrimary: boolean; isIndexed: boolean; isUnique: boolean }>();
    for (const row of indexes) {
      const key = `${row.table_name}.${row.column_name}`;
      const current = indexMap.get(key) || { isPrimary: false, isIndexed: false, isUnique: false };
      indexMap.set(key, {
        isPrimary: current.isPrimary || row.is_primary,
        isIndexed: true,
        isUnique: current.isUnique || (row.is_unique && row.column_count === 1),
      });
    }

    const foreignKeyMap = new Map<string, ForeignKeyRow>();
    for (const row of foreignKeys) {
      foreignKeyMap.set(`${row.table_name}.${row.column_name}`, row);
    }

    const tableIdByName = new Map<string, string>();
    for (const tableName of tables) {
      tableIdByName.set(tableName, `table:${schemaName}.${tableName}`);
    }

    const buildFieldId = (tableName: string, columnName: string) => `field:${schemaName}.${tableName}.${columnName}`;
    const buildRelationType = (tableName: string, columnName: string) =>
      indexMap.get(`${tableName}.${columnName}`)?.isUnique ? '1:1' : '1:N';

    const exportedTables = tables.map((tableName, tableIndex) => {
      const tableColumns = columns.filter((column) => column.table_name === tableName);
      return {
        id: tableIdByName.get(tableName)!,
        name: tableName,
        schema: schemaName,
        fields: tableColumns.map((column) => {
          const fieldKey = `${column.table_name}.${column.column_name}`;
          const indexInfo = indexMap.get(fieldKey);
          const foreignKey = foreignKeyMap.get(fieldKey);
          const mappedType = this.mapColumnType(column, enumValuesByName, schemaName);
          return {
            id: buildFieldId(column.table_name, column.column_name),
            name: column.column_name,
            type: mappedType.type,
            enumId: mappedType.enumId,
            enumName: mappedType.enumName,
            isPrimaryKey: indexInfo?.isPrimary ?? false,
            isNullable: column.is_nullable === 'YES',
            isForeignKey: Boolean(foreignKey),
            foreignKeyTable: foreignKey?.foreign_table_name,
            foreignKeyField: foreignKey?.foreign_column_name,
            defaultValue: column.column_default || undefined,
            isUnique: indexInfo?.isUnique ?? false,
            isIndexed: indexInfo?.isIndexed ?? false,
            isNotNull: column.is_nullable === 'NO',
          };
        }),
        position: {
          x: 120 + (tableIndex % 3) * 420,
          y: 120 + Math.floor(tableIndex / 3) * 320,
        },
        sidebarOrder: tableIndex,
      };
    });

    const exportedRelations = foreignKeys.map((foreignKey) => ({
      id: `relation:${foreignKey.constraint_name}`,
      fromTableId: tableIdByName.get(foreignKey.table_name)!,
      fromFieldId: buildFieldId(foreignKey.table_name, foreignKey.column_name),
      toTableId: tableIdByName.get(foreignKey.foreign_table_name)!,
      toFieldId: buildFieldId(foreignKey.foreign_table_name, foreignKey.foreign_column_name),
      type: buildRelationType(foreignKey.table_name, foreignKey.column_name),
    }));

    const exportedEnums = Array.from(enumValuesByName.entries()).map(([enumName, values], index) => ({
      id: `enum:${schemaName}.${enumName}`,
      name: enumName,
      values,
      position: {
        x: 1400,
        y: 120 + index * 180,
      },
      sidebarOrder: 10_000 + index,
    }));

    const output = {
      tables: exportedTables,
      relations: exportedRelations,
      domains: [],
      enums: exportedEnums,
      jsonSchemas: [],
      settings: DEFAULT_PROJECT_SETTINGS,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = resolve(
      process.cwd(),
      options.out?.trim() || `./backups/${schemaName}_schema_snapshot_${timestamp}.json`,
    );

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

    console.log(`Schema exported to ${outPath}`);
    console.log(`Tables: ${exportedTables.length}`);
    console.log(`Relations: ${exportedRelations.length}`);
    console.log(`Enums: ${exportedEnums.length}`);
  }

  private async getTables(schemaName: string, includeInternal: boolean): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<TableRow[]>(Prisma.sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schemaName}
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return rows
      .map((row) => row.table_name)
      .filter((tableName) => includeInternal || tableName !== '_prisma_migrations');
  }

  private async getColumns(schemaName: string, tables: string[]): Promise<ColumnRow[]> {
    return this.queryForTables<ColumnRow>(Prisma.sql`
      SELECT
        c.table_name,
        c.column_name,
        c.ordinal_position,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = ${schemaName}
      ORDER BY c.table_name, c.ordinal_position
    `, tables);
  }

  private async getIndexes(schemaName: string, tables: string[]): Promise<IndexRow[]> {
    return this.queryForTables<IndexRow>(Prisma.sql`
      SELECT
        cls.relname AS table_name,
        attr.attname AS column_name,
        idx.indisunique AS is_unique,
        idx.indisprimary AS is_primary,
        cardinality(idx.indkey) AS column_count
      FROM pg_class cls
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      JOIN pg_index idx ON idx.indrelid = cls.oid
      JOIN pg_attribute attr ON attr.attrelid = cls.oid AND attr.attnum = ANY(idx.indkey)
      WHERE ns.nspname = ${schemaName}
        AND cls.relkind = 'r'
      ORDER BY cls.relname, attr.attname
    `, tables);
  }

  private async getForeignKeys(schemaName: string, tables: string[]): Promise<ForeignKeyRow[]> {
    return this.queryForTables<ForeignKeyRow>(Prisma.sql`
      SELECT
        tc.constraint_name,
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ${schemaName}
      ORDER BY kcu.table_name, kcu.ordinal_position
    `, tables);
  }

  private async getEnums(schemaName: string): Promise<EnumRow[]> {
    return this.prisma.$queryRaw<EnumRow[]>(Prisma.sql`
      SELECT
        type.typname AS enum_name,
        enum.enumlabel AS enum_value,
        enum.enumsortorder AS enum_order
      FROM pg_type type
      JOIN pg_enum enum ON enum.enumtypid = type.oid
      JOIN pg_namespace ns ON ns.oid = type.typnamespace
      WHERE ns.nspname = ${schemaName}
      ORDER BY type.typname, enum.enumsortorder
    `);
  }

  private async queryForTables<T extends { table_name: string }>(
    query: Prisma.Sql,
    tables: string[],
  ): Promise<T[]> {
    const rows = await this.prisma.$queryRaw<T[]>(query);
    const allowed = new Set(tables);
    return rows.filter((row) => allowed.has(row.table_name));
  }

  private mapColumnType(
    column: Pick<ColumnRow, 'data_type' | 'udt_name' | 'column_default'>,
    enumValuesByName: Map<string, string[]>,
    schemaName: string,
  ): { type: string; enumId?: string; enumName?: string } {
    if (column.data_type === 'ARRAY') {
      return { type: 'array' };
    }

    if (enumValuesByName.has(column.udt_name)) {
      return {
        type: 'enum',
        enumId: `enum:${schemaName}.${column.udt_name}`,
        enumName: column.udt_name,
      };
    }

    if (column.udt_name === 'citext') return { type: 'citext' };

    if (column.data_type === 'USER-DEFINED') {
      return { type: 'varchar' };
    }

    if (column.data_type === 'bigint' && column.column_default?.startsWith('nextval(')) {
      return { type: 'bigserial' };
    }

    if (column.data_type === 'integer' && column.column_default?.startsWith('nextval(')) {
      return { type: 'serial' };
    }

    const typeMap = new Map<string, string>([
      ['uuid', 'uuid'],
      ['bigint', 'bigint'],
      ['integer', 'integer'],
      ['smallint', 'smallint'],
      ['character varying', 'varchar'],
      ['text', 'text'],
      ['boolean', 'boolean'],
      ['timestamp without time zone', 'timestamp'],
      ['timestamp with time zone', 'timestamptz'],
      ['date', 'date'],
      ['time without time zone', 'time'],
      ['time with time zone', 'time'],
      ['interval', 'interval'],
      ['json', 'json'],
      ['jsonb', 'jsonb'],
      ['numeric', 'numeric'],
      ['real', 'real'],
      ['double precision', 'double precision'],
      ['money', 'money'],
      ['bytea', 'bytea'],
      ['inet', 'inet'],
      ['cidr', 'cidr'],
      ['macaddr', 'macaddr'],
      ['point', 'point'],
      ['line', 'line'],
      ['polygon', 'polygon'],
      ['circle', 'circle'],
      ['xml', 'xml'],
    ]);

    return { type: typeMap.get(column.data_type) || 'varchar' };
  }

  @Option({ flags: '--out <path>', description: 'Write exported schema JSON to this file' })
  parseOut(value: string) {
    return value;
  }

  @Option({ flags: '--schema <schema>', description: 'Database schema name, defaults to public' })
  parseSchema(value: string) {
    return value;
  }

  @Option({
    flags: '--include-internal [boolean]',
    description: 'Include internal service tables like _prisma_migrations',
  })
  parseIncludeInternal(value?: string) {
    if (value == null) return true;
    return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
  }
}
