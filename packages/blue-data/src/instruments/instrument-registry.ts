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
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';

/** Type for instrument loader functions */
export type InstrumentLoader = (data: Element, context?: XmlLoadContext) => Instrument | null;

const registry = new Map<string, InstrumentLoader>();

export function registerInstrumentType(type: string, loader: InstrumentLoader): void {
  registry.set(type, loader);
}

export function loadInstrumentFromXML(
  data: Element,
  context?: XmlLoadContext,
  sink?: XmlDiagnosticSink,
): Instrument {
  const ctx = context ?? new XmlLoadContext(data);
  const type = data.getAttribute('type');
  const supported = [
    'blue.orchestra.GenericInstrument',
    'blue.orchestra.JavaScriptInstrument',
    'blue.orchestra.PythonInstrument',
    'blue.orchestra.BlueSynthBuilder',
    'blue.orchestra.BlueX7',
  ];
  const loader = type && supported.includes(type) ? registry.get(type) : undefined;
  if (data.getName() !== 'instrument' || !loader)
    throw ctx.at(data).error({
      code: 'type',
      member: '@type',
      value: type ?? '',
      message: 'Unsupported or missing instrument type.',
      recovery:
        'Use a supported instrument type or preserve the original in the separate library archive.',
    });
  const instrument = loader(data, ctx);
  if (!instrument)
    throw ctx.at(data).error({
      code: 'type',
      member: '@type',
      value: type!,
      message: 'Instrument loader did not produce a complete candidate.',
      recovery: 'Repair the supported resource in a compatible editor.',
    });
  return context ? instrument : requireXmlValue(ctx.result(instrument), sink);
}

/**
 * Initialize the instrument type registry.
 * Called once when this module is first imported.
 */
function init(): void {
  registerInstrumentType(
    'blue.orchestra.BlueSynthBuilder',
    (data: Element, context?: XmlLoadContext) => {
      return BlueSynthBuilder.loadFromXML(data, undefined, context);
    },
  );
  registerInstrumentType(
    'blue.orchestra.GenericInstrument',
    (data: Element, context?: XmlLoadContext) => {
      return GenericInstrument.loadFromXML(data, context);
    },
  );
  registerInstrumentType(
    'blue.orchestra.JavaScriptInstrument',
    (data: Element, context?: XmlLoadContext) => {
      return JavaScriptInstrument.loadFromXML(data, context);
    },
  );
  registerInstrumentType(
    'blue.orchestra.PythonInstrument',
    (data: Element, context?: XmlLoadContext) => {
      return PythonInstrument.loadFromXML(data, context);
    },
  );
  registerInstrumentType('blue.orchestra.BlueX7', (data: Element, context?: XmlLoadContext) => {
    return BlueX7.loadFromXML(data, undefined, context);
  });
}

// Run initialization
init();
