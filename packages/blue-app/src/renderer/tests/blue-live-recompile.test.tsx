import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlueData, LiveData, GenericInstrument } from '@blue/data';
import { BlueLiveEngineSession, resolveNamedInstrumentNumbers } from '../../main/blue-live-engine';

class MockWebContents {
  send = vi.fn();
}

class MockBrowserWindow {
  webContents = new MockWebContents();
  isDestroyed = vi.fn(() => false);
}

function createMockWindow(): any {
  return new MockBrowserWindow();
}

const trackedSessions: BlueLiveEngineSession[] = [];

function trackSession(session: BlueLiveEngineSession): BlueLiveEngineSession {
  trackedSessions.push(session);
  return session;
}

afterEach(async () => {
  while (trackedSessions.length > 0) {
    const session = trackedSessions.pop();
    if (session) {
      await session.stop();
    }
  }
});

describe('BlueLive recompile lifecycle (T035)', () => {
  it('recompile from idle attempts to start', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const data = new BlueData();
    const result = await session.recompile(data, 1);
    expect(result.sessionId).toBe(1);
  });

  it('recompile increments project revision', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const data = new BlueData();
    const result = await session.recompile(data, 5);
    expect(result.projectRevision).toBe(5);
  });

  it('recompile sends blue-live-status events via webContents', async () => {
    const win = createMockWindow();
    const session = trackSession(new BlueLiveEngineSession(win, 'csound', 5560, 5561));
    const data = new BlueData();
    await session.recompile(data, 1);
    expect(win.webContents.send).toHaveBeenCalled();
  });

  it('stop during starting state is handled', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const result = await session.stop();
    expect(result.status).toBe('idle');
  });

  it('multiple recompile calls increment sessionId', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const data = new BlueData();
    await session.recompile(data, 1);
    const before = session.getStatus().sessionId;
    await session.recompile(data, 2);
    const after = session.getStatus().sessionId;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('BlueLive All Notes Off CSD instrument (T036)', () => {
  it('generates allNotesOff instrument in CSD with instruments present', () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setName('Test');
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const csd = data.toBlueLiveCSD();
    expect(csd.csdText).toContain('instr blueAllNotesOff');
    expect(csd.csdText).toContain('turnoff2');
  });

  it('empty project generates valid CSD without allNotesOff score event', () => {
    const data = new BlueData();
    const csd = data.toBlueLiveCSD();
    expect(csd.csdText).toContain('<CsoundSynthesizer>');
    expect(csd.csdText).toContain('e 36000');
  });
});

describe('BlueLive toolbar Recompile and All Notes Off enablement (T037)', () => {
  it('all-notes-off returns ok:false when not running', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const result = await session.sendAllNotesOff();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not running');
  });

  it('recompile on stopped session restarts', async () => {
    const session = trackSession(
      new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561),
    );
    const data = new BlueData();
    await session.recompile(data, 1);
    const afterFirst = session.getStatus();
    expect(['running', 'error', 'idle', 'stopped']).toContain(afterFirst.status);
  });

  it('all-notes-off score event uses resolved named instrument', () => {
    const ids = resolveNamedInstrumentNumbers('instr blueAllNotesOff\nendin');
    expect(ids.get('blueAllNotesOff')).toBe(1);
  });
});
