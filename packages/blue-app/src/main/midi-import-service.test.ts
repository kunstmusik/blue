import { describe, expect, it, vi } from 'vitest';
import type { MidiImportDocument } from '@blue/data';
import type { MidiImportPreview } from '../shared/midi-import';
import { MidiImportService } from './midi-import-service';

const document: MidiImportDocument = {
  format: 0,
  division: { kind: 'ppq', ticksPerBeat: 480 },
  tracks: [{
    trackIndex: 0,
    tempoChanges: [],
    lastTick: 480,
    streams: [{
      streamKey: '0:0',
      trackIndex: 0,
      channel: 0,
      noteCount: 1,
      firstTick: 0,
      lastTick: 480,
      warnings: [],
      events: [
        { absoluteTick: 0, type: 'noteOn', noteNumber: 60, velocity: 100 },
        { absoluteTick: 480, type: 'noteOff', noteNumber: 60, velocity: 0 },
      ],
    }],
  }],
  tempoChanges: [],
};

const preview: MidiImportPreview = {
  fileName: 'test.mid',
  format: 0,
  ticksPerBeat: 480,
  streams: [{
    streamKey: '0:0',
    trackIndex: 0,
    channel: 0,
    noteCount: 1,
    firstBeat: 0,
    lastBeat: 1,
    warnings: [],
    defaults: {
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: 'i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>',
      trimTime: false,
    },
  }],
};

function createService(sessionId = 4): MidiImportService {
  return new MidiImportService({
    chooseFile: vi.fn(async () => '/tmp/test.mid'),
    readFile: vi.fn(() => new Uint8Array([1, 2, 3])),
    parseFile: vi.fn(() => ({ document, preview })),
    getProjectSessionId: () => sessionId,
  });
}

describe('MidiImportService', () => {
  it('returns cancellation without reading or parsing when no file is selected', async () => {
    const chooseFile = vi.fn(async () => null);
    const readFile = vi.fn(() => new Uint8Array());
    const service = new MidiImportService({
      chooseFile,
      readFile,
      parseFile: vi.fn(),
      getProjectSessionId: () => 1,
    });

    await expect(service.start()).resolves.toEqual({ status: 'cancelled' });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('stores a ready preview and validates the matching settings', async () => {
    const service = createService();
    const started = await service.start();
    expect(started.status).toBe('ready');
    if (started.status !== 'ready') return;

    const validated = service.validateCommit(started.token, [preview.streams[0].defaults]);
    expect(validated.ok).toBe(true);
  });

  it('080: retains the pending mapping session across start and commit within one project session', async () => {
    const service = createService();
    const started = await service.start();
    if (started.status !== 'ready') throw new Error('expected ready result');

    // The pending session survives between the mapping dialog and the
    // replacement commit; a cancelled replacement decision must not clear it.
    const validated = service.validateCommit(started.token, [preview.streams[0].defaults]);
    expect(validated.ok).toBe(true);

    const revalidated = service.validateCommit(started.token, [preview.streams[0].defaults]);
    expect(revalidated.ok).toBe(true);
  });

  it('080: replaces the pending session when a new MIDI file is selected', async () => {
    const service = createService();
    const first = await service.start();
    if (first.status !== 'ready') throw new Error('expected ready result');

    const second = await service.start();
    if (second.status !== 'ready') throw new Error('expected ready result');

    expect(second.token).not.toBe(first.token);
    expect(service.validateCommit(first.token, [preview.streams[0].defaults]).ok).toBe(false);
    expect(service.validateCommit(second.token, [preview.streams[0].defaults]).ok).toBe(true);
  });

  it('080: clears only the matching pending session on cancel', async () => {
    const service = createService();
    const started = await service.start();
    if (started.status !== 'ready') throw new Error('expected ready result');

    service.clear('not-the-token');
    expect(service.validateCommit(started.token, [preview.streams[0].defaults]).ok).toBe(true);

    service.clear(started.token);
    expect(service.validateCommit(started.token, [preview.streams[0].defaults]).ok).toBe(false);
  });

  it('rejects stale, malformed, and expired commits', async () => {
    const service = createService();
    const started = await service.start();
    if (started.status !== 'ready') throw new Error('expected ready result');

    expect(service.validateCommit('stale-token', [])).toMatchObject({ ok: false });
    expect(service.validateCommit(started.token, [])).toMatchObject({ ok: false });
    service.clear(started.token);
    expect(service.validateCommit(started.token, [preview.streams[0].defaults])).toMatchObject({ ok: false });
  });

  it('rejects a commit after the project session changes', async () => {
    let sessionId = 1;
    const service = new MidiImportService({
      chooseFile: async () => '/tmp/test.mid',
      readFile: () => new Uint8Array([1]),
      parseFile: () => ({ document, preview }),
      getProjectSessionId: () => sessionId,
    });
    const started = await service.start();
    if (started.status !== 'ready') throw new Error('expected ready result');

    sessionId = 2;
    expect(service.validateCommit(started.token, [preview.streams[0].defaults])).toMatchObject({
      ok: false,
      message: 'The project changed while the MIDI file was being configured.',
    });
  });

  it('converts parser failures into an error result', async () => {
    const service = new MidiImportService({
      chooseFile: async () => '/tmp/broken.mid',
      readFile: () => new Uint8Array([1]),
      parseFile: () => { throw new Error('Bad MIDI file'); },
      getProjectSessionId: () => 1,
    });

    await expect(service.start()).resolves.toEqual({ status: 'error', message: 'Bad MIDI file' });
  });
});
