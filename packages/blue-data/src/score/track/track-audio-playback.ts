import { Channel } from '../../mixer/channel';
import { Mixer } from '../../mixer/mixer';
import { GenericInstrument } from '../../instruments/generic-instrument';
import { CompileData } from '../../compile-data';
import { Note } from '../../sound-objects/note';
import { NoteList } from '../../sound-objects/note-list';
import { TimeContext } from '../../time/time-context';
import { AudioClip } from '../audio/audio-clip';
import { BLUE_FADE_UDO } from '../audio/blue-fade-udo';
import { PLAYBACK_INSTRUMENT_ORC } from '../audio/playback-instrument-orc';
import { fadeTypeToCsound } from '../audio/fade-type';

const AUDIO_INSTRUMENT_PREFIX = 'track-audio-instrument:';

function findAssociatedChannel(compileData: CompileData, trackId: string): Channel | undefined {
  for (const channel of compileData.getChannelIdAssignments().keys()) {
    if (channel.getAssociation() === trackId) return channel;
  }
  return undefined;
}

export function generateTrackAudioPlaybackNotes(
  trackId: string,
  clips: readonly AudioClip[],
  context: TimeContext,
  compileData: CompileData,
  startTime: number,
  endTime: number,
): NoteList {
  if (clips.length === 0) return new NoteList();

  if (compileData.getCompilationVariable('BLUE_FADE_UDO') == null) {
    compileData.appendGlobalOrc(BLUE_FADE_UDO);
    compileData.setCompilationVariable('BLUE_FADE_UDO', {});
  }

  const instrId = ensureTrackAudioPlaybackInstrument(trackId, context, compileData);
  const notes = new NoteList();
  const usesEndTime = endTime > startTime;
  const adjustedEndTime = endTime - startTime;

  for (const clip of clips) {
    const clipStart = clip.getStartTime().toBeats(context);
    const clipFileStart = clip.getFileStartTime();
    const clipDur = clip.getSubjectiveDuration().toBeats(context);
    const clipEnd = clipStart + clipDur;
    if (clipEnd <= startTime || (usesEndTime && clipStart >= endTime)) continue;

    const startOffset = Math.max(startTime - clipStart, 0);
    const newStart = Math.max(clipStart - startTime, 0);
    const newEnd = clipEnd - startTime;
    const newDuration =
      usesEndTime && newEnd > adjustedEndTime ? adjustedEndTime - newStart : newEnd - newStart;

    const note = Note.createNote(12);
    note.setPField(String(instrId), 1);
    note.setStartTime(newStart);
    note.setSubjectiveDuration(newDuration);
    note.setPField(`"${clip.getAudioFile().replace(/\\/g, '/')}"`, 4);
    note.setPField(String(clipFileStart), 5);
    note.setPField(String(startOffset), 6);
    note.setPField(String(clipDur), 7);
    note.setPField(fadeTypeToCsound(clip.getFadeInType()).toString(), 8);
    note.setPField(String(clip.getFadeIn()), 9);
    note.setPField(fadeTypeToCsound(clip.getFadeOutType()).toString(), 10);
    note.setPField(String(clip.getFadeOut()), 11);
    note.setPField(clip.isLooping() ? '1' : '0', 12);
    note.setTrackInstrumentTarget('preserve');
    notes.add(note);
  }

  return notes;
}

export function ensureTrackAudioPlaybackInstrument(
  trackId: string,
  _context: TimeContext,
  compileData: CompileData,
): number {
  const key = `${AUDIO_INSTRUMENT_PREFIX}${trackId}`;
  const existing = compileData.getCompilationVariable(key);
  if (typeof existing === 'number') return existing;

  const mixerEnabled = compileData.isMixerEnabled();
  const associatedChannel = mixerEnabled ? findAssociatedChannel(compileData, trackId) : undefined;
  const instrument = new GenericInstrument();
  if (!mixerEnabled) {
    // With the mixer disabled no BlueMixer instrument reads ga_bluemix_* or
    // ga_bluesub_* variables, so clips must output directly, matching how the
    // arrangement compiler rewrites blueMixerOut to outc for that case.
    instrument.setText(
      `${PLAYBACK_INSTRUMENT_ORC.replaceAll('{0}', 'a1').replaceAll('{1}', 'a2')}\noutc a1, a2\n`,
    );
  } else if (associatedChannel) {
    const channelId = compileData.getChannelIdAssignments().get(associatedChannel);
    if (channelId == null) {
      throw new Error(`Missing mixer channel assignment for Track '${trackId}'`);
    }
    instrument.setText(
      PLAYBACK_INSTRUMENT_ORC.replaceAll('{0}', Mixer.getChannelVar(channelId, 0)).replaceAll(
        '{1}',
        Mixer.getChannelVar(channelId, 1),
      ),
    );
  } else {
    // No channel is associated with this Track. Route into the Master
    // sub-channel so the clip stays audible under the BlueMixer, mirroring
    // the arrangement compiler's fallback for instruments without a channel.
    instrument.setText(
      PLAYBACK_INSTRUMENT_ORC.replaceAll(
        '{0}',
        Mixer.getSubChannelVar(Mixer.MASTER_CHANNEL, 0),
      ).replaceAll('{1}', Mixer.getSubChannelVar(Mixer.MASTER_CHANNEL, 1)),
    );
  }
  instrument.setName(`Track Audio Playback (${trackId})`);

  const instrId = compileData.addInstrument(instrument);
  compileData.addInstrSourceId(instrument, trackId);
  compileData.setCompilationVariable(key, instrId);
  return instrId;
}
