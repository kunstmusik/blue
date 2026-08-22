import { describe, expect, it } from 'vitest';
import { BlueData, LiveObject } from '@blue/data';
import {
  validateLegacyBlueLiveTriggerRequest,
  applyProjectDocumentPatch,
  type LegacyBlueLiveTriggerRequest,
  type LegacyBlueLiveTriggerResult,
} from '../../shared/project-editor';

function createProjectWithPopulatedCell(): BlueData {
  const data = new BlueData();
  const bins = data.getLiveData().getLiveObjectBins();
  const obj = new LiveObject();
  obj.setUniqueId('test-cell');
  obj.setEnabled(false);
  bins.setLiveObject(0, 0, obj);
  return data;
}

describe('Legacy Blue Live trigger request validation', () => {
  it('accepts a valid selected request', () => {
    const request: LegacyBlueLiveTriggerRequest = { mode: 'selected', liveObjectId: 'lo-01' };
    expect(validateLegacyBlueLiveTriggerRequest(request)).toBeNull();
  });

  it('accepts a valid enabled request', () => {
    const request: LegacyBlueLiveTriggerRequest = { mode: 'enabled' };
    expect(validateLegacyBlueLiveTriggerRequest(request)).toBeNull();
  });

  it('rejects a selected request with a blank liveObjectId', () => {
    const request = { mode: 'selected', liveObjectId: '   ' } as LegacyBlueLiveTriggerRequest;
    expect(validateLegacyBlueLiveTriggerRequest(request)).toBe('invalid-request');
  });

  it('rejects a selected request with a missing liveObjectId', () => {
    const request = { mode: 'selected' } as unknown as LegacyBlueLiveTriggerRequest;
    expect(validateLegacyBlueLiveTriggerRequest(request)).toBe('invalid-request');
  });

  it('rejects an unknown mode', () => {
    const request = { mode: 'unknown' } as unknown as LegacyBlueLiveTriggerRequest;
    expect(validateLegacyBlueLiveTriggerRequest(request)).toBe('invalid-request');
  });

  it('rejects a non-object request', () => {
    expect(validateLegacyBlueLiveTriggerRequest(null)).toBe('invalid-request');
    expect(validateLegacyBlueLiveTriggerRequest('enabled')).toBe('invalid-request');
    expect(validateLegacyBlueLiveTriggerRequest(42)).toBe('invalid-request');
  });
});

describe('Legacy Blue Live trigger result contract', () => {
  it('a submitted result is ok with the expected shape', () => {
    const result: LegacyBlueLiveTriggerResult = {
      ok: true,
      status: 'submitted',
      targetCount: 3,
      noteCount: 5,
      documentRevision: 1,
      blueLiveSessionId: 2,
    };
    expect(result.ok).toBe(true);
    expect(result.status).toBe('submitted');
    expect(result.targetCount).toBe(3);
    expect(result.noteCount).toBe(5);
  });

  it('an empty result is ok with zero targets', () => {
    const result: LegacyBlueLiveTriggerResult = {
      ok: true,
      status: 'empty',
      targetCount: 0,
      noteCount: 0,
      documentRevision: 1,
      blueLiveSessionId: 2,
    };
    expect(result.ok).toBe(true);
    expect(result.targetCount).toBe(0);
  });

  it('a busy result is not ok', () => {
    const result: LegacyBlueLiveTriggerResult = {
      ok: false,
      status: 'busy',
      targetCount: 0,
      noteCount: 0,
      documentRevision: 1,
      blueLiveSessionId: 2,
    };
    expect(result.ok).toBe(false);
    expect(result.status).toBe('busy');
  });

  it('a stale result carries an error code', () => {
    const result: LegacyBlueLiveTriggerResult = {
      ok: false,
      status: 'stale',
      code: 'stale-session',
      message: 'session changed',
      targetCount: 0,
      noteCount: 0,
      documentRevision: 1,
      blueLiveSessionId: 3,
    };
    expect(result.code).toBe('stale-session');
    expect(result.ok).toBe(false);
  });

  it('a failed result carries a generation/runtime error code', () => {
    const result: LegacyBlueLiveTriggerResult = {
      ok: false,
      status: 'failed',
      code: 'generation-failed',
      message: 'boom',
      targetCount: 1,
      noteCount: 0,
      documentRevision: 1,
      blueLiveSessionId: 2,
    };
    expect(result.code).toBe('generation-failed');
    expect(result.ok).toBe(false);
  });
});

describe('Legacy Blue Live trigger stable-ID snapshot contract', () => {
  it('the discriminated request type narrows on mode', () => {
    function handle(req: LegacyBlueLiveTriggerRequest): string {
      if (req.mode === 'selected') {
        return req.liveObjectId;
      }
      return 'all-enabled';
    }
    expect(handle({ mode: 'selected', liveObjectId: 'abc' })).toBe('abc');
    expect(handle({ mode: 'enabled' })).toBe('all-enabled');
  });
});

describe('Blue Live patch no-op semantics', () => {
  it('updateOptions with unchanged values reports no change', () => {
    const data = new BlueData();
    data.getLiveData().setCommandLine('-d -odac');
    data.getLiveData().setCommandLineEnabled(true);
    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'updateOptions', patch: { commandLine: '-d -odac', commandLineEnabled: true } },
    });
    expect(changed).toBe(false);
  });

  it('updateTempoRepeat with unchanged values reports no change', () => {
    const data = new BlueData();
    data.getLiveData().setTempo(120);
    data.getLiveData().setRepeat(4);
    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'updateTempoRepeat', patch: { tempo: 120, repeat: 4 } },
    });
    expect(changed).toBe(false);
  });

  it('updateLiveCodeText with unchanged text reports no change', () => {
    const data = new BlueData();
    data.getLiveData().setLiveCodeText('prints "hi"');
    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'updateLiveCodeText', text: 'prints "hi"' },
    });
    expect(changed).toBe(false);
  });

  it('setCellEnabled with the same value reports no change', () => {
    const data = createProjectWithPopulatedCell();
    const obj = data.getLiveData().getLiveObjectBins().getLiveObject(0, 0);
    obj!.setEnabled(true);
    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'setCellEnabled', column: 0, row: 0, enabled: true },
    });
    expect(changed).toBe(false);
  });

  it('removeRow at an invalid index reports no change', () => {
    const data = new BlueData();
    const before = data.getLiveData().getLiveObjectBins().getRowCount();
    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'removeRow', index: 999 },
    });
    expect(changed).toBe(false);
    expect(data.getLiveData().getLiveObjectBins().getRowCount()).toBe(before);
  });

  it('applySet that produces the same enabled mask reports no change', () => {
    const data = createProjectWithPopulatedCell();
    const bins = data.getLiveData().getLiveObjectBins();
    bins.getLiveObject(0, 0)!.setEnabled(true);
    // Capture a set that matches the current mask, then apply it — no change.
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    const changed = applyProjectDocumentPatch(data, { blueLive: { type: 'applySet', index: 0 } });
    expect(changed).toBe(false);
  });
});
