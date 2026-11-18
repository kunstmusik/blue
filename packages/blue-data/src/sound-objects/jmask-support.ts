/**
 * JMask support model used by the JMask SoundObject.
 * Mirrors the Java blue.soundObject.jmask package closely enough for XML round-trip,
 * generator evaluation, and editor state preservation.
 */
export {
  JavaRandom,
  type Generator,
  type JMaskGenerationMode,
  type Maskable,
  type Quantizable,
  type Accumulatable,
  type ProbabilityGenerator,
  TablePoint,
  Table,
  DoubleOrTable,
  Mask,
  Quantizer,
  Accumulator,
} from './jmask/core-table-modifiers';
export {
  Uniform,
  Triangle,
  Linear,
  Exponential,
  Gaussian,
  Cauchy,
  Beta,
  Weibull,
} from './jmask/probability-distributions';
export {
  Constant,
  Random,
  Oscillator,
  Segment,
  ItemList,
  Probability,
  GeneratorEntry,
  GeneratorRegistry,
  loadGeneratorFromXML,
  loadProbabilityGeneratorFromXML,
} from './jmask/generators';
export { Parameter, Field } from './jmask/field-parameter';
export { loadFieldFromSnapshot } from './jmask/snapshot-hydration';
