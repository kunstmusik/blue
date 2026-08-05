import { ParameterHelper, TrackLayerGroup } from '@blue/data';
import type { Arrangement, Instrument, Mixer, Parameter, Score } from '@blue/data';

export interface RuntimeParameterSyncResult {
  liveCount: number;
  compiledCount: number;
}

export function syncCompiledRuntimeParameterNames(
  arrangement: Arrangement,
  mixer: Mixer,
  compiledParameters?: Parameter[],
  score?: Score,
): RuntimeParameterSyncResult {
  const arrangementParameters = collectArrangementParameters(arrangement);
  const arrangementAndMixerParameters = ParameterHelper.getAllParameters(arrangement, mixer);
  const liveParameters = [
    ...arrangementParameters,
    ...collectTrackParameters(score),
    ...arrangementAndMixerParameters.slice(arrangementParameters.length),
  ];

  for (const parameter of liveParameters) {
    parameter.setCompilationVarName('');
  }

  const compiledCount = compiledParameters?.length ?? 0;
  if (!compiledParameters || compiledParameters.length === 0) {
    return {
      liveCount: liveParameters.length,
      compiledCount,
    };
  }

  const count = Math.min(liveParameters.length, compiledParameters.length);
  for (let index = 0; index < count; index += 1) {
    liveParameters[index]!.setCompilationVarName(
      compiledParameters[index]!.getCompilationVarName() ?? '',
    );
  }

  return {
    liveCount: liveParameters.length,
    compiledCount,
  };
}

function collectTrackParameters(score?: Score): Parameter[] {
  const parameters: Parameter[] = [];
  if (!score) return parameters;

  for (const layerGroup of score) {
    if (!(layerGroup instanceof TrackLayerGroup)) continue;
    for (const track of layerGroup) {
      const instrument = track.getInstrument();
      if (!instrument?.isEnabled()) continue;
      parameters.push(...getInstrumentParameters(instrument));
    }
  }
  return parameters;
}

function collectArrangementParameters(arrangement: Arrangement): Parameter[] {
  const parameters: Parameter[] = [];
  for (const assignment of arrangement.getArrangement()) {
    if (!assignment.enabled || !assignment.instr) continue;
    parameters.push(...getInstrumentParameters(assignment.instr));
  }
  return parameters;
}

function getInstrumentParameters(instrument: Instrument): Parameter[] {
  const automatable = instrument as Instrument & { getParameters?: () => Parameter[] };
  return typeof automatable.getParameters === 'function'
    ? automatable.getParameters()
    : [];
}
