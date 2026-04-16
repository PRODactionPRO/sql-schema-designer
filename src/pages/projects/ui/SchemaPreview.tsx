import type { Table, Relation } from '@/shared/types/schema';
import { useId } from 'react';

interface SchemaPreviewProps {
  tables: Table[];
  relations: Relation[];
  width?: number;
  height?: number;
}

const MINI_TABLE_W = 56;
const MINI_HEADER_H = 10;
const MINI_FIELD_H = 5;
const PADDING = 12;

/**
 * Miniature canvas preview of a schema.
 * Renders simplified table blocks and relation lines.
 */
export function SchemaPreview({ tables, relations, width = 280, height = 160 }: SchemaPreviewProps) {
  const patternId = useId();

  if (tables.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-gray-100 w-full"
        style={{ height }}
      >
        <span className="text-xs text-gray-400">Empty schema</span>
      </div>
    );
  }

  // Compute bounding box of all tables
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    const th = MINI_HEADER_H + t.fields.length * MINI_FIELD_H;
    minX = Math.min(minX, t.position.x);
    minY = Math.min(minY, t.position.y);
    maxX = Math.max(maxX, t.position.x + MINI_TABLE_W);
    maxY = Math.max(maxY, t.position.y + th);
  }

  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const scaleX = (width - PADDING * 2) / contentW;
  const scaleY = (height - PADDING * 2) / contentH;
  const scale = Math.min(scaleX, scaleY, 1.5);

  const offsetX = PADDING + ((width - PADDING * 2) - contentW * scale) / 2;
  const offsetY = PADDING + ((height - PADDING * 2) - contentH * scale) / 2;

  const tx = (x: number) => offsetX + (x - minX) * scale;
  const ty = (y: number) => offsetY + (y - minY) * scale;

  // Pre-compute table midpoints for relations
  const tableMap = new Map(tables.map(t => [t.id, t]));

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-lg bg-gray-50"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid dots */}
      <defs>
        <pattern id={patternId} width={8} height={8} patternUnits="userSpaceOnUse">
          <circle cx={4} cy={4} r={0.5} fill="#d1d5db" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${patternId})`} rx={8} />

      {/* Relations */}
      {relations.map(rel => {
        const fromTable = tableMap.get(rel.fromTableId);
        const toTable = tableMap.get(rel.toTableId);
        if (!fromTable || !toTable) return null;

        const fromH = MINI_HEADER_H + fromTable.fields.length * MINI_FIELD_H;
        const toH = MINI_HEADER_H + toTable.fields.length * MINI_FIELD_H;

        const x1 = tx(fromTable.position.x + MINI_TABLE_W / 2);
        const y1 = ty(fromTable.position.y + fromH / 2);
        const x2 = tx(toTable.position.x + MINI_TABLE_W / 2);
        const y2 = ty(toTable.position.y + toH / 2);

        const cpOff = Math.abs(x2 - x1) * 0.4;

        return (
          <path
            key={rel.id}
            d={`M ${x1} ${y1} C ${x1 + cpOff * Math.sign(x2 - x1)} ${y1}, ${x2 - cpOff * Math.sign(x2 - x1)} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.6}
          />
        );
      })}

      {/* Tables */}
      {tables.map((t, i) => {
        const th = (MINI_HEADER_H + t.fields.length * MINI_FIELD_H) * scale;
        const tw = MINI_TABLE_W * scale;
        const x = tx(t.position.x);
        const y = ty(t.position.y);
        const color = t.color || '#6366f1';

        return (
          <g key={`${t.id}-${i}`}>
            <rect
              x={x}
              y={y}
              width={tw}
              height={th}
              rx={2}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
            <rect
              x={x}
              y={y}
              width={tw}
              height={Math.max(MINI_HEADER_H * scale, 4)}
              rx={2}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}