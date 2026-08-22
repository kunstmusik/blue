import type { BlueData } from '@blue/data';
import { TimeBase, TrackLayerGroup } from '@blue/data';
import {
  normalizeDefaultLayerGroupType,
  type ProgramSettingsSnapshot,
} from '../shared/program-settings';
import { PolyObject } from '@blue/data';

function parseTimeBase(value: string): TimeBase {
  const map: Record<string, TimeBase> = {
    BEATS: TimeBase.BEATS,
    BBT: TimeBase.BBT,
    BBST: TimeBase.BBST,
    BBF: TimeBase.BBF,
    TIME: TimeBase.TIME,
    SECONDS: TimeBase.SECONDS,
    SMPTE: TimeBase.SMPTE,
    FRAME: TimeBase.FRAME,
  };
  return map[value] ?? TimeBase.BEATS;
}

export function applyProgramSettingsToNewProject(
  data: BlueData,
  settings: ProgramSettingsSnapshot,
): void {
  const props = data.getProjectProperties();
  const pd = settings.projectDefaults;
  const rt = settings.realtimeRender;
  const dr = settings.diskRender;

  props.author = pd.defaultAuthor;

  data.getMixer().setEnabled(pd.mixerEnabled);

  const score = data.getScore();
  const root = score[0];
  const defaultLayerGroupType = normalizeDefaultLayerGroupType(pd.defaultLayerGroupType);
  if (defaultLayerGroupType === 'TRACK') {
    const trackGroup = new TrackLayerGroup();
    trackGroup.setDefaultHeightIndex(pd.layerHeightDefault);
    trackGroup.newLayerAt(0);
    score.splice(0, 1, trackGroup);
  } else if (root instanceof PolyObject) {
    root.setDefaultHeightIndex(pd.layerHeightDefault);
  }

  const timeState = data.getScore().getTimeState();
  timeState.setTimeDisplay(parseTimeBase(pd.defaultPrimaryTimeBase));
  timeState.setSecondaryTimeDisplay(parseTimeBase(pd.defaultSecondaryTimeBase));
  timeState.setSecondaryRulerEnabled(pd.defaultSecondaryRulerEnabled);
  timeState.setSnapEnabled(pd.defaultSnapEnabled);
  timeState.setSnapValue(pd.defaultSnapValue as any);
  timeState.setSmpteFrameRate(pd.defaultSmpteFrameRate);

  props.sampleRate = rt.defaultSr;
  props.ksmps = rt.defaultKsmps;
  props.nchnls = rt.defaultNchnls;
  props.useZeroDbFS = rt.useZeroDbfs;
  props.zeroDbFS = rt.zeroDbfs;
  props.useAudioOut = rt.audioOutEnabled;
  props.useAudioIn = rt.audioInEnabled;
  props.useMidiIn = rt.midiInEnabled;
  props.useMidiOut = rt.midiOutEnabled;
  props.noteAmpsEnabled = rt.noteAmpsEnabled;
  props.outOfRangeEnabled = rt.outOfRangeEnabled;
  props.warningsEnabled = rt.warningsEnabled;
  props.benchmarkEnabled = rt.benchmarkEnabled;
  props.advancedSettings = rt.advancedSettings;

  props.diskSampleRate = dr.defaultSr;
  props.diskKsmps = dr.defaultKsmps;
  props.diskChannels = dr.defaultNchnls;
  props.diskUseZeroDbFS = dr.useZeroDbfs;
  props.diskZeroDbFS = dr.zeroDbfs;
  props.diskNoteAmpsEnabled = dr.noteAmpsEnabled;
  props.diskOutOfRangeEnabled = dr.outOfRangeEnabled;
  props.diskWarningsEnabled = dr.warningsEnabled;
  props.diskBenchmarkEnabled = dr.benchmarkEnabled;
  props.diskAdvancedSettings = dr.advancedSettings;

  data.getScore().getTimeContext().setSampleRate(
    parseInt(props.sampleRate, 10) || 44100,
  );
}
