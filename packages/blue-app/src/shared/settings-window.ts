export const SETTINGS_CLOSE_REQUEST_CHANNEL = 'settings:close-request';
export const SETTINGS_CLOSE_RESPONSE_CHANNEL = 'settings:close-response';
export const SETTINGS_CONFIRM_CLOSE_CHANNEL = 'settings:confirm-close';

export type SettingsCloseResolution = 'allow' | 'cancel';
export type SettingsClosePromptResponse = 'yes' | 'no' | 'cancel';
