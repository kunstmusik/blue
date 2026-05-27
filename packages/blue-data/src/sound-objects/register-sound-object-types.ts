/**
 * Sound Object Type Registration — registers all built-in SoundObject types
 * with the registry. This file must be imported before any XML loading occurs.
 */
import { registerSoundObjectType, registerSoundObjectFactory } from './sound-object-registry';
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
import { NotationObject } from './notation-object';
import { FrozenSoundObject } from './frozen-sound-object';

// Register all built-in SoundObject types
registerSoundObjectType('GenericScore', GenericScore.loadFromXML);
registerSoundObjectType('PolyObject', PolyObject.loadFromXML);
registerSoundObjectType('PythonObject', PythonObject.loadFromXML);
registerSoundObjectType('ClojureObject', ClojureObject.loadFromXML);
registerSoundObjectType('JavaScriptObject', JavaScriptObject.loadFromXML);
registerSoundObjectType('CSDSoundObject', CSDSoundObject.loadFromXML);
registerSoundObjectType('Comment', Comment.loadFromXML);
registerSoundObjectType('AudioFile', AudioFile.loadFromXML);
registerSoundObjectType('Sound', Sound.loadFromXML);
registerSoundObjectType('External', External.loadFromXML);
registerSoundObjectType('Instance', Instance.loadFromXML);
registerSoundObjectType('LineObject', LineObject.loadFromXML);
registerSoundObjectType('ZakLineObject', ZakLineObject.loadFromXML);
registerSoundObjectType('PatternObject', PatternObject.loadFromXML);
registerSoundObjectType('PianoRoll', PianoRoll.loadFromXML);
registerSoundObjectType('JMask', JMask.loadFromXML);
registerSoundObjectType('TrackerObject', TrackerObject.loadFromXML);
registerSoundObjectType('NotationObject', NotationObject.loadFromXML);
registerSoundObjectType('FrozenSoundObject', FrozenSoundObject.loadFromXML);

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
registerSoundObjectFactory('NotationObject', () => new NotationObject());
registerSoundObjectFactory('FrozenSoundObject', () => new FrozenSoundObject());
