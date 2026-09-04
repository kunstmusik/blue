/** Testable Web MIDI policy used by the Electron session handlers. */

export type MidiPermissionName = 'midi' | 'midiSysex' | 'local-fonts' | string;

export interface MidiPermissionContext {
  permission: MidiPermissionName;
  isPrimary: boolean;
  isTrustedLocation: boolean;
}

/**
 * Electron 35 labels requestMIDIAccess({ sysex: false }) as `midiSysex` in the
 * request handler. Both MIDI labels therefore have to be accepted here. The
 * caller restricts this decision to Blue's trusted primary renderer, whose
 * request hardcodes sysex:false and verifies the returned access state.
 */
export function decideMidiPermission(ctx: MidiPermissionContext): boolean {
  if (ctx.permission === 'local-fonts') return true;
  return (
    ctx.isPrimary &&
    ctx.isTrustedLocation &&
    (ctx.permission === 'midi' || ctx.permission === 'midiSysex')
  );
}

export function isSameApplicationLocation(requestingUrl: string, applicationUrl: string): boolean {
  try {
    const requesting = new URL(requestingUrl);
    const application = new URL(applicationUrl);
    if (application.protocol === 'file:') {
      return (
        requesting.protocol === 'file:' &&
        requesting.hostname === application.hostname &&
        requesting.pathname === application.pathname
      );
    }
    return requesting.origin === application.origin;
  } catch {
    return false;
  }
}
