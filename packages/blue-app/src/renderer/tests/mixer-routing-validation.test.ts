import { describe, it, expect } from 'vitest';
import type { MixerSnapshot, MixerChannelSnapshot } from '../../shared/project-editor';
import {
  validateMixerRouting,
  validateSendTarget,
  validateOutputTarget,
  getValidOutputTargets,
  getValidSendTargets,
} from '../../shared/mixer-routing-validation';

function makeChannel(
  overrides: Partial<MixerChannelSnapshot> & { id: string },
): MixerChannelSnapshot {
  return {
    name: overrides.id,
    channelKind: 'instrument',
    outChannel: 'Master',
    muted: false,
    solo: false,
    level: 0,
    volume: 1,
    pan: 0.5,
    preChain: [],
    postChain: [],
    ...overrides,
  };
}

function makeSendEntry(sendChannel: string, overrides?: { entryId?: string; enabled?: boolean }) {
  return {
    entryId: overrides?.entryId ?? 'send-1',
    kind: 'send' as const,
    sendChannel,
    level: 0,
    enabled: overrides?.enabled ?? true,
  };
}

function makeMixerSnapshot(overrides?: Partial<MixerSnapshot>): MixerSnapshot {
  return {
    enabled: true,
    extraRenderTime: 0.0,
    channelListGroups: [],
    channels: [],
    subChannels: [],
    master: makeChannel({
      id: 'master',
      name: 'Master',
      channelKind: 'master',
      outChannel: '',
    }),
    ...overrides,
  };
}

describe('validateMixerRouting', () => {
  it('returns no issues for a clean mixer with valid routing', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    const result = validateMixerRouting(mixer);
    expect(result.issues).toHaveLength(0);
  });

  it('catches self-send as an error with code self-send', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({
          id: 'ch1',
          name: 'Lead',
          outChannel: 'Master',
          preChain: [makeSendEntry('Lead')],
        }),
      ],
    });
    const result = validateMixerRouting(mixer);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'self-send',
          channelId: 'ch1',
        }),
      ]),
    );
  });

  it('catches self-output as an error with code self-output', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Lead' })],
    });
    const result = validateMixerRouting(mixer);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'self-output',
          channelId: 'ch1',
        }),
      ]),
    );
  });

  it('catches missing send target as missing-target', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({
          id: 'ch1',
          name: 'Lead',
          outChannel: 'Master',
          preChain: [makeSendEntry('nonexistent')],
        }),
      ],
    });
    const result = validateMixerRouting(mixer);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'missing-target',
          channelId: 'ch1',
        }),
      ]),
    );
  });

  it('catches missing output target as missing-target', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'nonexistent' })],
    });
    const result = validateMixerRouting(mixer);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'missing-target',
          channelId: 'ch1',
        }),
      ]),
    );
  });

  it('detects feedback loop when channel A sends to B and B sends to A', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({
          id: 'subA',
          name: 'SubA',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('SubB')],
        }),
        makeChannel({
          id: 'subB',
          name: 'SubB',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('SubA')],
        }),
      ],
    });
    const result = validateMixerRouting(mixer);
    const feedbackWarnings = result.issues.filter((i) => i.code === 'feedback-risk');
    expect(feedbackWarnings.length).toBeGreaterThanOrEqual(1);
    expect(feedbackWarnings[0]).toEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'feedback-risk',
      }),
    );
  });

  it('includes grouped source channels when resolving send targets', () => {
    const mixer = makeMixerSnapshot({
      channelListGroups: [
        {
          association: 'audio-group-1',
          listName: 'Audio Layer Group',
          listNameEditSupported: true,
          channels: [
            makeChannel({
              id: 'audio-1',
              name: 'Audio Layer 1',
              channelKind: 'instrument',
              association: 'layer-1',
            }),
          ],
        },
      ],
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Sub1',
          channelKind: 'subChannel',
          outChannel: 'Master',
        }),
      ],
    });
    const issue = validateSendTarget(mixer, 'sub1', 'Audio Layer 1');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'invalid-paste-target',
      }),
    );
  });
});

describe('validateSendTarget', () => {
  it('returns null for valid targets', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    expect(validateSendTarget(mixer, 'ch1', 'Master')).toBeNull();
  });

  it('returns self-send error when source equals target', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    const issue = validateSendTarget(mixer, 'ch1', 'Lead');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'self-send',
        channelId: 'ch1',
      }),
    );
  });

  it('returns missing-target error for nonexistent target', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    const issue = validateSendTarget(mixer, 'ch1', 'nonexistent');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'missing-target',
        channelId: 'ch1',
      }),
    );
  });
});

describe('validateOutputTarget', () => {
  it('returns null for a valid output target', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    expect(validateOutputTarget(mixer, 'ch1', 'Master')).toBeNull();
  });

  it('returns self-output error when channel outputs to itself', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Lead' })],
    });
    const issue = validateOutputTarget(mixer, 'ch1', 'Lead');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'self-output',
        channelId: 'ch1',
      }),
    );
  });

  it('returns missing-target error for nonexistent output target', () => {
    const mixer = makeMixerSnapshot({
      channels: [makeChannel({ id: 'ch1', name: 'Lead', outChannel: 'Master' })],
    });
    const issue = validateOutputTarget(mixer, 'ch1', 'nonexistent');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'missing-target',
        channelId: 'ch1',
      }),
    );
  });
});

describe('getValidOutputTargets', () => {
  it('excludes the channel itself and instrument channels', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({ id: 'ch1', name: 'Lead', channelKind: 'instrument', outChannel: 'Master' }),
      ],
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Reverb',
          channelKind: 'subChannel',
          outChannel: 'Master',
        }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'sub1');
    const targetIds = targets.map((t) => t.id);
    expect(targetIds).not.toContain('sub1');
    expect(targetIds).not.toContain('ch1');
    expect(targetIds).toContain('master');
  });

  it('excludes subchannel whose output chain leads back to source', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({ id: 'sub1', name: 'Sub1', channelKind: 'subChannel', outChannel: 'Sub2' }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'sub2');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub1');
  });

  it('excludes subchannel whose send chain leads back to source', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Sub1',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('Sub2')],
        }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'sub2');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub1');
  });

  it('excludes subchannel in multi-hop cycle via output chain', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({ id: 'sub1', name: 'Sub1', channelKind: 'subChannel', outChannel: 'Sub2' }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Sub3' }),
        makeChannel({ id: 'sub3', name: 'Sub3', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'sub3');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub1');
    expect(targetNames).not.toContain('Sub2');
  });

  it('includes subchannel that routes to Master with no cycle', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({ id: 'sub1', name: 'Sub1', channelKind: 'subChannel', outChannel: 'Master' }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'sub1');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).toContain('Sub2');
  });
});

describe('getValidSendTargets', () => {
  it('excludes the source channel and instrument channels; includes master and subchannels only', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({ id: 'ch1', name: 'Lead', channelKind: 'instrument', outChannel: 'Master' }),
        makeChannel({ id: 'ch2', name: 'Bass', channelKind: 'instrument', outChannel: 'Master' }),
      ],
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Reverb',
          channelKind: 'subChannel',
          outChannel: 'Master',
        }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'ch1');
    const targetIds = targets.map((t) => t.id);
    expect(targetIds).not.toContain('ch1');
    expect(targetIds).not.toContain('ch2');
    expect(targetIds).toContain('master');
    expect(targetIds).toContain('sub1');
  });

  it('excludes instrument channels from subchannel send targets', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({ id: 'ch1', name: 'Lead', channelKind: 'instrument', outChannel: 'Master' }),
      ],
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Reverb',
          channelKind: 'subChannel',
          outChannel: 'Master',
        }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'sub1');
    const targetIds = targets.map((t) => t.id);
    expect(targetIds).not.toContain('ch1');
    expect(targetIds).not.toContain('sub1');
    expect(targetIds).toContain('master');
  });

  it('excludes subchannel whose output chain leads back to source', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({ id: 'sub1', name: 'Sub1', channelKind: 'subChannel', outChannel: 'Sub2' }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'sub2');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub1');
  });

  it('excludes subchannel whose send chain leads back to source', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Sub1',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('Sub2')],
        }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'sub2');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub1');
  });
});

describe('validateSendTarget instrument rejection', () => {
  it('returns error when sending to an instrument channel', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({ id: 'ch1', name: 'Lead', channelKind: 'instrument', outChannel: 'Master' }),
        makeChannel({ id: 'ch2', name: 'Bass', channelKind: 'instrument', outChannel: 'Master' }),
      ],
    });
    const issue = validateSendTarget(mixer, 'ch1', 'Bass');
    expect(issue).toEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'invalid-paste-target',
        channelId: 'ch1',
        targetName: 'Bass',
        message: 'Cannot send to an instrument channel',
      }),
    );
  });
});

describe('getValidSendTargets after subchannel removal scenario', () => {
  it('includes previously-blocked subchannel after routing target is removed', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({ id: 'sub1', name: 'Sub1', channelKind: 'subChannel', outChannel: 'Master' }),
        makeChannel({ id: 'sub2', name: 'Sub2', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'sub2');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Sub1');
  });

  it('excludes subchannel that sends to self via removed channel', () => {
    const mixer = makeMixerSnapshot({
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Sub1',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('Sub2')],
        }),
        makeChannel({
          id: 'sub2',
          name: 'Sub2',
          channelKind: 'subChannel',
          outChannel: 'Master',
          postChain: [makeSendEntry('Sub1')],
        }),
      ],
    });
    const targets = getValidSendTargets(mixer, 'sub1');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).not.toContain('Sub2');
  });
});

describe('getValidOutputTargets for instrument channels', () => {
  it('includes Master and all subchannels but not other instrument channels', () => {
    const mixer = makeMixerSnapshot({
      channels: [
        makeChannel({ id: 'ch1', name: 'Lead', channelKind: 'instrument', outChannel: 'Master' }),
        makeChannel({ id: 'ch2', name: 'Bass', channelKind: 'instrument', outChannel: 'Master' }),
      ],
      subChannels: [
        makeChannel({
          id: 'sub1',
          name: 'Reverb',
          channelKind: 'subChannel',
          outChannel: 'Master',
        }),
        makeChannel({ id: 'sub2', name: 'Delay', channelKind: 'subChannel', outChannel: 'Master' }),
      ],
    });
    const targets = getValidOutputTargets(mixer, 'ch1');
    const targetNames = targets.map((t) => t.name);
    expect(targetNames).toContain('Master');
    expect(targetNames).toContain('Reverb');
    expect(targetNames).toContain('Delay');
    expect(targetNames).not.toContain('Lead');
    expect(targetNames).not.toContain('Bass');
  });
});
