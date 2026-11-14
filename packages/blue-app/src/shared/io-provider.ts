export type OutputType = 'output' | 'error';

export interface OutputLine {
  id: number;
  text: string;
  type: 'stdout' | 'stderr';
}

export interface OutputTab {
  id: string;
  name: string;
  lines: OutputLine[];
  lineCounter: number;
  colorOverrides: Partial<Record<OutputType, string>>;
  isClosed: boolean;
  pendingText: string;
  pendingType: 'stdout' | 'stderr' | null;
}

export interface OutputWriter {
  write(text: string): void;
  println(text: string): void;
  reset(): void;
}

export interface InputOutput {
  readonly name: string;
  readonly out: OutputWriter;
  readonly err: OutputWriter;
  select(): void;
  close(): void;
  setColor(type: OutputType, color: string): void;
}

export interface IOProvider {
  getIO(name: string, newIO?: boolean): InputOutput;
}

export interface EngineOutputChunk {
  text: string;
  type: 'stdout' | 'stderr';
}

export interface EngineOutputPayload {
  tabName: string;
  text: string;
  type: 'stdout' | 'stderr';
  /** Coalesced ordered runs when a batch mixes stdout and stderr chunks. */
  chunks?: readonly EngineOutputChunk[];
}

/**
 * Coalesces adjacent same-type output chunks into a single IPC payload per flush.
 */
export function buildBatchedEngineOutputPayload(
  tabName: string,
  batch: readonly EngineOutputChunk[],
): EngineOutputPayload | null {
  if (batch.length === 0) return null;
  const merged: EngineOutputChunk[] = [];
  let currentType = batch[0]!.type;
  const currentTexts: string[] = [batch[0]!.text];
  for (let i = 1; i < batch.length; i += 1) {
    const item = batch[i]!;
    if (item.type === currentType) {
      currentTexts.push(item.text);
    } else {
      merged.push({ text: currentTexts.join(''), type: currentType });
      currentType = item.type;
      currentTexts.length = 0;
      currentTexts.push(item.text);
    }
  }
  merged.push({ text: currentTexts.join(''), type: currentType });
  if (merged.length === 1) {
    return {
      tabName,
      text: merged[0]!.text,
      type: merged[0]!.type,
    };
  }
  return {
    tabName,
    text: merged[0]!.text,
    type: merged[0]!.type,
    chunks: merged,
  };
}
