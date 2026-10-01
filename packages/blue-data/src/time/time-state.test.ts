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
    ['29.97junk', 24],
    ['NaN', 24],
    ['27', 24],
  ])('recovers persisted %s as %s NDF', (text, rate) => {
    const state = TimeState.loadFromXML(
      Element.parse(`<timeState><smpteFrameRate>${text}</smpteFrameRate></timeState>`),
    );
    expect(state.getSmpteFrameRate()).toBe(rate);
    expect(state.isSmpteDropFrame()).toBe(false);
  });
  it('clones unrelated XML while keeping modeled values authoritative', () => {
    const input = Element.parse(
      '<timeState future="yes"><smpteFrameRate>30</smpteFrameRate><smpteDropFrame>true</smpteDropFrame><future><child value="a"/></future></timeState>',
    );
    const state = TimeState.loadFromXML(input);
    const copy = new TimeState(state);
    input.getElement('future')!.getElement('child')!.setAttribute('value', 'changed');
    const output = copy.saveAsXML();
    expect(output.getAttribute('future')).toBe('yes');
    expect(output.getElement('future')!.getElement('child')!.getAttribute('value')).toBe('a');
    expect(output.getElement('smpteDropFrame')).toBeNull();
    output.getElement('future')!.setText('mutated');
    expect(copy.saveAsXML().getElement('future')!.getTextString()).toBe('');
  });
});
