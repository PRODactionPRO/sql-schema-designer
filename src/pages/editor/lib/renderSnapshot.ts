import type { Table, Relation, Domain } from '../model/types';

const SNAP_W = 560;
const SNAP_H = 320;
const TABLE_W = 160;
const HEADER_H = 24;
const FIELD_H = 18;
const PADDING = 24;
const BORDER_RADIUS = 6;

/** Viewport in world coordinates */
export interface SnapshotViewport {
  /** World-space X of the left edge of the visible area */
  x: number;
  /** World-space Y of the top edge of the visible area */
  y: number;
  /** World-space width of the visible area */
  width: number;
  /** World-space height of the visible area */
  height: number;
}

/**
 * Renders a high-quality PNG snapshot of the schema to a base64 data URL.
 * When `viewport` is provided, renders only the visible portion of the canvas
 * (what the user actually sees). Otherwise falls back to auto-fitting all tables.
 */
export function renderSnapshotDataUrl(
  tables: Table[],
  relations: Relation[],
  domains: Domain[],
  getTableColor: (table: Table) => string,
  viewport?: SnapshotViewport,
): string {
  const dpr = 2; // retina-like quality
  const canvas = document.createElement('canvas');
  canvas.width = SNAP_W * dpr;
  canvas.height = SNAP_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background - light gray with subtle grid
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, SNAP_W, SNAP_H);

  // Grid dots
  ctx.fillStyle = '#e2e8f0';
  for (let x = 0; x < SNAP_W; x += 16) {
    for (let y = 0; y < SNAP_H; y += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tables.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Empty schema', SNAP_W / 2, SNAP_H / 2);
    return canvas.toDataURL('image/png');
  }

  // Determine the world-space region to render
  let viewMinX: number, viewMinY: number, viewW: number, viewH: number;

  if (viewport) {
    // Use the exact viewport the user sees
    viewMinX = viewport.x;
    viewMinY = viewport.y;
    viewW = viewport.width;
    viewH = viewport.height;
  } else {
    // Auto-fit: compute bounding box of all tables
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const th = HEADER_H + t.fields.length * FIELD_H + 4;
      minX = Math.min(minX, t.position.x);
      minY = Math.min(minY, t.position.y);
      maxX = Math.max(maxX, t.position.x + TABLE_W);
      maxY = Math.max(maxY, t.position.y + th);
    }
    viewMinX = minX;
    viewMinY = minY;
    viewW = (maxX - minX) || 1;
    viewH = (maxY - minY) || 1;
  }

  // Scale world region into snapshot canvas (with padding)
  const scaleX = (SNAP_W - PADDING * 2) / viewW;
  const scaleY = (SNAP_H - PADDING * 2) / viewH;
  const scale = Math.min(scaleX, scaleY, viewport ? Infinity : 1.2);

  const offsetX = PADDING + ((SNAP_W - PADDING * 2) - viewW * scale) / 2;
  const offsetY = PADDING + ((SNAP_H - PADDING * 2) - viewH * scale) / 2;

  const tx = (x: number) => offsetX + (x - viewMinX) * scale;
  const ty = (y: number) => offsetY + (y - viewMinY) * scale;

  const tableMap = new Map(tables.map(t => [t.id, t]));

  // Helper: check if a table overlaps with the render region (with some margin)
  const TABLE_REAL_W = TABLE_W; // world-space table width used in snapshot
  const isTableVisible = (t: Table): boolean => {
    if (!viewport) return true; // no viewport = render all
    const th = HEADER_H + t.fields.length * FIELD_H + 4;
    const margin = 50; // extra margin so partially visible tables still show
    return (
      t.position.x + TABLE_REAL_W + margin >= viewMinX &&
      t.position.x - margin <= viewMinX + viewW &&
      t.position.y + th + margin >= viewMinY &&
      t.position.y - margin <= viewMinY + viewH
    );
  };

  const visibleTables = tables.filter(isTableVisible);
  const visibleTableIds = new Set(visibleTables.map(t => t.id));

  // -- Draw relations --
  ctx.lineWidth = 1.2;
  for (const rel of relations) {
    const from = tableMap.get(rel.fromTableId);
    const to = tableMap.get(rel.toTableId);
    if (!from || !to) continue;
    // Draw relation if at least one endpoint is visible
    if (!visibleTableIds.has(rel.fromTableId) && !visibleTableIds.has(rel.toTableId)) continue;

    const fromH = HEADER_H + from.fields.length * FIELD_H + 4;
    const toH = HEADER_H + to.fields.length * FIELD_H + 4;

    const x1 = tx(from.position.x + TABLE_W / 2);
    const y1 = ty(from.position.y + fromH / 2);
    const x2 = tx(to.position.x + TABLE_W / 2);
    const y2 = ty(to.position.y + toH / 2);

    const cpOff = Math.abs(x2 - x1) * 0.35;

    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(
      x1 + cpOff * Math.sign(x2 - x1), y1,
      x2 - cpOff * Math.sign(x2 - x1), y2,
      x2, y2,
    );
    ctx.stroke();
  }

  // -- Draw tables --
  for (const t of visibleTables) {
    const color = getTableColor(t);
    const th = (HEADER_H + t.fields.length * FIELD_H + 4) * scale;
    const tw = TABLE_W * scale;
    const x = tx(t.position.x);
    const y = ty(t.position.y);
    const headerH = HEADER_H * scale;
    const fieldH = FIELD_H * scale;
    const r = BORDER_RADIUS * scale;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;

    // Card body
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, x, y, tw, th, r);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    roundedRect(ctx, x, y, tw, th, r);
    ctx.stroke();

    // Header with color
    ctx.fillStyle = color;
    roundedRectTop(ctx, x, y, tw, headerH, r);
    ctx.fill();

    // Table name
    const fontSize = Math.max(9 * scale, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxTextW = tw - 8 * scale;
    let displayName = t.name;
    while (ctx.measureText(displayName).width > maxTextW && displayName.length > 1) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== t.name) displayName += '...';
    ctx.fillText(displayName, x + 5 * scale, y + headerH / 2);

    // Fields
    const fieldFontSize = Math.max(7 * scale, 5);
    ctx.font = `400 ${fieldFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    t.fields.forEach((f, i) => {
      const fy = y + headerH + i * fieldH;
      // Alternating bg
      if (i % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 0.5, fy, tw - 1, fieldH);
      }
      // Field name
      ctx.fillStyle = f.isPrimaryKey ? '#6366f1' : f.isForeignKey ? '#f59e0b' : '#475569';
      ctx.textAlign = 'left';
      let fname = f.name;
      const fnameMaxW = tw * 0.55;
      while (ctx.measureText(fname).width > fnameMaxW && fname.length > 1) {
        fname = fname.slice(0, -1);
      }
      if (fname !== f.name) fname += '..';
      ctx.fillText(fname, x + 5 * scale, fy + fieldH / 2);

      // Field type
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      let ftype = f.type;
      const ftypeMaxW = tw * 0.35;
      while (ctx.measureText(ftype).width > ftypeMaxW && ftype.length > 1) {
        ftype = ftype.slice(0, -1);
      }
      ctx.fillText(ftype, x + tw - 5 * scale, fy + fieldH / 2);
    });
  }

  return canvas.toDataURL('image/png');
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundedRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
