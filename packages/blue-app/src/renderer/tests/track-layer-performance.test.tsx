import { describe, expect, it } from 'vitest';
import {
  findTimelineHit,
  selectionIntersectsTimelineItem,
} from '../components/workbench/panels/score/layer-groups/score-timeline-gesture-utils';
import type { ScoreLayerSnapshot } from '../components/workbench/panels/score/types';

describe('Track timeline performance envelope', () => {
  it('hit-tests and selects a 1,000-item row with one linear item pass', () => {
    let startReads = 0;
    let durationReads = 0;
    const layer: ScoreLayerSnapshot = {
      layerId: 'performance-track',
      name: 'Performance Track',
      height: 22,
      muted: false,
      solo: false,
      items: Array.from({ length: 1000 }, (_, index) => {
        const item = {
          objectId: `item-${index}`,
          objectType: index % 2 === 0 ? 'GenericScore' : 'AudioClip',
          name: `Item ${index}`,
          startBeats: index,
          durationBeats: 1,
          startTimeBase: 'BEATS' as const,
          durationTimeBase: 'BEATS' as const,
          backgroundColor: 0,
          isContainer: false,
          editorTarget: {
            selectionId: `item-${index}`,
            selectedObjectType: index % 2 === 0 ? 'GenericScore' : 'AudioClip',
            editorObjectType: index % 2 === 0 ? 'GenericScore' : 'AudioClip',
            ownerKind: 'timeline' as const,
            displayContext: 'timeline' as const,
            supportsTimeBehavior: true,
            supportsRepeatPoint: false,
            supportsNoteProcessorChain: false,
          },
          barRenderer: {
            kind: 'generic' as const,
            labelLines: [`Item ${index}`],
            timeBehavior: 'NONE',
            repeatPointBeats: null,
          },
        };
        Object.defineProperties(item, {
          startBeats: { get: () => { startReads += 1; return index; } },
          durationBeats: { get: () => { durationReads += 1; return 1; } },
        });
        return item;
      }),
    };

    const hit = findTimelineHit([layer], 0.5, 10, 20, 22);
    expect(hit?.item.objectId).toBe('item-0');
    expect(hit?.itemIndex).toBe(0);
    expect(startReads).toBe(2000);
    expect(durationReads).toBe(1000);

    startReads = 0;
    durationReads = 0;
    const selected = layer.items.filter((item) => selectionIntersectsTimelineItem(
      item,
      0,
      layer.height,
      { left: 500, right: 510, top: 0, bottom: 22 },
    ));
    expect(selected.map((item) => item.objectId)).toEqual(
      Array.from({ length: 12 }, (_, index) => `item-${index + 499}`),
    );
    expect(startReads).toBe(2000);
    expect(durationReads).toBe(1000);
  });
});
