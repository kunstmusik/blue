import { BlueData } from '@blue/data';
import type { AudioLayoutManifest, JavaRuntimeClientContract, JavaScriptSession } from '@blue/data';
import { prepareProjectTuningDependencies } from './tuning-scale-dependencies';

/** Generate the disk-profile CSD used by Java's "Generate CSD to Screen" action. */
export async function generateDiskCsdForScreen(
  data: Pick<BlueData, 'toDiskCSD' | 'toDiskCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  const compileData = data instanceof BlueData ? prepareProjectTuningDependencies(data) : data;
  return javaRuntimeClient
    ? compileData.toDiskCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : compileData.toDiskCSD(javaScriptSession, layoutManifest);
}

/** Generate the API-backed realtime-profile CSD used by the realtime screen action. */
export async function generateRealtimeCsdForScreen(
  data: Pick<BlueData, 'toCSD' | 'toCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  const compileData = data instanceof BlueData ? prepareProjectTuningDependencies(data) : data;
  return javaRuntimeClient
    ? compileData.toCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : compileData.toCSD(javaScriptSession, layoutManifest);
}
