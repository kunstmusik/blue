import React, { useCallback, useRef, useState } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';

interface PatternSnapshot {
  patternName: string;
  patternScore: string;
  muted: boolean;
  solo: boolean;
  values: boolean[];
}

const CELL = 20;

const PATTERN_COLOR = '#c6e2ff';
const INACTIVE_EVEN = '#101010';
const INACTIVE_ODD = '#202020';

function PatternCanvas({
  patterns,
  numSteps,
  subDivisions,
  onToggle,
  onSet,
}: {
  patterns: PatternSnapshot[];
  numSteps: number;
  subDivisions: number;
  onToggle: (pi: number, si: number) => void;
  onSet: (pi: number, si: number, val: boolean) => void;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1;
  const writeMode = useRef<boolean>(true);
  const lastCell = useRef<string>('');

  const w = numSteps * CELL;
  const h = Math.max(patterns.length * CELL, CELL);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (let pi = 0; pi < patterns.length; pi++) {
      const pat = patterns[pi];
      for (let si = 0; si < numSteps; si++) {
        const x = si * CELL;
        const y = pi * CELL;

        if (pat.values[si]) {
          ctx.fillStyle = PATTERN_COLOR;
        } else {
          ctx.fillStyle = pi % 2 === 0 ? INACTIVE_EVEN : INACTIVE_ODD;
        }
        ctx.beginPath();
        const r = 5;
        const cx = x + 3;
        const cy = y + 3;
        const cw = CELL - 5;
        const ch = CELL - 5;
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + cw - r, cy);
        ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + r);
        ctx.lineTo(cx + cw, cy + ch - r);
        ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - r, cy + ch);
        ctx.lineTo(cx + r, cy + ch);
        ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - r);
        ctx.lineTo(cx, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 1; i < patterns.length; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(w, i * CELL + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i < numSteps; i++) {
      if (i % subDivisions === 0) {
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
      }
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, h);
      ctx.stroke();
    }

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(numSteps * CELL + 0.5, 0);
    ctx.lineTo(numSteps * CELL + 0.5, h);
    ctx.stroke();

    ctx.restore();
  }, [patterns, numSteps, subDivisions, w, h, dpr]);

  const getCell = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (w / rect.width);
      const my = (e.clientY - rect.top) * (h / rect.height);
      const si = Math.floor(mx / CELL);
      const pi = Math.floor(my / CELL);
      if (pi >= 0 && pi < patterns.length && si >= 0 && si < numSteps) {
        return { pi, si };
      }
      return null;
    },
    [w, h, patterns.length, numSteps],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCell(e);
      if (!cell) return;
      writeMode.current = !patterns[cell.pi].values[cell.si];
      onToggle(cell.pi, cell.si);
      lastCell.current = `${cell.pi},${cell.si}`;
    },
    [getCell, patterns, onToggle],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.buttons !== 1) return;
      const cell = getCell(e);
      if (!cell) return;
      const key = `${cell.pi},${cell.si}`;
      if (key === lastCell.current) return;
      lastCell.current = key;
      onSet(cell.pi, cell.si, writeMode.current);
    },
    [getCell, onSet],
  );

  const handleMouseUp = useCallback(() => {
    lastCell.current = '';
  }, []);

  React.useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={w * dpr}
      height={h * dpr}
      style={{ width: w, height: h, minWidth: w }}
      className="cursor-pointer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

export default function PatternObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'PatternObject')
    return <></>;

  const { beats, subDivisions, patterns } = editor.payload as {
    beats: number;
    subDivisions: number;
    numSteps: number;
    patterns: PatternSnapshot[];
  };
  const numSteps = beats * subDivisions;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [splitY, setSplitY] = useState(200);
  const [splitX, setSplitX] = useState(140);
  const draggingSplitY = useRef(false);
  const draggingSplitX = useRef(false);
  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: p,
      });
    },
    [document.target, onPatch],
  );

  const handleToggleStep = useCallback(
    (patternIndex: number, stepIndex: number) => {
      patch({ toggleStep: { patternIndex, stepIndex } });
    },
    [patch],
  );

  const handleSetStep = useCallback(
    (patternIndex: number, stepIndex: number, val: boolean) => {
      const newPatterns = patterns.map((p, i) => {
        if (i !== patternIndex) return { ...p, values: [...p.values] };
        const values = [...p.values];
        values[stepIndex] = val;
        return { ...p, values };
      });
      patch({ patterns: newPatterns });
    },
    [patterns, patch],
  );

  const handleBeatsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0 && val <= 64) patch({ beats: val });
    },
    [patch],
  );

  const handleSubDivisionsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0 && val <= 64) patch({ subDivisions: val });
    },
    [patch],
  );

  const handlePatternScoreChange = useCallback(
    (patternIndex: number, patternScore: string) => {
      patch({ updatePatternScore: { patternIndex, patternScore } });
    },
    [patch],
  );

  const handlePatternNameChange = useCallback(
    (patternIndex: number, patternName: string) => {
      patch({ updatePatternName: { patternIndex, patternName } });
    },
    [patch],
  );

  const handleAddPattern = useCallback(() => {
    patch({ addPattern: true });
  }, [patch]);

  const handleRemovePattern = useCallback(() => {
    if (patterns.length === 0 || selectedIdx < 0 || selectedIdx >= patterns.length)
      return;
    const newPatterns = patterns
      .filter((_, i) => i !== selectedIdx)
      .map((p) => ({
        patternName: p.patternName,
        patternScore: p.patternScore,
        muted: p.muted,
        solo: p.solo,
        values: [...p.values],
      }));
    patch({ patterns: newPatterns });
    setSelectedIdx(Math.max(0, Math.min(selectedIdx, newPatterns.length - 1)));
  }, [patterns, selectedIdx, patch]);

  const handlePushUp = useCallback(() => {
    if (selectedIdx <= 0) return;
    const newPatterns = patterns.map((p) => ({
      patternName: p.patternName,
      patternScore: p.patternScore,
      muted: p.muted,
      solo: p.solo,
      values: [...p.values],
    }));
    [newPatterns[selectedIdx - 1], newPatterns[selectedIdx]] = [
      newPatterns[selectedIdx],
      newPatterns[selectedIdx - 1],
    ];
    patch({ patterns: newPatterns });
    setSelectedIdx(selectedIdx - 1);
  }, [patterns, selectedIdx, patch]);

  const handlePushDown = useCallback(() => {
    if (selectedIdx >= patterns.length - 1) return;
    const newPatterns = patterns.map((p) => ({
      patternName: p.patternName,
      patternScore: p.patternScore,
      muted: p.muted,
      solo: p.solo,
      values: [...p.values],
    }));
    [newPatterns[selectedIdx], newPatterns[selectedIdx + 1]] = [
      newPatterns[selectedIdx + 1],
      newPatterns[selectedIdx],
    ];
    patch({ patterns: newPatterns });
    setSelectedIdx(selectedIdx + 1);
  }, [patterns, selectedIdx, patch]);

  const handleSplitYDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSplitY.current = true;
    const parent = (e.target as HTMLElement).closest('.pattern-root') as HTMLElement;
    const onMove = (ev: MouseEvent) => {
      if (!draggingSplitY.current || !parent) return;
      const rect = parent.getBoundingClientRect();
      setSplitY(Math.max(60, Math.min(rect.height - 60, ev.clientY - rect.top)));
    };
    const onUp = () => {
      draggingSplitY.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleSplitXDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSplitX.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!draggingSplitX.current) return;
      const parent = (e.target as HTMLElement).closest('.pattern-top') as HTMLElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      setSplitX(Math.max(80, Math.min(300, ev.clientX - rect.left)));
    };
    const onUp = () => {
      draggingSplitX.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const selectedPattern = patterns[selectedIdx] ?? null;

  return (
    <div className="pattern-root flex flex-col h-full select-none">
      <div className="flex items-center gap-3 px-3 py-1 border-b border-blue-border shrink-0 bg-blue-bg/30">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-blue-muted">Beats</label>
          <input
            type="number"
            min={1}
            max={64}
            className="w-12 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-[11px] text-gray-100 focus:border-blue-accent focus:outline-none"
            value={beats}
            onChange={handleBeatsChange}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-blue-muted">Sub</label>
          <input
            type="number"
            min={1}
            max={64}
            className="w-12 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-[11px] text-gray-100 focus:border-blue-accent focus:outline-none"
            value={subDivisions}
            onChange={handleSubDivisionsChange}
          />
        </div>
        <span className="text-[11px] text-blue-muted">{numSteps} steps</span>
        <button
          type="button"
          className="ml-auto rounded border border-blue-border px-2 py-0.5 text-[11px] text-gray-300 hover:border-blue-accent disabled:opacity-50"
          disabled={testing}
          onClick={() => { void runTest(); }}
          title="Test generated score"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="px-3 py-1.5 text-xs border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button className="underline text-blue-muted hover:text-gray-200" onClick={clearTestError}>dismiss</button>
        </div>
      )}

      <div
        className="pattern-top flex shrink-0 overflow-hidden"
        style={{ height: splitY }}
      >
        <div
          className="flex flex-col shrink-0 border-r border-blue-border overflow-hidden"
          style={{ width: splitX }}
        >
          <div
            className="flex items-center shrink-0 border-b border-blue-border bg-blue-bg/60"
            style={{ height: CELL }}
          >
            <div
              className="flex items-center px-1 border-r border-blue-border/40"
              style={{ width: splitX - 28 }}
            >
              <span className="text-[11px] text-blue-muted font-medium">
                Name
              </span>
            </div>
            <div className="flex items-center justify-center" style={{ width: 28 }}>
              <span className="text-[11px] text-blue-muted font-medium">M</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {patterns.map((pat, pi) => (
              <div
                key={pi}
                className={`flex items-center shrink-0 border-b border-blue-border/20 cursor-pointer ${
                  pi === selectedIdx
                    ? 'bg-blue-accent/15'
                    : ''
                }`}
                style={{
                  height: CELL,
                  backgroundColor:
                    pi === selectedIdx
                      ? undefined
                      : pi % 2 === 0
                        ? INACTIVE_EVEN
                        : INACTIVE_ODD,
                }}
                onClick={() => setSelectedIdx(pi)}
              >
                <div
                  className="flex items-center px-1 border-r border-blue-border/20"
                  style={{ width: splitX - 28 }}
                >
                  <input
                    type="text"
                    className="w-full bg-transparent text-[11px] text-gray-200 focus:outline-none focus:text-white"
                    value={pat.patternName}
                    onChange={(e) => {
                      e.stopPropagation();
                      handlePatternNameChange(pi, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    spellCheck={false}
                  />
                </div>
                <div className="flex items-center justify-center" style={{ width: 28 }}>
                  <button
                    className={`w-4 h-4 text-[8px] rounded border shrink-0 flex items-center justify-center ${
                      pat.muted
                        ? 'bg-red-800/70 border-red-600 text-red-200'
                        : 'border-blue-border/40 text-blue-muted/40'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      patch({ toggleMute: pi });
                    }}
                    title="Mute"
                  >
                    M
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center shrink-0 border-t border-blue-border bg-blue-bg/40">
            <button
              className="flex-1 py-1 text-[11px] text-blue-muted hover:bg-blue-border/30 border-r border-blue-border/30"
              onClick={handlePushUp}
              title="Push Up"
            >
              ↑
            </button>
            <button
              className="flex-1 py-1 text-[11px] text-blue-muted hover:bg-blue-border/30 border-r border-blue-border/30"
              onClick={handlePushDown}
              title="Push Down"
            >
              ↓
            </button>
            <button
              className="flex-1 py-1 text-[11px] text-blue-muted hover:bg-blue-border/30 border-r border-blue-border/30"
              onClick={handleAddPattern}
              title="Add Pattern"
            >
              +
            </button>
            <button
              className="flex-1 py-1 text-[11px] text-blue-muted hover:bg-blue-border/30"
              onClick={handleRemovePattern}
              title="Remove Pattern"
            >
              −
            </button>
          </div>
        </div>

        <div
          className="w-1 cursor-col-resize bg-blue-border/40 hover:bg-blue-accent/40 shrink-0"
          onMouseDown={handleSplitXDown}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div
            className="shrink-0 flex border-b border-blue-border bg-blue-bg/60 overflow-hidden"
            style={{ height: CELL }}
          >
            {Array.from({ length: beats }, (_, beat) => (
              <div key={beat} className="flex shrink-0">
                <div
                  className="flex items-center px-0.5 text-[11px] text-gray-400 border-r border-blue-border/40"
                  style={{
                    width: subDivisions * CELL,
                    height: CELL,
                    borderLeft: '1px solid #888',
                  }}
                >
                  {beat + 1}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            <PatternCanvas
              patterns={patterns}
              numSteps={numSteps}
              subDivisions={subDivisions}
              onToggle={handleToggleStep}
              onSet={handleSetStep}
            />
          </div>
        </div>
      </div>

      <div
        className="h-1 cursor-row-resize bg-blue-border/40 hover:bg-blue-accent/40 shrink-0"
        onMouseDown={handleSplitYDown}
      />

      <div className="flex-1 flex flex-col min-h-[50px] overflow-hidden">
        {selectedPattern ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1 border-b border-blue-border bg-blue-bg/30 shrink-0">
              <span className="text-[11px] text-blue-muted font-medium">
                Pattern Score
              </span>
              <input
                type="text"
                className="w-28 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-[11px] text-gray-100 focus:border-blue-accent focus:outline-none"
                value={selectedPattern.patternName}
                onChange={(e) =>
                  handlePatternNameChange(selectedIdx, e.target.value)
                }
              />

            </div>
            <textarea
              className="flex-1 w-full resize-none bg-app-bg px-3 py-1.5 font-mono text-[12px] text-app-text focus:outline-none"
              value={selectedPattern.patternScore}
              onChange={(e) =>
                handlePatternScoreChange(selectedIdx, e.target.value)
              }
              placeholder="i1 <START> <DUR> ..."
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-blue-muted">
            {patterns.length === 0
              ? 'No patterns — click + to add one'
              : 'Select a pattern layer to edit its score'}
          </div>
        )}
      </div>
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
    </div>
  );
}
