import type { BlueData, MeterBindingMap } from '@blue/data';
import { getMixerChannelSnapshotId } from '../shared/project-editor';
import type { MeterBindingMapPayload } from '../shared/meter-types';

export function buildMeterBindingMapPayload(
  data: BlueData,
  meterBindingMap: MeterBindingMap,
): MeterBindingMapPayload {
  const liveMixer = data.getMixer();
  const liveSubChannels = liveMixer.getSubChannels();
  const liveSourceChannels = liveMixer.getAllSourceChannels();

  const entries = meterBindingMap.entries.map((entry) => {
    let stripId = entry.stripId;
    if (entry.kind === 'master') {
      stripId = getMixerChannelSnapshotId(liveMixer.getMaster());
    } else if (entry.kind === 'sub') {
      const liveSub =
        typeof entry.channelIndex === 'number' && entry.channelIndex < liveSubChannels.length
          ? liveSubChannels[entry.channelIndex]
          : undefined;
      if (liveSub) {
        stripId = getMixerChannelSnapshotId(liveSub);
      }
    } else if (entry.kind === 'source') {
      const liveSource =
        typeof entry.channelIndex === 'number' && entry.channelIndex < liveSourceChannels.length
          ? liveSourceChannels[entry.channelIndex]
          : undefined;
      if (liveSource) {
        stripId = getMixerChannelSnapshotId(liveSource);
      }
    }
    return {
      kind: entry.kind,
      csdKey: entry.csdKey,
      stripId,
      displayName: entry.displayName,
    };
  });

  return {
    entries,
    nchnls: meterBindingMap.nchnls,
  };
}
