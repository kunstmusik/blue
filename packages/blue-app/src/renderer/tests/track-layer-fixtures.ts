export interface TrackLayerRowFixture {
  groupId: string;
  trackId: string;
  name: string;
  height: number;
  muted: boolean;
  solo: boolean;
  items: Array<{ id: string; kind: 'audioClip' | 'soundObject'; startBeats: number; durationBeats: number }>;
  clipboard?: Array<{ trackId: string; itemId: string; kind: 'audioClip' | 'soundObject' }>;
}

export function createTrackRowFixture(
  overrides: Partial<TrackLayerRowFixture> = {},
): TrackLayerRowFixture {
  return {
    groupId: 'fixture-track-group',
    trackId: 'fixture-track',
    name: 'Fixture Track',
    height: 22,
    muted: false,
    solo: false,
    items: [
      { id: 'fixture-sound-object', kind: 'soundObject', startBeats: 0, durationBeats: 1 },
      { id: 'fixture-audio-clip', kind: 'audioClip', startBeats: 1, durationBeats: 1 },
    ],
    ...overrides,
  };
}

export function createTrackDragFixture(
  source: Partial<TrackLayerRowFixture> = {},
): { source: TrackLayerRowFixture; target: { groupId: string; trackId: string } } {
  const row = createTrackRowFixture(source);
  return { source: row, target: { groupId: row.groupId, trackId: row.trackId } };
}

export function createTrackClipboardFixture(
  row = createTrackRowFixture(),
): NonNullable<TrackLayerRowFixture['clipboard']> {
  return row.items.map((item) => ({ trackId: row.trackId, itemId: item.id, kind: item.kind }));
}
