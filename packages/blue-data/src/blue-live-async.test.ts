import { describe, expect, it, vi } from 'vitest';
import { BlueData } from './blue-data';
import { PythonInstrument } from './instruments/python-instrument';
import { GenericInstrument } from './instruments/generic-instrument';
import { TrackLayerGroup } from './score/track/track-layer-group';
import type { JavaRuntimeClientContract } from './java-runtime';

describe('Blue Live asynchronous orchestra generation', () => {
  it('compiles Python arrangement and Track instruments with the supplied runtime', async () => {
    const data = new BlueData();
    data.getMixer().setPanningEnabled(false);
    const instrument = new PythonInstrument();
    instrument.setText('instrument = "outs 0, 0"');
    data.getArrangement().addInstrument(instrument, '1');
    const tracks = new TrackLayerGroup();
    tracks.newLayerAt(0).setInstrument(instrument.deepCopy());
    data.getScore().push(tracks);
    const source = data.saveToString();
    const evaluateJythonInstrument = vi.fn(async () => ({
      ok: true,
      result: { instrumentText: 'outs 0, 0' },
    }));
    const runtime = { evaluateJythonInstrument } as unknown as JavaRuntimeClientContract;
    const result = await data.toBlueLiveCSDAsync(undefined, runtime);
    expect(evaluateJythonInstrument).toHaveBeenCalledTimes(2);
    expect(result.csdText.match(/outs 0, 0/g)).toHaveLength(2);
    expect(data.saveToString()).toBe(source);
    expect(() => data.toBlueLiveCSD()).toThrow(/asynchronous compilation/);
    await expect(data.toBlueLiveCSDAsync()).rejects.toThrow(/Java runtime session/);
  });

  it('keeps synchronous output for ordinary instruments and propagates runtime errors', async () => {
    const data = new BlueData();
    const instrument = new GenericInstrument();
    instrument.setText('outs 0, 0');
    data.getArrangement().addInstrument(instrument, '1');
    expect((await data.toBlueLiveCSDAsync()).csdText).toBe(data.toBlueLiveCSD().csdText);
    data.getArrangement().addInstrument(new PythonInstrument(), '2');
    const runtime = {
      evaluateJythonInstrument: async () => ({
        ok: false,
        error: { message: 'synthetic failure' },
      }),
    } as unknown as JavaRuntimeClientContract;
    await expect(data.toBlueLiveCSDAsync(undefined, runtime)).rejects.toThrow('synthetic failure');
  });
});
