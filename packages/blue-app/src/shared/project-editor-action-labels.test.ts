import { describe, expect, it } from 'vitest';
import {
  mixerPatchActionLabel,
  orchestraPatchActionLabel,
  type MixerPatch,
  type OrchestraPatch,
} from './project-editor';

describe('mixer patch action labels (T023)', () => {
  it('labels scalar channel edits by their exact field', () => {
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { level: 0.5 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Level');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { volume: 0.8 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Volume');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { pan: -0.25 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Pan');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { muted: true },
      } satisfies MixerPatch),
    ).toBe('Mute Channel');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { solo: false },
      } satisfies MixerPatch),
    ).toBe('Unsolo Channel');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { level: 1, pan: 0 },
      } satisfies MixerPatch),
    ).toBe('Update Mixer Channel');
  });

  it('labels every structural mixer variant', () => {
    expect(mixerPatchActionLabel({ type: 'addSubChannel' } satisfies MixerPatch)).toBe(
      'Add Sub Channel',
    );
    expect(
      mixerPatchActionLabel({ type: 'removeSubChannel', channelId: 'c' } satisfies MixerPatch),
    ).toBe('Remove Sub Channel');
    expect(
      mixerPatchActionLabel({
        type: 'addEffectFromLibrary',
        channelId: 'c',
        chain: 'pre',
        libraryEffectId: 'e',
      } satisfies MixerPatch),
    ).toBe('Add Mixer Effect');
    expect(
      mixerPatchActionLabel({
        type: 'removeChainEntry',
        channelId: 'c',
        chain: 'pre',
        entryId: 'e',
      } satisfies MixerPatch),
    ).toBe('Remove Mixer Chain Entry');
    expect(
      mixerPatchActionLabel({ type: 'setMixerEnabled', value: false } satisfies MixerPatch),
    ).toBe('Disable Mixer');
  });
});

describe('orchestra patch action labels (T023)', () => {
  it('labels instrument lifecycle operations', () => {
    expect(orchestraPatchActionLabel({ type: 'addInstrument', instrumentType: 'generic' })).toBe(
      'Add Instrument',
    );
    expect(
      orchestraPatchActionLabel({
        type: 'removeAssignment',
        assignmentId: '1',
      } satisfies OrchestraPatch),
    ).toBe('Remove Instrument');
    expect(
      orchestraPatchActionLabel({
        type: 'replaceInstrument',
        assignmentId: '1',
        instrumentType: 'bsb',
      }),
    ).toBe('Replace Instrument');
  });

  it('labels instrument update variants by their semantic field', () => {
    expect(
      orchestraPatchActionLabel({
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { name: 'Renamed' },
      }),
    ).toBe('Rename Instrument');
    expect(
      orchestraPatchActionLabel({
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { enabled: false },
      }),
    ).toBe('Disable Instrument');
    expect(
      orchestraPatchActionLabel({
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { instrumentText: 'instr 1' },
      }),
    ).toBe('Edit Instrument');
    expect(
      orchestraPatchActionLabel({
        type: 'updateInstrumentComment',
        assignmentId: '1',
        comment: 'note',
      }),
    ).toBe('Edit Instrument Comment');
  });
});
