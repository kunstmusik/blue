// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MidiImportStreamTable from '../components/workbench/panels/MidiImportStreamTable';
import type { MidiImportPreview, MidiImportSettings } from '../../shared/midi-import';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MidiImportStreamTable typography', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('uses Body for table values and bold Headline for column headings', () => {
    const preview: MidiImportPreview = {
      fileName: 'input.mid',
      format: 1,
      ticksPerBeat: 480,
      streams: [{
        streamKey: 'track-0',
        trackIndex: 0,
        trackName: 'Piano',
        channel: 0,
        noteCount: 8,
        firstBeat: 0,
        lastBeat: 4,
        warnings: [],
        defaults: {
          streamKey: 'track-0',
          instrumentId: '1',
          noteTemplate: 'i1 ${start} ${duration} ${pitch} ${velocity}',
          trimTime: false,
        },
      }],
    };
    const rows: MidiImportSettings[] = [preview.streams[0]!.defaults];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(<MidiImportStreamTable preview={preview} rows={rows} onUpdate={vi.fn()} />);
    });

    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.classList).toContain('text-role-body');
    expect(table.querySelector('thead')?.classList).toContain('text-role-headline');
    expect(table.querySelector('thead')?.classList).toContain('font-bold');
  });
});
