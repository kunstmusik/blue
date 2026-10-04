import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import type { XmlDiagnostic } from '../serialization/xml-load';
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
    '<timeState><snapValue>-0.25</snapValue></timeState>',
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

  it('retains a historical ruler interval with a warning through copy and canonical reopen', () => {
    const diagnostics: XmlDiagnostic[] = [];
    const state = TimeState.loadFromXML(
      Element.parse('<timeState><timeUnit>16</timeUnit></timeState>'),
      undefined,
      (items) => diagnostics.push(...items),
    );

    expect(diagnostics).toMatchObject([
      {
        code: 'P-TIME-STATE-HISTORICAL-RULER',
        severity: 'warning',
        path: '/timeState/timeUnit[1]',
        member: 'timeUnit',
        value: '16',
      },
    ]);
    const canonical = state.saveAsXML();
    expect(canonical.getTextString('timeUnit')).toBe('16');
    expect(new TimeState(state).saveAsXML().toXml()).toBe(canonical.toXml());
    expect(
      TimeState.loadFromXML(canonical, undefined, () => {})
        .saveAsXML()
        .toXml(),
    ).toBe(canonical.toXml());
  });

  it('normalizes legacy zero snap to the Java nearest match with a warning', () => {
    const diagnostics: XmlDiagnostic[] = [];
    const state = TimeState.loadFromXML(
      Element.parse('<timeState><snapValue>0.0</snapValue></timeState>'),
      undefined,
      (items) => diagnostics.push(...items),
    );
    const canonical = state.saveAsXML();

    expect(state.getSnapValue()).toBe('SIXTY_FOURTH');
    expect(diagnostics).toMatchObject([
      {
        code: 'P-TIME-STATE-ZERO-SNAP',
        severity: 'warning',
        path: '/timeState/snapValue[1]',
        member: 'snapValue',
        value: '0.0',
      },
    ]);
    expect(canonical.getTextString('snapValue')).toBe('SIXTY_FOURTH');
    expect(
      TimeState.loadFromXML(canonical, undefined, () => {})
        .saveAsXML()
        .toXml(),
    ).toBe(canonical.toXml());
  });

  it.each(['0', '-1', '1.5', '2147483648'])('rejects invalid historical timeUnit %s', (value) => {
    expect(() =>
      TimeState.loadFromXML(Element.parse(`<timeState><timeUnit>${value}</timeUnit></timeState>`)),
    ).toThrow();
  });
});
