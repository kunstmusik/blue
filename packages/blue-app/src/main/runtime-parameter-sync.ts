import {
  getArrangementOwnerParameters,
  getMixerOwnerParameters,
  getTrackOwnerParameters,
} from '@blue/data';
import type { Arrangement, Mixer, Parameter, Score } from '@blue/data';

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
  const liveParameters = [
    ...getArrangementOwnerParameters(arrangement).map((entry) => entry.parameter),
    ...(score ? getTrackOwnerParameters(score).map((entry) => entry.parameter) : []),
    ...getMixerOwnerParameters(mixer),
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
