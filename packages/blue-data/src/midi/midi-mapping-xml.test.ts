import { expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { MidiKeyMapping } from './midi-key-mapping';
import { MidiVelocityMapping } from './midi-velocity-mapping';

it.each([
  '<midiKeyMapping><baseNote>128</baseNote></midiKeyMapping>',
  '<midiKeyMapping><pFieldIndex>0</pFieldIndex></midiKeyMapping>',
  '<midiKeyMapping><range>12junk</range></midiKeyMapping>',
  '<midiKeyMapping><enabled>yes</enabled></midiKeyMapping>',
  '<midiKeyMapping future="yes"/>',
])('rejects malformed key mapping %s', (xml) => {
  expect(() => MidiKeyMapping.loadFromXML(Element.parse(xml))).toThrow();
});

it.each([
  '<midiVelocityMapping><minVelocity>128</minVelocity></midiVelocityMapping>',
  '<midiVelocityMapping><pFieldIndex>0</pFieldIndex></midiVelocityMapping>',
  '<midiVelocityMapping><minValue>Infinity</minValue></midiVelocityMapping>',
  '<midiVelocityMapping><minVelocity>120</minVelocity><maxVelocity>20</maxVelocity></midiVelocityMapping>',
  '<midiVelocityMapping><minValue>2</minValue><maxValue>1</maxValue></midiVelocityMapping>',
  '<midiVelocityMapping><future/></midiVelocityMapping>',
])('rejects malformed velocity mapping %s', (xml) => {
  expect(() => MidiVelocityMapping.loadFromXML(Element.parse(xml))).toThrow();
});
