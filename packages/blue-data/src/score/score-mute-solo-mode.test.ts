import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { Score } from './score';

describe('Score track header M/S mode', () => {
  it('saves Audio for new scores', () => {
    const score = new Score();
    expect(score.saveAsXML().getAttribute('trackLayerMuteSoloMode')).toBe('audio');
    expect(new Score(score).trackLayerMuteSoloMode).toBe('audio');
  });

  it.each([
    { xml: '<score/>', mode: 'event' },
    { xml: '<score trackLayerMuteSoloMode="event"/>', mode: 'event' },
    { xml: '<score trackLayerMuteSoloMode="audio"/>', mode: 'audio' },
    { xml: '<score trackLayerMuteSoloMode="unsupported"/>', mode: 'event' },
  ])('loads $xml as $mode and saves the resolved mode', ({ xml, mode }) => {
    const score = Score.loadFromXML(Element.parse(xml));
    expect(score.trackLayerMuteSoloMode).toBe(mode);
    expect(score.saveAsXML().getAttribute('trackLayerMuteSoloMode')).toBe(mode);
    expect(score.deepCopy('history').trackLayerMuteSoloMode).toBe(mode);
  });
});
