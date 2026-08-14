/**
 * Java Blue CSDRender-compatible parameter automation generation.
 *
 * Isolated from BlueData so offline render/freeze parity with Java
 * `blue.ui.core.render.CSDRender` is testable independently of the realtime
 * `Line.getValue()` contract. The two paths are observably different: the
 * offline score uses Java's step/accumulation algorithm, `Math.round` int
 * stepping, range clipping through the line evaluator, the `renderEnd <= 0`
 * open-range sentinel, float-literal `.0001f` durations, and
 * `NumberUtilities.formatDouble` (##.##########) text.
 */

import { Parameter } from '../automation/parameter';
import { formatBlueNumber } from '../utilities/number-format';

/** Java float literal `.0001f` widened to double. */
const FLOAT_0001: number = Math.fround(0.0001);

interface ParameterScoreContext {
  readonly parameter: Parameter;
  readonly instrumentId: number;
  readonly renderStart: number;
  readonly renderEnd: number;
}

/**
 * Appends the parameter score fragment exactly as Java
 * `CSDRender.appendParameterScore` does. Returns the raw score text (the
 * fragment Java passes to ScoreUtilities.getNotes).
 */
export function appendParameterScoreJava(context: ParameterScoreContext): string {
  const { parameter, instrumentId, renderStart, renderEnd } = context;
  const points = parameter.getPoints();

  if (points.length < 2) {
    return '';
  }

  const resolution = parameter.getResolution();
  const score: string[] = [];

  if (resolution > 0.0) {
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]!;
      const p2 = points[i]!;

      const startTime = p1.time;
      const endTime = p2.time;

      if (renderEnd > 0 && startTime >= renderEnd) {
        break;
      }

      if (endTime <= renderStart) {
        continue;
      }

      const startVal = p1.value;
      const endVal = p2.value;

      // to skip points that don't contribute to end value
      if (startTime === endTime) {
        if (i === points.length - 1) {
          createParamNote(score, instrumentId, endTime, FLOAT_0001, p2.value, p2.value);
        }
        continue;
      }

      if (startVal === endVal) {
        continue;
      }

      const dur = endTime - startTime;

      let currentVal = startVal;

      // Java: (int) Math.abs(Math.round((endVal - startVal) / resolution))
      const numSteps = Math.abs(Math.round((endVal - startVal) / resolution)) | 0;

      const step = dur / numSteps;

      let start = startTime;

      let valStep = resolution;

      if (endVal < startVal) {
        valStep = -valStep;
      }

      // skip the first value as it will be already defined
      for (let j = 0; j < numSteps - 1; j++) {
        currentVal += valStep;
        start += step;

        if (start <= renderStart) {
          continue;
        }

        if (renderEnd > 0 && start >= renderEnd) {
          return score.join('');
        }

        score.push(
          `i${instrumentId}\t${formatBlueNumber(start - renderStart)}\t.0001\t${formatBlueNumber(currentVal)}\n`,
        );
      }

      start += step;

      if (renderEnd > 0 && start >= renderEnd) {
        return score.join('');
      }

      score.push(
        `i${instrumentId}\t${formatBlueNumber(start - renderStart)}\t.0001\t${formatBlueNumber(endVal)}\n`,
      );
    }

    return score.join('');
  }

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]!;
    const p2 = points[i]!;

    let startTime = p1.time;
    let endTime = p2.time;

    if (renderEnd > 0 && startTime >= renderEnd) {
      break;
    }

    if (endTime <= renderStart) {
      continue;
    }

    if (p1.time === p2.time) {
      if (i === points.length - 1) {
        createParamNote(score, instrumentId, p2.time, FLOAT_0001, p2.value, p2.value);
      }
      continue;
    }

    let startVal = p1.value;
    let endVal = p2.value;

    if (startTime < renderStart) {
      startVal = parameter.getValue(renderStart);
      startTime = renderStart;
    }

    if (renderEnd > 0 && endTime > renderEnd) {
      endVal = parameter.getValue(renderEnd);
      endTime = renderEnd;
    }

    let dur: number;

    if (p1.value === p2.value) {
      dur = FLOAT_0001;
    } else {
      dur = endTime - startTime;
    }

    startTime -= renderStart;

    createParamNote(score, instrumentId, startTime, dur, startVal, endVal);

    if (i === points.length - 1) {
      createParamNote(score, instrumentId, startTime + dur, FLOAT_0001, endVal, endVal);
    }
  }

  return score.join('');
}

function createParamNote(
  score: string[],
  instrumentId: number,
  startTime: number,
  dur: number,
  startVal: number,
  endVal: number,
): void {
  score.push(
    `i${instrumentId}\t${formatBlueNumber(startTime)}\t${formatBlueNumber(dur)}\t${formatBlueNumber(startVal)}\t${formatBlueNumber(endVal)}\n`,
  );
}

/**
 * The initialization statement Java CSDRender.handleParameters emits for one
 * automated parameter: `${varName} init ${NumberUtilities.formatDouble(value)}\n`
 * where the value is the line evaluator's result at the render start (or the
 * fixed value when automation is disabled).
 */
export function buildParameterInitStatementJava(
  parameter: Parameter,
  renderStartTime: number,
): { text: string; initialVal: number } {
  const initialVal = parameter.isAutomationEnabled()
    ? parameter.getValue(renderStartTime)
    : parameter.getFixedValue();
  const varName = parameter.getCompilationVarName() ?? '';
  return { text: `${varName} init ${formatBlueNumber(initialVal)}\n`, initialVal };
}

/**
 * Java CSDRender.getParameterInstrument: the parameter helper instrument
 * text. Positive resolution steps with `init p4 / turnoff`; otherwise a
 * line-segment instrument.
 */
export function getParameterInstrumentTextJava(
  compilationVarName: string,
  resolution: number,
): string {
  if (resolution > 0.0) {
    return `${compilationVarName} init p4\nturnoff`;
  }
  return (
    `if (p4 == p5) then\n` +
    `${compilationVarName} init p4\n` +
    `turnoff\n` +
    `else\n` +
    `${compilationVarName} line p4, p3, p5\n` +
    `endif`
  );
}
