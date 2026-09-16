import { describe, expect, it } from 'vitest';
import { TrackLayerGroup } from './track-layer-group';
import type { Track } from './track';
import type { CompileData } from '../../compile-data';
import { TimeContext } from '../../time/time-context';
import { NoteList } from '../../sound-objects/note-list';

/**
 * Stub tracks exercising only the flag-filtering seam: Spec 111 requires
 * Audio-mode groups to ignore event flags and global solo discovery, while
 * Event mode keeps the Java-compatible filtering.
 */
function createStubTrack(options: { id: string; muted?: boolean; solo?: boolean }): Track {
  return {
    getUniqueId: () => options.id,
    isMuted: () => options.muted ?? false,
    isSolo: () => options.solo ?? false,
    getName: () => options.id,
    generateForCSD: () => {
      const out = new NoteList();
      out.push({ toScoreText: () => `i"${options.id}" 0 1` } as never);
      return out;
    },
    generateForCSDAsync: async () => {
      const out = new NoteList();
      out.push({ toScoreText: () => `i"${options.id}" 0 1` } as never);
      return out;
    },
  } as unknown as Track;
}

function createGroup(tracks: Track[]): TrackLayerGroup {
  const group = new TrackLayerGroup();
  for (const track of tracks) group.push(track);
  return group;
}

function compileDataStub(): CompileData {
  return {
    getCompilationVariable: () => undefined,
  } as unknown as CompileData;
}

function noteTexts(notes: NoteList): string[] {
  const texts: string[] = [];
  for (let i = 0; i < notes.length; i++) {
    texts.push(notes.getNote(i).toScoreText());
  }
  return texts;
}

describe('TrackLayerGroup track header mode (Spec 111)', () => {
  it('Event mode filters muted tracks and honors solo exclusion', () => {
    const group = createGroup([
      createStubTrack({ id: 'a', muted: true }),
      createStubTrack({ id: 'b' }),
      createStubTrack({ id: 'c', solo: true }),
    ]);
    const notes = group.generateForCSD(new TimeContext(), compileDataStub(), 0, 10, {
      trackLayerMuteSoloMode: 'event',
      processWithSolo: true,
    });
    expect(noteTexts(notes)).toEqual(['i"c" 0 1']);
  });

  it('Audio mode ignores track flags entirely', () => {
    const group = createGroup([
      createStubTrack({ id: 'a', muted: true }),
      createStubTrack({ id: 'b' }),
      createStubTrack({ id: 'c', solo: true }),
    ]);
    const notes = group.generateForCSD(new TimeContext(), compileDataStub(), 0, 10, {
      trackLayerMuteSoloMode: 'audio',
      processWithSolo: true,
    });
    const texts = noteTexts(notes);
    expect(texts).toContain('i"a" 0 1');
    expect(texts).toContain('i"b" 0 1');
    expect(texts).toContain('i"c" 0 1');
  });

  it('async generation matches the sync mode matrix', async () => {
    const group = createGroup([
      createStubTrack({ id: 'a', muted: true }),
      createStubTrack({ id: 'b' }),
    ]);
    const eventNotes = await group.generateForCSDAsync(
      new TimeContext(),
      compileDataStub(),
      0,
      10,
      { trackLayerMuteSoloMode: 'event' },
    );
    expect(noteTexts(eventNotes)).toEqual(['i"b" 0 1']);

    const audioNotes = await group.generateForCSDAsync(
      new TimeContext(),
      compileDataStub(),
      0,
      10,
      { trackLayerMuteSoloMode: 'audio' },
    );
    expect(noteTexts(audioNotes).sort()).toEqual(['i"a" 0 1', 'i"b" 0 1']);
  });

  it('does not mutate track flags during generation', () => {
    const track = createStubTrack({ id: 'a', muted: true });
    const group = createGroup([track]);
    group.generateForCSD(new TimeContext(), compileDataStub(), 0, 10, {
      trackLayerMuteSoloMode: 'audio',
    });
    expect(track.isMuted()).toBe(true);
  });
});
