import { describe, expect, it } from 'vitest';
import { blueX7PatchToRuntimeIntent } from './blue-x7-patch-intents';

describe('BlueX7 patch runtime intents', () => {
  it('routes a full operator mask through the atomic complete-voice path', () => {
    expect(
      blueX7PatchToRuntimeIntent({
        type: 'setCommonField',
        field: 'operatorEnabled',
        value: [false, true, false, true, false, true],
      }),
    ).toEqual({ kind: 'complete-voice' });
  });
});
