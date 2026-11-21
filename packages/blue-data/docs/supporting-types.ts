/**
 * Types used by the package-root signatures. Some are returned or accepted by
 * the API without having their own package-root import.
 *
 * @module Supporting types
 */

export type { ParameterScoreContext } from '../src/automation/csd-parameter-automation';
export type { CsdRenderProfile } from '../src/blue-data/csd-parameter-score';
export type { StringChannelEntry } from '../src/compile-data';
export type { BSBDropdownItem } from '../src/instruments/blue-synth-builder/bsb-dropdown';
export type { StringChannel } from '../src/instruments/blue-synth-builder/bsb-file-selector';
export type { BSBCompilationUnit } from '../src/instruments/blue-synth-builder/bsb-compilation-unit';
export type {
  BSBGraphicInterface,
  GridSettingsData,
  GridStyle,
} from '../src/instruments/blue-synth-builder/bsb-graphic-interface';
export type {
  BsbWidgetIdRepair,
  BsbWidgetIdRepairReason,
} from '../src/instruments/blue-synth-builder/bsb-identity';
export type { BSBFont } from '../src/instruments/blue-synth-builder/bsb-knob';
export type { InstrumentCategory } from '../src/instruments/instrument-category';
export type { InstrumentLoader } from '../src/instruments/instrument-registry';
export type { EffectsChainItem } from '../src/mixer/effects-chain';
export type { TuningScaleReference } from '../src/note-processors/tuning-processor';
export type { ScoreNormalizationOrigin } from '../src/score/score-generation-options';
export type { DiagnosticInput, Operation } from '../src/serialization/xml-load';
export type {
  Accumulator,
  Generator,
  JavaRandom,
  Mask,
  Quantizer,
  Table,
  TablePoint,
} from '../src/sound-objects/jmask/core-table-modifiers';
export type {
  Field as JMaskField,
  Parameter as JMaskParameter,
} from '../src/sound-objects/jmask/field-parameter';
export type { FileSeekProvenance, SoundOccurrence } from '../src/sound-objects/note';
export type { Field as PianoRollField } from '../src/sound-objects/piano-roll/field';
export type {
  SoundObjectFingerprint,
  SoundObjectLibraryEntry,
} from '../src/sound-objects/sound-object-library';
export type {
  InstrumentTargetBehavior,
  SoundObjectFactory,
  SoundObjectLoader,
} from '../src/sound-objects/sound-object-registry';
