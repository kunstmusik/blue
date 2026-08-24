import React from 'react';

const BOX_W = 22.0;
const BOX_H = 22.0;
const COL_STEP = 32.0;

const ROW_CENTERS: Record<number, number> = {
  0: 16.0,
  1: 50.0,
  2: 84.0,
  3: 118.0,
};

const COLS: Record<number | string, number> = {
  0: 16.0,
  1: 16.0 + COL_STEP,
  2: 16.0 + 2 * COL_STEP,
  3: 16.0 + 3 * COL_STEP,
  4: 16.0 + 4 * COL_STEP,
  5: 16.0 + 5 * COL_STEP,
  '20_col1_mid': 16.0 + 1.2 * COL_STEP,
  '20_col2_mid': 16.0 + 2.2 * COL_STEP,
};

interface OpSpec {
  num: number;
  col: number | string;
  row: number;
  isCarrier: boolean;
}

interface AlgoSpec {
  ops: OpSpec[];
  conns: [number, number][];
  fb: [number, number];
}

export const ALGORITHM_DEFINITIONS: Record<number, AlgoSpec> = {
  1: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 0, isCarrier: false },
      { num: 5, col: 1, row: 1, isCarrier: false },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [6, 5], [5, 4], [4, 3]],
    fb: [6, 6],
  },
  2: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 0, isCarrier: false },
      { num: 5, col: 1, row: 1, isCarrier: false },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [6, 5], [5, 4], [4, 3]],
    fb: [2, 2],
  },
  3: {
    ops: [
      { num: 3, col: 0, row: 1, isCarrier: false },
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 1, isCarrier: false },
      { num: 5, col: 1, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [2, 1], [6, 5], [5, 4]],
    fb: [6, 6],
  },
  4: {
    ops: [
      { num: 3, col: 0, row: 1, isCarrier: false },
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 1, isCarrier: false },
      { num: 5, col: 1, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [2, 1], [6, 5], [5, 4]],
    fb: [4, 6],
  },
  5: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 5, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [4, 3], [6, 5]],
    fb: [6, 6],
  },
  6: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 5, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [4, 3], [6, 5]],
    fb: [5, 6],
  },
  7: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 1, isCarrier: false },
      { num: 5, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[2, 1], [6, 5], [4, 3], [5, 3]],
    fb: [6, 6],
  },
  8: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 1, isCarrier: false },
      { num: 5, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[2, 1], [6, 5], [4, 3], [5, 3]],
    fb: [4, 4],
  },
  9: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 1, isCarrier: false },
      { num: 5, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[2, 1], [6, 5], [4, 3], [5, 3]],
    fb: [2, 2],
  },
  10: {
    ops: [
      { num: 5, col: 0, row: 2, isCarrier: false },
      { num: 6, col: 1, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 1, isCarrier: false },
      { num: 2, col: 2, row: 2, isCarrier: false },
      { num: 1, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [2, 1], [5, 4], [6, 4]],
    fb: [3, 3],
  },
  11: {
    ops: [
      { num: 5, col: 0, row: 2, isCarrier: false },
      { num: 6, col: 1, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 1, isCarrier: false },
      { num: 2, col: 2, row: 2, isCarrier: false },
      { num: 1, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [2, 1], [5, 4], [6, 4]],
    fb: [6, 6],
  },
  12: {
    ops: [
      { num: 4, col: 0, row: 2, isCarrier: false },
      { num: 5, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 2, col: 3, row: 2, isCarrier: false },
      { num: 1, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [4, 3], [5, 3], [6, 3]],
    fb: [2, 2],
  },
  13: {
    ops: [
      { num: 4, col: 0, row: 2, isCarrier: false },
      { num: 5, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 2, col: 3, row: 2, isCarrier: false },
      { num: 1, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [4, 3], [5, 3], [6, 3]],
    fb: [6, 6],
  },
  14: {
    ops: [
      { num: 5, col: 0, row: 1, isCarrier: false },
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 1, isCarrier: false },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [5, 4], [6, 4], [4, 3]],
    fb: [6, 6],
  },
  15: {
    ops: [
      { num: 5, col: 0, row: 1, isCarrier: false },
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 1, isCarrier: false },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [5, 4], [6, 4], [4, 3]],
    fb: [2, 2],
  },
  16: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 1, isCarrier: false },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 1, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 1, isCarrier: false },
      { num: 5, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[4, 3], [6, 5], [2, 1], [3, 1], [5, 1]],
    fb: [6, 6],
  },
  17: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 1, isCarrier: false },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 1, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 1, isCarrier: false },
      { num: 5, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[4, 3], [6, 5], [2, 1], [3, 1], [5, 1]],
    fb: [2, 2],
  },
  18: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 1, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 0, isCarrier: false },
      { num: 5, col: 2, row: 1, isCarrier: false },
      { num: 4, col: 2, row: 2, isCarrier: false },
    ],
    conns: [[6, 5], [5, 4], [2, 1], [3, 1], [4, 1]],
    fb: [3, 3],
  },
  19: {
    ops: [
      { num: 3, col: 0, row: 1, isCarrier: false },
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 6, col: 1, row: 2, isCarrier: false },
      { num: 4, col: 1, row: 3, isCarrier: true },
      { num: 5, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [2, 1], [6, 4], [6, 5]],
    fb: [6, 6],
  },
  20: {
    ops: [
      { num: 3, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 5, col: '20_col1_mid', row: 2, isCarrier: false },
      { num: 6, col: '20_col2_mid', row: 2, isCarrier: false },
      { num: 4, col: '20_col2_mid', row: 3, isCarrier: true },
    ],
    conns: [[3, 1], [3, 2], [5, 4], [6, 4]],
    fb: [3, 3],
  },
  21: {
    ops: [
      { num: 3, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 4, col: 2, row: 3, isCarrier: true },
      { num: 5, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[3, 1], [3, 2], [6, 4], [6, 5]],
    fb: [3, 3],
  },
  22: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 4, col: 2, row: 3, isCarrier: true },
      { num: 5, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [6, 3], [6, 4], [6, 5]],
    fb: [6, 6],
  },
  23: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 2, isCarrier: false },
      { num: 4, col: 2, row: 3, isCarrier: true },
      { num: 5, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[3, 2], [6, 4], [6, 5]],
    fb: [6, 6],
  },
  24: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 6, col: 3, row: 2, isCarrier: false },
      { num: 4, col: 3, row: 3, isCarrier: true },
      { num: 5, col: 4, row: 3, isCarrier: true },
    ],
    conns: [[6, 3], [6, 4], [6, 5]],
    fb: [6, 6],
  },
  25: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 6, col: 3, row: 2, isCarrier: false },
      { num: 4, col: 3, row: 3, isCarrier: true },
      { num: 5, col: 4, row: 3, isCarrier: true },
    ],
    conns: [[6, 4], [6, 5]],
    fb: [6, 6],
  },
  26: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 5, col: 2, row: 2, isCarrier: false },
      { num: 6, col: 3, row: 2, isCarrier: false },
      { num: 4, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[3, 4], [5, 4], [6, 4]],
    fb: [6, 6],
  },
  27: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 3, col: 1, row: 2, isCarrier: false },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 5, col: 2, row: 2, isCarrier: false },
      { num: 6, col: 3, row: 2, isCarrier: false },
      { num: 4, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[3, 4], [5, 4], [6, 4]],
    fb: [3, 3],
  },
  28: {
    ops: [
      { num: 2, col: 0, row: 2, isCarrier: false },
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 5, col: 1, row: 1, isCarrier: false },
      { num: 4, col: 1, row: 2, isCarrier: false },
      { num: 3, col: 1, row: 3, isCarrier: true },
      { num: 6, col: 2, row: 3, isCarrier: true },
    ],
    conns: [[2, 1], [5, 4], [4, 3]],
    fb: [5, 5],
  },
  29: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 4, col: 2, row: 2, isCarrier: false },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 6, col: 3, row: 2, isCarrier: false },
      { num: 5, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[4, 3], [6, 5]],
    fb: [6, 6],
  },
  30: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 5, col: 2, row: 1, isCarrier: false },
      { num: 4, col: 2, row: 2, isCarrier: false },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 6, col: 3, row: 3, isCarrier: true },
    ],
    conns: [[5, 4], [4, 3]],
    fb: [5, 5],
  },
  31: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 4, col: 3, row: 3, isCarrier: true },
      { num: 6, col: 4, row: 2, isCarrier: false },
      { num: 5, col: 4, row: 3, isCarrier: true },
    ],
    conns: [[6, 5]],
    fb: [6, 6],
  },
  32: {
    ops: [
      { num: 1, col: 0, row: 3, isCarrier: true },
      { num: 2, col: 1, row: 3, isCarrier: true },
      { num: 3, col: 2, row: 3, isCarrier: true },
      { num: 4, col: 3, row: 3, isCarrier: true },
      { num: 5, col: 4, row: 3, isCarrier: true },
      { num: 6, col: 5, row: 3, isCarrier: true },
    ],
    conns: [],
    fb: [6, 6],
  },
};

export interface AlgorithmSvgProps {
  algorithm: number;
  operatorEnabled?: [boolean, boolean, boolean, boolean, boolean, boolean];
  onToggleOperator?: (opIndex: number) => void;
  interactive?: boolean;
  className?: string;
  dataTestId?: string;
}

export const AlgorithmSvg: React.FC<AlgorithmSvgProps> = ({
  algorithm,
  operatorEnabled,
  onToggleOperator,
  interactive = false,
  className = 'w-full h-full object-contain',
  dataTestId,
}) => {
  const spec = ALGORITHM_DEFINITIONS[algorithm] ?? ALGORITHM_DEFINITIONS[1];

  const opsDict: Record<number, {
    cx: number;
    cy: number;
    x: number;
    y: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
    num: number;
    isCarrier: boolean;
  }> = {};

  for (const op of spec.ops) {
    const cx = typeof op.col === 'number' ? (16.0 + op.col * COL_STEP) : (COLS[op.col] ?? 16.0);
    const cy = ROW_CENTERS[op.row] ?? 16.0;
    const x = cx - BOX_W / 2;
    const y = cy - BOX_H / 2;
    opsDict[op.num] = {
      cx,
      cy,
      x,
      y,
      top: y,
      bottom: y + BOX_H,
      left: x,
      right: x + BOX_W,
      num: op.num,
      isCarrier: op.isCarrier,
    };
  }

  // Connecting lines
  const connLines = spec.conns.map(([srcNum, dstNum], idx) => {
    const src = opsDict[srcNum];
    const dst = opsDict[dstNum];
    if (!src || !dst) return null;
    return (
      <line
        key={`conn-${idx}`}
        x1={src.cx}
        y1={src.bottom}
        x2={dst.cx}
        y2={dst.top}
        stroke="#8da4c4"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    );
  });

  // Feedback loop
  const [fbSrcNum, fbDstNum] = spec.fb;
  const fbSrc = opsDict[fbSrcNum];
  const fbDst = opsDict[fbDstNum];

  let feedbackElement: React.ReactNode = null;
  let loopRight = 0;
  let loopTop = 0;

  if (fbSrc && fbDst) {
    const r = fbSrc.right;
    const cy = fbSrc.cy;
    const dstTop = fbDst.top;
    const dstCx = fbDst.cx;
    const loopW = 7.0;
    loopTop = dstTop - 6.0;
    loopRight = r + loopW;
    const d = `M ${r.toFixed(1)} ${cy.toFixed(1)} H ${loopRight.toFixed(1)} V ${loopTop.toFixed(1)} H ${dstCx.toFixed(1)} V ${dstTop.toFixed(1)}`;
    feedbackElement = (
      <path
        d={d}
        fill="none"
        stroke="#8da4c4"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  // Carriers audio output bus
  const carriers = Object.values(opsDict).filter((layout) => layout.isCarrier);
  const busY = 118.0 + BOX_H / 2 + 10.0;
  let busElements: React.ReactNode = null;

  if (carriers.length > 0) {
    const carrierCxs = carriers.map((c) => c.cx);
    const minCx = Math.min(...carrierCxs);
    const maxCx = Math.max(...carrierCxs);

    busElements = (
      <g key="carrier-bus">
        <line
          x1={minCx}
          y1={busY}
          x2={maxCx}
          y2={busY}
          stroke="#8da4c4"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {carriers.map((c) => (
          <line
            key={`bus-stem-${c.num}`}
            x1={c.cx}
            y1={c.bottom}
            x2={c.cx}
            y2={busY}
            stroke="#8da4c4"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ))}
      </g>
    );
  }

  // Calculate tight bounding box
  const allXs = [
    ...Object.values(opsDict).map((l) => l.x),
    ...Object.values(opsDict).map((l) => l.right),
  ];
  const allYs = [
    ...Object.values(opsDict).map((l) => l.y),
    ...Object.values(opsDict).map((l) => l.bottom),
  ];

  if (loopRight > 0) allXs.push(loopRight);
  if (loopTop !== 0) allYs.push(loopTop);
  if (carriers.length > 0) allYs.push(busY);

  const pad = 4.0;
  const vx = Math.min(...allXs) - pad;
  const vy = Math.min(...allYs) - pad;
  const vw = Math.max(...allXs) - Math.min(...allXs) + 2 * pad;
  const vh = Math.max(...allYs) - Math.min(...allYs) + 2 * pad;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`}
      className={className}
      fill="none"
      data-testid={dataTestId}
    >
      {connLines}
      {feedbackElement}
      {busElements}

      {Object.values(opsDict).map((layout) => {
        const isEnabled = operatorEnabled ? (operatorEnabled[layout.num - 1] ?? true) : true;
        const fillCol = isEnabled
          ? (layout.isCarrier ? '#1b4d3e' : '#203a63')
          : '#0f172a';
        const strokeCol = isEnabled
          ? (layout.isCarrier ? '#38a169' : '#5a85c3')
          : '#475569';
        const textCol = isEnabled ? '#f1f5f9' : '#64748b';

        return (
          <g
            key={`op-box-${layout.num}`}
            id={`op-${layout.num}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`Operator ${layout.num}: ${isEnabled ? 'Enabled' : 'Muted'} (click to toggle)`}
            aria-pressed={interactive ? isEnabled : undefined}
            onClick={interactive ? (e) => {
              e.stopPropagation();
              onToggleOperator?.(layout.num - 1);
            } : undefined}
            onKeyDown={interactive ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleOperator?.(layout.num - 1);
              }
            } : undefined}
            className={interactive ? 'cursor-pointer transition-transform duration-100 hover:scale-110 origin-center' : undefined}
            style={{ transformOrigin: `${layout.cx}px ${layout.cy}px` }}
          >
            <title>{`Operator ${layout.num}: ${isEnabled ? 'Enabled (click to mute)' : 'Muted (click to enable)'}`}</title>
            <rect
              x={layout.x}
              y={layout.y}
              width={BOX_W}
              height={BOX_H}
              rx={3}
              fill={fillCol}
              stroke={strokeCol}
              strokeWidth={isEnabled ? 1.5 : 1.2}
              strokeDasharray={isEnabled ? undefined : '3 2'}
              opacity={isEnabled ? 1 : 0.65}
            />
            {!isEnabled && (
              <line
                x1={layout.x + 3.5}
                y1={layout.y + BOX_H - 3.5}
                x2={layout.x + BOX_W - 3.5}
                y2={layout.y + 3.5}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.8}
              />
            )}
            <text
              x={layout.cx}
              y={layout.cy}
              fill={textCol}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="var(--text-role-subheadline, 11px)"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {layout.num}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
