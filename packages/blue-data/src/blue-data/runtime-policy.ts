import type { BlueData } from "../blue-data";
import { ClojureObject } from "../sound-objects/clojure-object";
import { Instance } from "../sound-objects/instance";
import { JavaScriptObject } from "../sound-objects/javascript-object";
import { ObjectBuilder } from "../sound-objects/object-builder";
import { PolyObject } from "../sound-objects/poly-object";
import { PythonObject } from "../sound-objects/python-object";
import type { SoundObject } from "../sound-objects/sound-object";
import { PythonInstrument } from "../instruments/python-instrument";
import { PythonProcessor } from "../note-processors/python-processor";
import type { NoteProcessorChain } from "../note-processors/note-processor-chain";
import { TrackLayerGroup } from "../score/track/track-layer-group";
import { TimeContext } from "../time/time-context";
import type { JavaScriptSession } from "../javascript-runtime";
import type { JavaRuntimeClientContract } from "../java-runtime";

export function processOnLoad(blueData: BlueData, session?: JavaScriptSession): void {
  const score = blueData.getScore();
  score.processOnLoad(session);
  processLiveDataOnLoad(blueData, score.getTimeContext(), session);
}

export async function processOnLoadAsync(
  blueData: BlueData,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
): Promise<void> {
  const score = blueData.getScore();
  await score.processOnLoadAsync(session, runtimeClient);
  await processLiveDataOnLoadAsync(blueData, score.getTimeContext(), session, runtimeClient);
}

function processLiveDataOnLoad(
  blueData: BlueData,
  context: TimeContext,
  session?: JavaScriptSession,
): void {
  const liveBins = blueData.getLiveData().getLiveObjectBins();
  for (let c = 0; c < liveBins.getColumnCount(); c++) {
    for (let r = 0; r < liveBins.getRowCount(); r++) {
      const liveObject = liveBins.getLiveObject(c, r);
      const target = liveObject?.getSoundObject();
      if (target) {
        processSoundObjectOnLoad(target, context, session);
      }
    }
  }
}

async function processLiveDataOnLoadAsync(
  blueData: BlueData,
  context: TimeContext,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
): Promise<void> {
  const liveBins = blueData.getLiveData().getLiveObjectBins();
  for (let c = 0; c < liveBins.getColumnCount(); c++) {
    for (let r = 0; r < liveBins.getRowCount(); r++) {
      const liveObject = liveBins.getLiveObject(c, r);
      const target = liveObject?.getSoundObject();
      if (target) {
        await processSoundObjectOnLoadAsync(target, context, session, runtimeClient);
      }
    }
  }
}

export function usesJavaRuntime(blueData: BlueData): boolean {
const seen = new Set<SoundObject>();

const chainUsesJavaRuntime = (chain: NoteProcessorChain | null | undefined): boolean => {
  if (!chain) {
    return false;
  }

  return chain.getProcessors().some((processor) => processor instanceof PythonProcessor);
};

const visit = (soundObject: SoundObject | null | undefined): boolean => {
  if (!soundObject || seen.has(soundObject)) {
    return false;
  }

  seen.add(soundObject);

  if (chainUsesJavaRuntime(soundObject.getNoteProcessorChain())) {
    return true;
  }

  if (soundObject instanceof ClojureObject || soundObject instanceof PythonObject) {
    return true;
  }

  if (soundObject instanceof ObjectBuilder && soundObject.usesJavaRuntime()) {
    return true;
  }

  if (soundObject instanceof Instance) {
    return visit(soundObject.getSoundObject());
  }

  if (soundObject instanceof PolyObject) {
    for (const layer of soundObject) {
      if (chainUsesJavaRuntime(layer.getNoteProcessorChain())) {
        return true;
      }

      for (const nested of layer) {
        if (visit(nested)) {
          return true;
        }
      }
    }
  }

  return false;
};

if (chainUsesJavaRuntime(blueData.getScore().getNoteProcessorChain())) {
  return true;
}

for (const layerGroup of blueData.getScore()) {
  if (layerGroup instanceof PolyObject && visit(layerGroup)) {
    return true;
  }
  if (layerGroup instanceof TrackLayerGroup) {
    for (const track of layerGroup) {
      const instrument = track.getInstrument();
      if (instrument instanceof PythonInstrument) return true;
      if (chainUsesJavaRuntime(track.getNoteProcessorChain())) return true;
      for (const item of track) {
        if ('generateForCSD' in item && visit(item as SoundObject)) return true;
      }
    }
  }
}

for (const soundObject of blueData.getSoundObjectLibrary().getAllObjects()) {
  if (visit(soundObject)) {
    return true;
  }
}

for (const assignment of blueData.getArrangement().getArrangement()) {
  if (assignment.instr instanceof PythonInstrument) {
    return true;
  }
}

// Include Live Space content: a LiveObject whose SoundObject requires a
// host runtime makes the whole project Java-runtime-dependent for trigger
// preparation.
const liveBins = blueData.getLiveData().getLiveObjectBins();
for (let c = 0; c < liveBins.getColumnCount(); c++) {
  for (let r = 0; r < liveBins.getRowCount(); r++) {
    const liveObject = liveBins.getLiveObject(c, r);
    if (liveObject && visit(liveObject.getSoundObject())) {
      return true;
    }
  }
}

return false;
}

function resolveOnLoadSoundObject(soundObject: SoundObject): SoundObject | null {
  if (soundObject instanceof Instance) {
    const referenced = soundObject.getSoundObject();
    return referenced ? resolveOnLoadSoundObject(referenced) : null;
  }
  return soundObject;
}

function processSoundObjectOnLoad(
  soundObject: SoundObject,
  context: TimeContext,
  session?: JavaScriptSession,
): void {
  const target = resolveOnLoadSoundObject(soundObject);
  if (target instanceof PolyObject) {
    target.processOnLoad(context, session);
  } else if (target instanceof JavaScriptObject && target.isOnLoadProcessable()) {
    target.processOnLoad(context, session);
  } else if (target instanceof ClojureObject && target.isOnLoadProcessable()) {
    target.processOnLoad(context);
  } else if (target instanceof PythonObject && target.isOnLoadProcessable()) {
    target.processOnLoad(context);
  }
}

async function processSoundObjectOnLoadAsync(
  soundObject: SoundObject,
  context: TimeContext,
  session?: JavaScriptSession,
  runtimeClient?: JavaRuntimeClientContract | null,
): Promise<void> {
  const target = resolveOnLoadSoundObject(soundObject);
  if (target instanceof PolyObject) {
    await target.processOnLoadAsync(context, session, runtimeClient);
  } else if (target instanceof JavaScriptObject && target.isOnLoadProcessable()) {
    target.processOnLoad(context, session);
  } else if (target instanceof ClojureObject && target.isOnLoadProcessable()) {
    await target.processOnLoadAsync(context, runtimeClient);
  } else if (target instanceof PythonObject && target.isOnLoadProcessable()) {
    await target.processOnLoadAsync(context, runtimeClient);
  }
}
