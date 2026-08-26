import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TableSnapshot } from './jmask-utils';
import CommitNumberInput from './CommitNumberInput';
import { resolveTypographyRoleFont } from '../../../../../../lib/typography';
import { AppSelect } from '../../../../../AppSelect';

const TABLE_INTERPOLATION_TYPES = ['Off', 'On', 'Cosine'];
const CANVAS_H = 100;
const PAD = 5;

interface TableEditorProps {
  table: TableSnapshot;
  duration: number;
  onChange: (table: TableSnapshot) => void;
  minMaxEnabled?: boolean;
}

export default function TableEditor({ table, duration, onChange, minMaxEnabled = true }: TableEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawW, setDrawW] = useState(400);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const points = (table.points as Array<{ kind?: string; time: number; value: number }>) ?? [];
  const min = typeof table.min === 'number' ? table.min : 0;
  const max = typeof table.max === 'number' ? table.max : 1;
  const interpolationType = typeof table.interpolationType === 'number' ? table.interpolationType : 1;
  const interpolation = typeof table.interpolation === 'number' ? table.interpolation : 0;
  const range = max - min || 1;

  const plotW = drawW - PAD * 2;
  const plotH = CANVAS_H - PAD * 2;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setDrawW(Math.max(100, Math.round(rect.width)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => { obs.disconnect(); };
  }, []);

  const toCanvasX = useCallback((t: number) => PAD + t * plotW, [plotW]);
  const toCanvasY = useCallback((v: number) => PAD + (1 - (v - min) / range) * plotH, [plotH, min, range]);
  const fromCanvasX = useCallback((cx: number) => Math.max(0, Math.min(1, (cx - PAD) / plotW)), [plotW]);
  const fromCanvasY = useCallback((cy: number) => min + (1 - (cy - PAD) / plotH) * range, [plotH, min, range]);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = drawW;
    const h = CANVAS_H;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, PAD, plotW, plotH);

    if (points.length < 2) {
      ctx.restore();
      return;
    }

    const sorted = [...points].sort((a, b) => a.time - b.time);
    ctx.strokeStyle = '#22cc44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < sorted.length; i++) {
      const cx = toCanvasX(sorted[i]!.time);
      const cy = toCanvasY(sorted[i]!.value);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    for (const pt of sorted) {
      const cx = toCanvasX(pt.time);
      const cy = toCanvasY(pt.value);
      ctx.fillStyle = '#22cc44';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    if (selectedPoint !== null && points[selectedPoint]) {
      const sp = points[selectedPoint]!;
      const sx = toCanvasX(sp.time);
      const sy = toCanvasY(sp.value);
      ctx.fillStyle = '#ff4d4f';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = resolveTypographyRoleFont(canvas, 'subheadline', { family: 'monospace' });
      const xText = `x: ${(sp.time * duration).toFixed(3)}`;
      const yText = `y: ${sp.value.toFixed(4)}`;
      let textX = sx + 8;
      let textY = sy - 5;
      if (textX + 95 > w) textX = sx - 95;
      if (textY < 14) textY = sy + 14;
      ctx.fillText(xText, textX, textY);
      ctx.fillText(yText, textX, textY + 13);
    }

    ctx.restore();
  }, [points, selectedPoint, drawW, dpr, toCanvasX, toCanvasY, duration, plotW, plotH, range, min]);

  useEffect(() => { draw(); }, [draw]);

  const findHit = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (drawW / rect.width);
    const my = (clientY - rect.top) * (CANVAS_H / rect.height);
    for (let i = 0; i < points.length; i++) {
      const px = toCanvasX(points[i]!.time);
      const py = toCanvasY(points[i]!.value);
      if (Math.hypot(px - mx, py - my) <= 5) return i;
    }
    return null;
  }, [points, drawW, toCanvasX, toCanvasY]);

  const getBoundaries = useCallback((idx: number): { left: number; right: number } => {
    if (idx === 0) return { left: 0, right: 0 };
    if (idx === points.length - 1) return { left: 1, right: 1 };
    return { left: points[idx - 1]?.time ?? 0, right: points[idx + 1]?.time ?? 1 };
  }, [points]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const hit = findHit(e.clientX, e.clientY);
    if (hit !== null) {
      setDragIdx(hit);
      setSelectedPoint(hit);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (drawW / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    if (mx < PAD || mx > drawW - PAD || my < PAD || my > CANVAS_H - PAD) return;

    const time = fromCanvasX(mx);
    const value = fromCanvasY(my);
    const newPoints = [...points];
    let insertIdx = newPoints.length;
    for (let i = 0; i < newPoints.length - 1; i++) {
      if (time >= newPoints[i]!.time && time <= newPoints[i + 1]!.time) {
        insertIdx = i + 1;
        break;
      }
    }
    newPoints.splice(insertIdx, 0, { kind: 'TablePoint', time, value });
    onChange({ ...structuredClone(table), points: newPoints });
    setDragIdx(insertIdx);
    setSelectedPoint(insertIdx);
  }, [findHit, getBoundaries, points, table, onChange, drawW, fromCanvasX, fromCanvasY]);

  useEffect(() => {
    if (dragIdx === null) return undefined;
    const handleMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (drawW / rect.width);
      const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
      let time = fromCanvasX(mx);
      let value = fromCanvasY(my);
      const bounds = getBoundaries(dragIdx);
      time = Math.max(bounds.left, Math.min(bounds.right, time));
      value = Math.max(min, Math.min(max, value));
      const newPoints = [...points];
      newPoints[dragIdx] = { kind: 'TablePoint', time, value };
      onChange({ ...structuredClone(table), points: newPoints });
    };
    const handleUp = () => { setDragIdx(null); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragIdx, points, table, onChange, drawW, fromCanvasX, fromCanvasY, getBoundaries, min, max]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const hit = findHit(e.clientX, e.clientY);
    if (hit === null || hit === 0 || hit === points.length - 1) return;
    const newPoints = points.filter((_, i) => i !== hit);
    onChange({ ...structuredClone(table), points: newPoints });
    setSelectedPoint(null);
  }, [findHit, points, table, onChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragIdx !== null) return;
    const hit = findHit(e.clientX, e.clientY);
    setSelectedPoint(hit);
  }, [dragIdx, findHit]);

  const handleInterpolationTypeChange = useCallback((value: string) => {
    onChange({ ...structuredClone(table), interpolationType: parseInt(value, 10) });
  }, [table, onChange]);

  const handleInterpolationCommit = useCallback((v: number) => {
    onChange({ ...structuredClone(table), interpolation: v });
  }, [table, onChange]);

  const handleMinCommit = useCallback((v: number) => {
    if (v >= max) return;
    onChange({ ...structuredClone(table), min: v });
  }, [table, onChange, max]);

  const handleMaxCommit = useCallback((v: number) => {
    if (v <= min) return;
    onChange({ ...structuredClone(table), max: v });
  }, [table, onChange, min]);

  return (
    <div className="flex flex-col gap-1">
      <div ref={containerRef} className="w-full rounded-sm border border-gray-600 bg-black">
        <canvas
          ref={canvasRef}
          width={drawW * dpr}
          height={CANVAS_H * dpr}
          style={{ width: drawW, height: CANVAS_H }}
          className="block cursor-crosshair select-none rounded-sm"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { if (dragIdx === null) setSelectedPoint(null); }}
          onContextMenu={handleContextMenu}
        />
      </div>
      <div className="flex items-center gap-2 text-role-body text-gray-300">
        <label className="shrink-0">Interp</label>
        <AppSelect
          className="rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={interpolationType}
          onValueChange={handleInterpolationTypeChange}
          options={TABLE_INTERPOLATION_TYPES.map((label, value) => ({ value, label }))}
        />
        <CommitNumberInput
          value={interpolation}
          step={0.1}
          className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          onChange={handleInterpolationCommit}
        />
        {minMaxEnabled && (
          <>
            <label className="shrink-0">Min</label>
            <CommitNumberInput
              value={min}
              step={0.1}
              className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              onChange={handleMinCommit}
            />
            <label className="shrink-0">Max</label>
            <CommitNumberInput
              value={max}
              step={0.1}
              className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              onChange={handleMaxCommit}
            />
          </>
        )}
      </div>
    </div>
  );
}
