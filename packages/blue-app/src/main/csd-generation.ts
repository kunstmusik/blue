import type {
  AudioLayoutManifest,
  BlueData,
  JavaRuntimeClientContract,
  JavaScriptSession,
} from '@blue/data';

/** Generate the disk-profile CSD used by Java's "Generate CSD to Screen" action. */
export async function generateDiskCsdForScreen(
  data: Pick<BlueData, 'toDiskCSD' | 'toDiskCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  return javaRuntimeClient
    ? data.toDiskCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : data.toDiskCSD(javaScriptSession, layoutManifest);
}

/** Generate the API-backed realtime-profile CSD used by the realtime screen action. */
export async function generateRealtimeCsdForScreen(
  data: Pick<BlueData, 'toCSD' | 'toCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  return javaRuntimeClient
    ? data.toCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : data.toCSD(javaScriptSession, layoutManifest);
}
