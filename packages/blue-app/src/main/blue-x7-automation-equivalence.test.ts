import { describe, expect, it, vi } from 'vitest';
import { appendParameterScoreJava, buildParameterInitStatementJava, Parameter } from '@blue/data';
import { EngineBridge } from './engine-bridge';

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox: vi.fn() },
}));

function parseDiskTransitions(score: string): Array<{ time: number; value: number }> {
  return [...score.matchAll(/i\d+\s+([\d.-]+)\s+\.0001\s+([\d.-]+)/g)].map((match) => ({
    time: Number(match[1]),
    value: Number(match[2]),
  }));
}

describe('BlueX7 realtime/disk automation equivalence', () => {
  it('matches nonzero-start integer transitions within one k-period plus 50 ms', async () => {
    const parameter = new Parameter();
    parameter.setName('common.algorithm');
    parameter.setCompilationVarName('gk_blue_auto0');
    parameter.setMinimum(1, true);
    parameter.setMaximum(32, true);
    parameter.setResolutionText('1');
    parameter.setAutomationEnabled(true);
    parameter.setPoints([
      { time: 0, value: 1 },
      { time: 8, value: 9 },
    ]);

    const updateAutomation = vi.fn(async () => ({ ok: true, message: 'OK' }));
    const client = {
      updateAutomation,
      createAutomation: vi.fn(async () => ({ ok: true, message: 'OK' })),
      deleteAutomation: vi.fn(async () => ({ ok: true, message: 'OK' })),
      setChannel: vi.fn(async () => ({ ok: true, message: 'OK' })),
      createChannel: vi.fn(async () => ({ ok: true, message: 'OK' })),
    };
    const bridge = new EngineBridge({ webContents: { send: vi.fn() } } as never);
    (bridge as unknown as { activeSession: { getClient: () => typeof client } }).activeSession = {
      getClient: () => client,
    };

    const renderStart = 4;
    await bridge.syncAutomationParameter(
      parameter,
      {
        renderStartTime: renderStart,
        sampleRate: 44100,
        ksmps: 64,
      },
      { coalesce: false },
    );

    const realtimePoints = (updateAutomation.mock.calls as unknown[][])[0]![4] as Array<{
      time: number;
      value: number;
    }>;
    expect(realtimePoints).toEqual([
      { time: 0, value: 5 },
      { time: 4, value: 9 },
    ]);
    expect(buildParameterInitStatementJava(parameter, renderStart).initialVal).toBe(5);

    const diskTransitions = parseDiskTransitions(
      appendParameterScoreJava({
        parameter,
        instrumentId: 99,
        renderStart,
        renderEnd: -1,
      }),
    );
    expect(diskTransitions.map((event) => event.value)).toEqual([6, 7, 8, 9]);

    const kPeriod = 64 / 44100;
    const tolerance = kPeriod + 0.05;
    const observed: Array<{ time: number; value: number }> = [];
    let previous = realtimePoints[0]!.value;
    for (let elapsed = 0; elapsed <= 4 + kPeriod; elapsed += kPeriod) {
      const interpolated = 5 + elapsed;
      const value = Math.min(9, Math.floor(interpolated));
      if (value !== previous) {
        observed.push({ time: elapsed, value });
        previous = value;
      }
    }

    expect(observed).toHaveLength(diskTransitions.length);
    for (let index = 0; index < diskTransitions.length; index += 1) {
      expect(observed[index]!.value).toBe(diskTransitions[index]!.value);
      expect(Math.abs(observed[index]!.time - diskTransitions[index]!.time)).toBeLessThanOrEqual(
        tolerance,
      );
    }
  });
});
