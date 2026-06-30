import { Element } from '@blue/data';

export function makeAutomationTestProjectXml(options?: {
  soundLayerParameterIds?: string[];
  audioLayerParameterIds?: string[];
}): string {
  const sParamIds = options?.soundLayerParameterIds ?? [];
  const aParamIds = options?.audioLayerParameterIds ?? [];

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

  const audioGroup = score.addElement('audioLayerGroup');
  audioGroup.addElement('audioLayer').setAttribute('name', 'Audio Layer 1');
  const audioLayer = audioGroup.getElement('audioLayer')!;
  audioLayer.setAttribute('muted', 'false');
  audioLayer.setAttribute('solo', 'false');
  audioLayer.setAttribute('heightIndex', '0');
  audioLayer.setAttribute('uniqueId', 'audio-layer-1');
  for (const id of aParamIds) {
    audioLayer.addElement('parameterId').setText(id);
  }

  return root.toXml();
}
