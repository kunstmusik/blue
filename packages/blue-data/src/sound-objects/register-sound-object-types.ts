/**
 * Sound Object Type Registration — registers all built-in SoundObject types
 * with the registry. This file must be imported before any XML loading occurs.
 */
import { registerSoundObjectType, registerSoundObjectFactory } from './sound-object-registry';

const ASSIGNABLE = { trackPlacement: 'compatible' as const, instrumentTargetBehavior: 'assignable' as const };
const PROPAGATED = { trackPlacement: 'compatible' as const, instrumentTargetBehavior: 'propagated' as const };
const PRESERVE = { trackPlacement: 'compatible' as const, instrumentTargetBehavior: 'preserve' as const };
const NONE = { trackPlacement: 'compatible' as const, instrumentTargetBehavior: 'none' as const };
const AUDIO_FILE = {
  trackPlacement: 'incompatible' as const,
  trackPlacementReason: 'AudioFile is not valid in a Track; add the file as an AudioClip instead',
  instrumentTargetBehavior: 'none' as const,
};
const POLY_OBJECT = {
  trackPlacement: 'incompatible' as const,
  trackPlacementReason: 'PolyObject is not valid in a Track; use a SoundObject Layer Group for nested timelines',
  instrumentTargetBehavior: 'none' as const,
};
import { GenericScore } from './generic-score';
import { PolyObject } from './poly-object';
import { PythonObject } from './python-object';
import { ClojureObject } from './clojure-object';
import { JavaScriptObject } from './javascript-object';
import { CSDSoundObject } from './csd-sound-object';
import { Comment } from './comment';
import { AudioFile } from './audio-file';
import { Sound } from './sound';
import { External } from './external';
import { Instance } from './instance';
import { LineObject } from './line-object';
import { ZakLineObject } from './zak-line-object';
import { PatternObject } from './pattern-object';
import { PianoRoll } from './piano-roll';
import { JMask } from './j-mask';
import { TrackerObject } from './tracker-object';
import { FrozenSoundObject } from './frozen-sound-object';
import { ObjectBuilder } from './object-builder';

// Register all built-in SoundObject types
registerSoundObjectType('GenericScore', GenericScore.loadFromXML, ASSIGNABLE);
registerSoundObjectType('PolyObject', PolyObject.loadFromXML, POLY_OBJECT);
registerSoundObjectType('PythonObject', PythonObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('ClojureObject', ClojureObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('JavaScriptObject', JavaScriptObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('CSDSoundObject', CSDSoundObject.loadFromXML, PRESERVE);
registerSoundObjectType('Comment', Comment.loadFromXML, NONE);
registerSoundObjectType('AudioFile', AudioFile.loadFromXML, AUDIO_FILE);
registerSoundObjectType('Sound', Sound.loadFromXML, PRESERVE);
registerSoundObjectType('External', External.loadFromXML, ASSIGNABLE);
registerSoundObjectType('Instance', Instance.loadFromXML, PROPAGATED);
registerSoundObjectType('LineObject', LineObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('ZakLineObject', ZakLineObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('PatternObject', PatternObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('PianoRoll', PianoRoll.loadFromXML, ASSIGNABLE);
registerSoundObjectType('JMask', JMask.loadFromXML, ASSIGNABLE);
registerSoundObjectType('TrackerObject', TrackerObject.loadFromXML, ASSIGNABLE);
registerSoundObjectType('FrozenSoundObject', FrozenSoundObject.loadFromXML, PRESERVE);
registerSoundObjectType('ObjectBuilder', ObjectBuilder.loadFromXML, ASSIGNABLE);

registerSoundObjectFactory('GenericScore', () => new GenericScore());
registerSoundObjectFactory('PolyObject', () => {
  const pObj = new PolyObject();
  pObj.newLayerAt(0);
  return pObj;
});
registerSoundObjectFactory('PythonObject', () => new PythonObject());
registerSoundObjectFactory('ClojureObject', () => new ClojureObject());
registerSoundObjectFactory('JavaScriptObject', () => new JavaScriptObject());
registerSoundObjectFactory('CSDSoundObject', () => new CSDSoundObject());
registerSoundObjectFactory('Comment', () => new Comment());
registerSoundObjectFactory('AudioFile', () => new AudioFile());
registerSoundObjectFactory('Sound', () => new Sound());
registerSoundObjectFactory('External', () => new External());
registerSoundObjectFactory('Instance', () => new Instance());
registerSoundObjectFactory('LineObject', () => new LineObject());
registerSoundObjectFactory('ZakLineObject', () => new ZakLineObject());
registerSoundObjectFactory('PatternObject', () => new PatternObject());
registerSoundObjectFactory('PianoRoll', () => new PianoRoll());
registerSoundObjectFactory('JMask', () => new JMask());
registerSoundObjectFactory('TrackerObject', () => new TrackerObject());
registerSoundObjectFactory('FrozenSoundObject', () => new FrozenSoundObject());
registerSoundObjectFactory('ObjectBuilder', () => new ObjectBuilder());
