import { Element } from '@blue/data';

export function makeAutomationTestProjectXml(options?: {
  soundLayerParameterIds?: string[];
  trackLayerParameterIds?: string[];
}): string {
  const sParamIds = options?.soundLayerParameterIds ?? [];
  const trackParamIds = options?.trackLayerParameterIds ?? [];

  const root = new Element('blueData');
  root.setAttribute('version', '2');

  const score = root.addElement('score');
  const polyObj = score.addElement('polyObject');
  polyObj.setAttribute('name', 'SoundObject Layer Group');
  polyObj.setAttribute('startTime', '0.0');
  polyObj.setAttribute('duration', '8.0');
  polyObj.addElement('defaultHeightIndex').setText('0');

  const soundLayer = polyObj.addElement('soundLayer');
  soundLayer.setAttribute('name', 'Sound Layer 1');
  soundLayer.setAttribute('muted', 'false');
  soundLayer.setAttribute('solo', 'false');
  soundLayer.setAttribute('heightIndex', '0');
  soundLayer.addElement('noteProcessorChain');
  for (const id of sParamIds) {
    soundLayer.addElement('parameterId').setText(id);
  }

  const trackGroup = score.addElement('trackLayerGroup');
  trackGroup.setAttribute('name', 'Track Layer Group');
  trackGroup.setAttribute('uniqueId', 'track-group-1');
  trackGroup.addElement('defaultHeightIndex').setText('0');
  const tracks = trackGroup.addElement('tracks');
  const track = tracks.addElement('track');
  track.setAttribute('name', 'Track 1');
  track.setAttribute('muted', 'false');
  track.setAttribute('solo', 'false');
  track.setAttribute('heightIndex', '0');
  track.setAttribute('uniqueId', 'track-1');
  track.addElement('noteProcessorChain');
  for (const id of trackParamIds) {
    track.addElement('parameterId').setText(id);
  }

  return root.toXml();
}
