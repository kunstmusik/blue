export const APP_METADATA_GET_CHANNEL = 'app-metadata:get';
export const ABOUT_WINDOW_CLOSE_CHANNEL = 'about:close';

export type AppBuildChannel = 'development' | 'stable' | 'unknown';

export interface AppRuntimeVersions {
  electron: string;
  chromium: string;
  node: string;
}

export interface AppMetadata {
  version: string;
  sourceRevision: string;
  buildDate: string;
  channel: AppBuildChannel;
  runtime: AppRuntimeVersions;
}