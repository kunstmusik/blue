import { BlueData, GenericScore } from '@blue/data';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultBsbWidgetSnapshot,
  createProjectEditorSnapshot,
} from '../../shared/project-editor';
import { translateClipboardEntriesForPaste } from '../components/workbench/panels/score/layer-groups/score-clipboard-utils';
import { useBsbClipboardStore } from '../stores/bsb-clipboard-store';
import {
  useScoreSelectionStore,
  type ScoreObjectClipboardEntry,
} from '../stores/score-selection-store';

function createLiveClipboardEntry(): ScoreObjectClipboardEntry {
  const source = new GenericScore();
  source.setName('Live phrase');
  return {
    objectId: 'live-object-id',
    objectType: 'GenericScore',
    name: source.getName(),
    startBeats: 0,
    durationBeats: 1,
    backgroundColor: source.getBackgroundColor(),
    isContainer: false,
    layerIndex: 0,
    groupId: 'blue-live',
    serializedXml: source.saveAsXML().toXml(),
  };
}

beforeEach(() => {
  useScoreSelectionStore.getState().clearClipboard();
  useBsbClipboardStore.getState().clearClipboard();
});

describe('shared Score and Blue Live clipboard', () => {
  it('translates a Blue Live clipboard entry into a Score timeline paste', () => {
    const snapshot = createProjectEditorSnapshot(new BlueData(), null);
    const targetGroup = snapshot.score!.layerGroups.find(
      (group) => group.groupType === 'polyObject',
    )!;
    const source = createLiveClipboardEntry();

    const translated = translateClipboardEntriesForPaste({
      clipboard: [source],
      layerGroups: snapshot.score!.layerGroups,
      targetGroupId: targetGroup.groupId,
      targetLayerIndex: 0,
      targetXBeats: 8,
      snapBeatValue: (beats) => beats,
    });

    expect(translated).toEqual({
      ok: true,
      entries: [{
        source,
        object: expect.objectContaining({
          groupId: targetGroup.groupId,
          layerIndex: 0,
          startBeats: 8,
          objectType: 'GenericScore',
          serializedXml: source.serializedXml,
        }),
      }],
    });
  });

  it('keeps BSB widget and ScoreObject clipboard payloads isolated', () => {
    const widget = createDefaultBsbWidgetSnapshot('BSBKnob')!;
    useBsbClipboardStore.getState().setClipboard({
      widgets: [widget],
      originX: 10,
      originY: 20,
    });

    const scoreEntry = createLiveClipboardEntry();
    useScoreSelectionStore.getState().copySelected([scoreEntry]);
    expect(useBsbClipboardStore.getState().clipboard?.widgets[0]?.type).toBe('BSBKnob');

    useBsbClipboardStore.getState().clearClipboard();
    expect(useScoreSelectionStore.getState().clipboard).toEqual([scoreEntry]);
  });
});
