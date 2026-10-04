import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { TimeState } from './time-state';

describe('TimeState SMPTE persistence', () => {
  it('defaults to NDF and writes mode only when true', () => {
    const state = new TimeState();
    expect(state.isSmpteDropFrame()).toBe(false);
    expect(state.saveAsXML().getElement('smpteDropFrame')).toBeNull();
    state.setSmpteFrameRate(29.97);
    state.setSmpteDropFrame(true);
    expect(TimeState.loadFromXML(state.saveAsXML()).isSmpteDropFrame()).toBe(true);
    expect(new TimeState(state).isSmpteDropFrame()).toBe(true);
  });
  it.each([
    ['29.97df', 29.97],
    ['30df', 30],
  ])('recovers persisted %s as %s NDF', (text, rate) => {
    const state = TimeState.loadFromXML(
      Element.parse(`<timeState><smpteFrameRate>${text}</smpteFrameRate></timeState>`),
    );
    expect(state.getSmpteFrameRate()).toBe(rate);
    expect(state.isSmpteDropFrame()).toBe(false);
  });
  it.each([
    '<timeState future="yes"/>',
    '<timeState><future/></timeState>',
    '<timeState><smpteFrameRate>29.97junk</smpteFrameRate></timeState>',
    '<timeState><smpteFrameRate>27</smpteFrameRate></timeState>',
    '<timeState><smpteFrameRate>30</smpteFrameRate><smpteDropFrame>true</smpteDropFrame></timeState>',
    '<timeState><snapValue>1junk</snapValue></timeState>',
    '<timeState><timeDisplay>2</timeDisplay></timeState>',
    '<timeState version="1"><secondaryRulerEnabled>true</secondaryRulerEnabled></timeState>',
  ])('rejects invalid or unexpected state: %s', (xml) => {
    expect(() => TimeState.loadFromXML(Element.parse(xml))).toThrow();
  });

  it('normalizes legacy display, snap, and truncated zoom without losing row visibility', () => {
    const state = TimeState.loadFromXML(
      Element.parse(
        '<timeState version="4"><pixelSecond>110</pixelSecond><snapValue>0.25</snapValue><timeDisplay>CSOUND_BEATS</timeDisplay><tempoRowVisible>false</tempoRowVisible></timeState>',
      ),
    );
    expect(state.getZoomIterations()).toBe(4);
    expect(state.getSnapValue()).toBe('SIXTEENTH');
    expect(state.getTimeDisplay()).toBe('BEATS');
    expect(state.saveAsXML().getAttribute('version')).toBe('2');
    expect(state.saveAsXML().getTextString('tempoRowVisible')).toBe('false');
  });
});
