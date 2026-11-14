import { BlueData, GenericScore } from '@blue/data';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultBsbWidgetSnapshot,
  createProjectEditorSnapshot,
} from '../../shared/project-editor';
import {
  clipboardNeedsXmlHydration,
  hydrateClipboardEntriesXml,
  translateClipboardEntriesForPaste,
} from '../components/workbench/panels/score/layer-groups/score-clipboard-utils';
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
      entries: [
        {
          source,
          object: expect.objectContaining({
            groupId: targetGroup.groupId,
            layerIndex: 0,
            startBeats: 8,
            objectType: 'GenericScore',
            serializedXml: source.serializedXml,
          }),
        },
      ],
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

  it('hydrates missing serializedXml on clipboard entries via readScoreObjectXml', async () => {
    const score = new GenericScore();
    score.setName('Lazy Score Object');
    const xml = score.saveAsXML().toXml();
    const entryWithoutXml: ScoreObjectClipboardEntry = {
      objectId: 'obj-lazy',
      objectType: 'GenericScore',
      name: 'Lazy Score Object',
      startBeats: 0,
      durationBeats: 4,
      backgroundColor: '#334455',
      isContainer: false,
      layerIndex: 0,
      groupId: 'group-1',
      editorTarget: {
        source: 'timeline',
        objectId: 'obj-lazy',
        rootGroupId: 'group-1',
        containerPath: [],
        layerId: 'layer-1',
        objectIdentity: 'obj-lazy',
        isInstance: false,
        instanceSourceId: null,
        isSoundObjectLibraryInstance: false,
        soundObjectLibraryId: null,
      },
    };
    const alreadyHydrated = createLiveClipboardEntry();
    const readScoreObjectXml = vi.fn().mockResolvedValue(xml);

    expect(clipboardNeedsXmlHydration([alreadyHydrated])).toBe(false);
    expect(clipboardNeedsXmlHydration([entryWithoutXml, alreadyHydrated])).toBe(true);

    const hydrated = await hydrateClipboardEntriesXml(
      [entryWithoutXml, alreadyHydrated],
      readScoreObjectXml,
    );
    expect(readScoreObjectXml).toHaveBeenCalledTimes(1);
    expect(readScoreObjectXml).toHaveBeenCalledWith(entryWithoutXml.editorTarget);
    expect(hydrated[0]?.serializedXml).toBe(xml);
    expect(hydrated[1]).toBe(alreadyHydrated);
  });
});
