import { describe, expect, it } from 'vitest';
import {
  bsbInterfaceActionLabel,
  mixerPatchActionLabel,
  orchestraPatchActionLabel,
  type BsbActionLabelContext,
  type BsbInterfacePatch,
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
        patch: { stereoPanMode: 'stereoPan' },
      } satisfies MixerPatch),
    ).toBe('Set Channel Pan Mode');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { panWidth: 0.8 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Pan Width');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { dualPanLeft: 0.2 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Left Pan');
    expect(
      mixerPatchActionLabel({
        type: 'updateChannel',
        channelId: 'Master',
        patch: { dualPanRight: 0.9 },
      } satisfies MixerPatch),
    ).toBe('Set Channel Right Pan');
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

  it('labels duplicate, copy, and paste intents consumed by the renderer queue choke point (T123)', () => {
    expect(
      mixerPatchActionLabel({
        type: 'duplicateChainEntry',
        channelId: 'c',
        chain: 'pre',
        entryId: 'e',
      } satisfies MixerPatch),
    ).toBe('Duplicate Mixer Chain Entry');
    expect(
      mixerPatchActionLabel({
        type: 'copyChainEntry',
        channelId: 'c',
        chain: 'pre',
        entryId: 'e',
      } satisfies MixerPatch),
    ).toBe('Copy Mixer Chain Entry');
    expect(
      mixerPatchActionLabel({
        type: 'pasteChainEntries',
        channelId: 'c',
        chain: 'pre',
        payload: { sourceKind: 'project', entries: [] },
      } satisfies MixerPatch),
    ).toBe('Paste Mixer Chain Entries');
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

  it('labels BSB interface edits by their action instead of a generic edit', () => {
    const bsbLabel = (patch: BsbInterfacePatch): string =>
      orchestraPatchActionLabel({
        type: 'updateInstrument',
        assignmentId: '1',
        patch: { bsbInterface: patch },
      });

    expect(bsbLabel({ type: 'applyPreset', presetUniqueId: 'p1' })).toBe('Apply Preset');
    expect(bsbLabel({ type: 'addPreset', presetName: 'My Groove' })).toBe('Add Preset My Groove');
    expect(bsbLabel({ type: 'updatePreset', presetUniqueId: 'p1' })).toBe('Update Preset');
    expect(bsbLabel({ type: 'synchronizePresets' })).toBe('Synchronize Presets');
    expect(
      bsbLabel({ type: 'updateWidgetProperties', widgetId: 'w1', properties: { value: 0.5 } }),
    ).toBe('Edit Blue Synth Builder Widget');
    expect(bsbLabel({ type: 'randomize' })).toBe('Randomize Blue Synth Builder Interface');
  });

  it('labels BSB interface edits directly with resolved display names', () => {
    const context: BsbActionLabelContext = {
      presetName: (id) => (id === 'p1' ? 'Ocarina' : undefined),
      widgetName: (id) => (id === 'w1' ? 'Vol' : undefined),
    };
    expect(bsbInterfaceActionLabel({ type: 'applyPreset', presetUniqueId: 'p1' }, context)).toBe(
      'Apply Preset Ocarina',
    );
    expect(
      bsbInterfaceActionLabel({ type: 'applyPreset', presetUniqueId: 'missing' }, context),
    ).toBe('Apply Preset');
    expect(
      bsbInterfaceActionLabel(
        { type: 'updateWidgetProperties', widgetId: 'w1', properties: { value: 0.5 } },
        context,
      ),
    ).toBe('Edit Blue Synth Builder Widget Vol');
    expect(
      bsbInterfaceActionLabel(
        { type: 'updateWidgetProperties', widgetId: 'missing', properties: { value: 0.5 } },
        context,
      ),
    ).toBe('Edit Blue Synth Builder Widget');
    expect(bsbInterfaceActionLabel({ type: 'removePreset', presetUniqueId: 'p1' }, context)).toBe(
      'Remove Preset Ocarina',
    );
  });
});
