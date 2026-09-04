import { TempoMap } from '../time/tempo-map';
import { CurveType } from '../time/curve-type';
import { formatJavaDouble } from './number-format';
import { replaceAll } from './text';

export function processCommandBlocks(input: string): string {
  const lines = input.split('\n');
  const buffer: string[] = [];
  const preBuffer: string[] = [];
  const onceList = new Set<string>();

  let mode: 'search' | 'command' = 'search';
  let command = '';
  let commandArgument: string[] = [];

  for (const line of lines) {
    const trimLine = line.trim();

    if (mode === 'search') {
      if (trimLine.startsWith(';[') && trimLine.endsWith(']{')) {
        command = trimLine.substring(2, trimLine.indexOf(']{'));
        mode = 'command';
        commandArgument = [];
      } else {
        buffer.push(line);
      }
      continue;
    }

    if (trimLine.startsWith(';}')) {
      mode = 'search';
      const commandString = commandArgument.join('\n');
      if (command === 'pre') {
        preBuffer.push(commandString);
      } else if (command === 'once' && !onceList.has(commandString)) {
        onceList.add(commandString);
        buffer.push(commandString);
      }
      continue;
    }

    commandArgument.push(line);
  }

  const output = [...preBuffer, ...buffer].join('\n');
  return output.length > 0 ? `${output}\n` : output;
}

export function preprocessSco(
  input: string,
  totalDur: number,
  renderStartTime: number,
  processingStart: number,
  tempoMapper: TempoMap | null,
): string {
  let temp = replaceAll(input, '<TOTAL_DUR>', formatJavaDouble(totalDur));
  temp = replaceAll(temp, '<PROCESSING_START>', formatJavaDouble(processingStart));
  temp = replaceAll(temp, '<RENDER_START>', formatJavaDouble(renderStartTime));

  if (tempoMapper) {
    temp = replaceAll(
      temp,
      '<RENDER_START_ABSOLUTE>',
      formatJavaDouble(tempoMapper.beatsToSeconds(renderStartTime)),
    );
  } else {
    temp = replaceAll(temp, '<RENDER_START_ABSOLUTE>', formatJavaDouble(renderStartTime));
  }

  return temp;
}

export function getTempoScore(tempoMap: TempoMap, renderStart: number, renderEnd: number): string {
  if (tempoMap.size() === 1) {
    return `t 0 ${formatJavaDouble(tempoMap.getTempo(0))}`;
  }

  if (renderStart > tempoMap.getBeat(tempoMap.size() - 1)) {
    return `t 0 ${formatJavaDouble(tempoMap.getTempo(tempoMap.size() - 1))}`;
  }

  const buffer: string[] = [];
  buffer.push(`t 0 ${formatJavaDouble(tempoMap.getTempoAt(renderStart))}`);

  for (let i = 0; i < tempoMap.size(); i++) {
    const pointBeat = tempoMap.getBeat(i);
    if (pointBeat > renderStart) {
      if (renderEnd < 0 || pointBeat < renderEnd) {
        appendTempoPoint(buffer, tempoMap, i, renderStart);
      } else {
        break;
      }
    }
  }

  if (renderEnd > 0) {
    buffer.push(formatJavaDouble(renderEnd - renderStart));
    buffer.push(formatJavaDouble(getTempoAtSegmentEnd(tempoMap, renderEnd)));
  }

  return `${buffer.join(' ')}\n`;
}

export function getTempoMapFromScoreText(globalSco: string): TempoMap | null {
  const lines = globalSco.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('t')) {
      continue;
    }

    const mapper = TempoMap.createTempoMap(line.substring(1).trim());
    if (mapper) {
      return mapper;
    }
  }

  return null;
}

function appendTempoPoint(
  buffer: string[],
  tempoMap: TempoMap,
  pointIndex: number,
  renderStart: number,
): void {
  const pointBeat = tempoMap.getBeat(pointIndex);
  const relativeBeat = pointBeat - renderStart;

  if (pointIndex > 0 && tempoMap.getCurveType(pointIndex - 1) === CurveType.CONSTANT) {
    const previousTempo = tempoMap.getTempo(pointIndex - 1);
    const currentTempo = tempoMap.getTempo(pointIndex);
    if (previousTempo !== currentTempo) {
      buffer.push(formatJavaDouble(relativeBeat));
      buffer.push(formatJavaDouble(previousTempo));
    }
  }

  buffer.push(formatJavaDouble(relativeBeat));
  buffer.push(formatJavaDouble(tempoMap.getTempo(pointIndex)));
}

function getTempoAtSegmentEnd(tempoMap: TempoMap, beat: number): number {
  for (let i = 1; i < tempoMap.size(); i++) {
    if (tempoMap.getBeat(i) === beat && tempoMap.getCurveType(i - 1) === CurveType.CONSTANT) {
      return tempoMap.getTempo(i - 1);
    }
  }

  return tempoMap.getTempoAt(beat);
}
