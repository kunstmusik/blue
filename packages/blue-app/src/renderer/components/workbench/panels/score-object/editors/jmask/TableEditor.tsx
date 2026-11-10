import React, { useCallback, useEffect, useRef, useState } from 'react';
import CommitNumberInput from '../../../../../CommitNumberInput';
import type { TableSnapshot } from './jmask-utils';
import { resolveTypographyRoleFont } from '../../../../../../lib/typography';
import { AppSelect } from '../../../../../AppSelect';
import { attachHostGesture, type HostGestureDisposer } from '../../../../../../lib/host-gesture';
import { registerHistoryEditorSettlement } from '../../../../../../lib/history-scope-router';
import { getProjectDocumentId, useProjectStore } from '../../../../../../stores/project-store';

const TABLE_INTERPOLATION_TYPES = ['Off', 'On', 'Cosine'];
const CANVAS_H = 100;
const PAD = 5;

interface TableEditorProps {
  table: TableSnapshot;
  duration: number;
  onChange: (table: TableSnapshot) => void;
  minMaxEnabled?: boolean;
}

function areTablePointsEqual(
  a: Array<{ kind?: string; time: number; value: number }>,
  b: Array<{ kind?: string; time: number; value: number }>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i]!;
    const p2 = b[i]!;
    if (Math.abs(p1.time - p2.time) > 1e-6 || Math.abs(p1.value - p2.value) > 1e-6) {
      return false;
    }
  }
  return true;
}

export default function TableEditor({
  table,
  duration,
  onChange,
  minMaxEnabled = true,
}: TableEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawW, setDrawW] = useState(400);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const [draftTable, setDraftTable] = useState<TableSnapshot | null>(null);
  const draftTableRef = useRef<TableSnapshot | null>(null);
  const tableRef = useRef(table);
  tableRef.current = table;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const dragIdxRef = useRef<number | null>(null);
  const hostGestureDisposerRef = useRef<HostGestureDisposer | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const gestureFenceRef = useRef<{ documentId: string; sessionId: number; table: string } | null>(
    null,
  );

  const endHostGesture = useCallback(() => {
    if (hostGestureDisposerRef.current) {
      hostGestureDisposerRef.current();
      hostGestureDisposerRef.current = null;
    }
  }, []);

  const clearGesture = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    gestureFenceRef.current = null;
    endHostGesture();
    dragIdxRef.current = null;
    draftTableRef.current = null;
    setDraftTable(null);
  }, [endHostGesture]);

  useEffect(() => {
    return () => {
      clearGesture();
    };
  }, [clearGesture]);

  useEffect(() => {
    if (gestureFenceRef.current && gestureFenceRef.current.table !== JSON.stringify(table)) {
      clearGesture();
    }
  }, [table, clearGesture]);

  const effectiveTable = draftTable ?? table;
  const points =
    (effectiveTable.points as Array<{ kind?: string; time: number; value: number }>) ?? [];
  const min = typeof effectiveTable.min === 'number' ? effectiveTable.min : 0;
  const max = typeof effectiveTable.max === 'number' ? effectiveTable.max : 1;
  const interpolationType =
    typeof effectiveTable.interpolationType === 'number' ? effectiveTable.interpolationType : 1;
  const interpolation =
    typeof effectiveTable.interpolation === 'number' ? effectiveTable.interpolation : 0;
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
    return () => {
      obs.disconnect();
    };
  }, []);

  const toCanvasX = useCallback((t: number) => PAD + t * plotW, [plotW]);
  const toCanvasY = useCallback(
    (v: number) => PAD + (1 - (v - min) / range) * plotH,
    [plotH, min, range],
  );
  const fromCanvasX = useCallback(
    (cx: number) => Math.max(0, Math.min(1, (cx - PAD) / plotW)),
    [plotW],
  );
  const fromCanvasY = useCallback(
    (cy: number) => min + (1 - (cy - PAD) / plotH) * range,
    [plotH, min, range],
  );

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;

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

  useEffect(() => {
    draw();
  }, [draw]);

  const findHit = useCallback(
    (clientX: number, clientY: number): number | null => {
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
    },
    [points, drawW, toCanvasX, toCanvasY],
  );

  const getBoundaries = useCallback(
    (
      pts: Array<{ kind?: string; time: number; value: number }>,
      idx: number,
    ): { left: number; right: number } => {
      if (idx === 0) return { left: 0, right: 0 };
      if (idx === pts.length - 1) return { left: 1, right: 1 };
      return { left: pts[idx - 1]?.time ?? 0, right: pts[idx + 1]?.time ?? 1 };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      clearGesture();
      const baseTable = tableRef.current;
      const basePoints =
        (baseTable.points as Array<{ kind?: string; time: number; value: number }>) ?? [];
      const hit = findHit(e.clientX, e.clientY);
      let currentDragIdx: number | null = null;
      let initialDraft: TableSnapshot;

      if (hit !== null) {
        currentDragIdx = hit;
        initialDraft = structuredClone(baseTable);
        setSelectedPoint(hit);
      } else {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (drawW / rect.width);
        const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
        if (mx < PAD || mx > drawW - PAD || my < PAD || my > CANVAS_H - PAD) return;

        const time = fromCanvasX(mx);
        const value = fromCanvasY(my);
        const newPoints = basePoints.map((pt) => ({ ...pt }));
        let insertIdx = newPoints.length;
        for (let i = 0; i < newPoints.length - 1; i++) {
          if (time >= newPoints[i]!.time && time <= newPoints[i + 1]!.time) {
            insertIdx = i + 1;
            break;
          }
        }
        newPoints.splice(insertIdx, 0, { kind: 'TablePoint', time, value });
        initialDraft = { ...structuredClone(baseTable), points: newPoints };
        currentDragIdx = insertIdx;
        setSelectedPoint(insertIdx);
      }

      dragIdxRef.current = currentDragIdx;
      draftTableRef.current = initialDraft;
      setDraftTable(initialDraft);

      const documentId =
        typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
      const sessionId = useProjectStore.getState().sessionId;
      gestureFenceRef.current = { documentId, sessionId, table: JSON.stringify(baseTable) };

      if (typeof registerHistoryEditorSettlement === 'function') {
        const hostDoc = canvasRef.current?.ownerDocument ?? document;
        unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
          const currentDocId =
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
          const currentSessionId = useProjectStore.getState().sessionId;
          const finalDraft = draftTableRef.current;
          if (
            gestureFenceRef.current?.documentId === currentDocId &&
            gestureFenceRef.current?.sessionId === currentSessionId &&
            gestureFenceRef.current?.table === JSON.stringify(tableRef.current) &&
            finalDraft &&
            !areTablePointsEqual(
              (finalDraft.points as Array<{ kind?: string; time: number; value: number }>) ?? [],
              (baseTable.points as Array<{ kind?: string; time: number; value: number }>) ?? [],
            )
          ) {
            onChangeRef.current(finalDraft);
          }
          clearGesture();
          return useProjectStore.getState().flushPendingPatches?.();
        });
      }

      const host = canvasRef.current;
      const disposer = attachHostGesture({
        host,
        onMove: (moveEvent) => {
          const currentDocId =
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
          const currentSessionId = useProjectStore.getState().sessionId;
          if (
            currentDocId !== gestureFenceRef.current?.documentId ||
            currentSessionId !== gestureFenceRef.current?.sessionId ||
            gestureFenceRef.current?.table !== JSON.stringify(tableRef.current)
          ) {
            clearGesture();
            return;
          }
          const drag = dragIdxRef.current;
          const draft = draftTableRef.current;
          if (drag === null || !draft) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const me = moveEvent as MouseEvent;
          const mx = (me.clientX - rect.left) * (drawW / rect.width);
          const my = (me.clientY - rect.top) * (CANVAS_H / rect.height);
          let time = fromCanvasX(mx);
          let value = fromCanvasY(my);
          const pts = (draft.points as Array<{ kind?: string; time: number; value: number }>) ?? [];
          const bounds = getBoundaries(pts, drag);
          time = Math.max(bounds.left, Math.min(bounds.right, time));
          value = Math.max(min, Math.min(max, value));
          const updatedPoints = pts.map((pt) => ({ ...pt }));
          updatedPoints[drag] = { kind: 'TablePoint', time, value };
          const nextDraft = { ...draft, points: updatedPoints };
          draftTableRef.current = nextDraft;
          setDraftTable(nextDraft);
        },
        onRelease: () => {
          const currentDocId =
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
          const currentSessionId = useProjectStore.getState().sessionId;
          const finalDraft = draftTableRef.current;
          const isFencedValid =
            currentDocId === gestureFenceRef.current?.documentId &&
            currentSessionId === gestureFenceRef.current?.sessionId &&
            gestureFenceRef.current?.table === JSON.stringify(tableRef.current);
          clearGesture();
          if (
            isFencedValid &&
            finalDraft &&
            !areTablePointsEqual(
              (finalDraft.points as Array<{ kind?: string; time: number; value: number }>) ?? [],
              (baseTable.points as Array<{ kind?: string; time: number; value: number }>) ?? [],
            )
          ) {
            onChangeRef.current(finalDraft);
          }
        },
        onEscape: () => {
          clearGesture();
        },
        onBlur: () => {
          clearGesture();
        },
        onCancel: () => {
          clearGesture();
        },
      });
      hostGestureDisposerRef.current = disposer;
    },
    [findHit, drawW, fromCanvasX, fromCanvasY, min, max, getBoundaries, clearGesture],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      clearGesture();
      const hit = findHit(e.clientX, e.clientY);
      if (hit === null || hit === 0 || hit === points.length - 1) return;
      const newPoints = points.filter((_, i) => i !== hit);
      onChange({ ...structuredClone(table), points: newPoints });
      setSelectedPoint(null);
    },
    [clearGesture, findHit, points, table, onChange],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragIdxRef.current !== null) return;
      const hit = findHit(e.clientX, e.clientY);
      setSelectedPoint(hit);
    },
    [findHit],
  );

  const handleInterpolationTypeChange = useCallback(
    (value: string) => {
      onChange({ ...structuredClone(table), interpolationType: parseInt(value, 10) });
    },
    [table, onChange],
  );

  const handleInterpolationCommit = useCallback(
    (v: number) => {
      onChange({ ...structuredClone(table), interpolation: v });
    },
    [table, onChange],
  );

  const handleMinCommit = useCallback(
    (v: number) => {
      if (v >= max) return;
      onChange({ ...structuredClone(table), min: v });
    },
    [table, onChange, max],
  );

  const handleMaxCommit = useCallback(
    (v: number) => {
      if (v <= min) return;
      onChange({ ...structuredClone(table), max: v });
    },
    [table, onChange, min],
  );

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
          onMouseLeave={() => {
            if (dragIdxRef.current === null) setSelectedPoint(null);
          }}
          onContextMenu={handleContextMenu}
        />
      </div>
      <div className="flex items-center gap-2 text-role-body text-gray-300">
        <label className="shrink-0" htmlFor="table-interp-select">
          Interp
        </label>
        <AppSelect
          id="table-interp-select"
          aria-label="Interpolation type"
          className="rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={interpolationType}
          onValueChange={handleInterpolationTypeChange}
          options={TABLE_INTERPOLATION_TYPES.map((label, value) => ({ value, label }))}
        />
        <CommitNumberInput
          aria-label="Interpolation value"
          value={interpolation}
          step={0.1}
          className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          onChange={handleInterpolationCommit}
        />
        {minMaxEnabled && (
          <>
            <label className="shrink-0">Min</label>
            <CommitNumberInput
              aria-label="Minimum value"
              value={min}
              step={0.1}
              className="w-14 rounded border border-blue-border bg-blue-bg px-1 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
              onChange={handleMinCommit}
            />
            <label className="shrink-0">Max</label>
            <CommitNumberInput
              aria-label="Maximum value"
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
