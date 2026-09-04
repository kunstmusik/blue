/**
 * InstrumentTypeRegistry — dispatches XML loading by instrument type attribute.
 * Mirrors the Java instrument type dispatch pattern.
 *
 * Each instrument type (e.g., "blue.orchestra.BlueSynthBuilder") maps
 * to a loader function that returns an Instrument instance.
 */
import { Element } from '../serialization/xml-reader';
import { Instrument } from './instrument';
import { BlueSynthBuilder } from './blue-synth-builder';
import { GenericInstrument } from './generic-instrument';
import { JavaScriptInstrument } from './javascript-instrument';
import { PythonInstrument } from './python-instrument';
import { BlueX7 } from './blue-x7';

/** Type for instrument loader functions */
export type InstrumentLoader = (data: Element) => Instrument | null;

const registry = new Map<string, InstrumentLoader>();

export function registerInstrumentType(type: string, loader: InstrumentLoader): void {
  registry.set(type, loader);
}

export function loadInstrumentFromXML(data: Element): Instrument | null {
  const type = data.getAttribute('type');
  if (!type) return null;

  const loader = registry.get(type);
  if (!loader) {
    console.warn(`Unknown instrument type: ${type}`);
    return null;
  }

  return loader(data);
}

/**
 * Initialize the instrument type registry.
 * Called once when this module is first imported.
 */
function init(): void {
  registerInstrumentType('blue.orchestra.BlueSynthBuilder', (data: Element) => {
    return BlueSynthBuilder.loadFromXML(data);
  });
  registerInstrumentType('blue.orchestra.GenericInstrument', (data: Element) => {
    return GenericInstrument.loadFromXML(data);
  });
  registerInstrumentType('blue.orchestra.JavaScriptInstrument', (data: Element) => {
    return JavaScriptInstrument.loadFromXML(data);
  });
  registerInstrumentType('blue.orchestra.PythonInstrument', (data: Element) => {
    return PythonInstrument.loadFromXML(data);
  });
  registerInstrumentType('blue.orchestra.BlueX7', (data: Element) => {
    return BlueX7.loadFromXML(data);
  });
}

// Run initialization
init();
