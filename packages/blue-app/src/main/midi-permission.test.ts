import { describe, expect, it } from 'vitest';
import {
  decideMidiPermission,
  isSameApplicationLocation,
} from './midi-permission';

describe('MIDI permission policy', () => {
  it('allows both Electron MIDI labels for the trusted primary renderer', () => {
    expect(decideMidiPermission({ permission: 'midi', isPrimary: true, isTrustedLocation: true })).toBe(true);
    expect(decideMidiPermission({ permission: 'midiSysex', isPrimary: true, isTrustedLocation: true })).toBe(true);
  });

  it('denies MIDI outside the trusted primary renderer', () => {
    expect(decideMidiPermission({ permission: 'midi', isPrimary: false, isTrustedLocation: true })).toBe(false);
    expect(decideMidiPermission({ permission: 'midiSysex', isPrimary: true, isTrustedLocation: false })).toBe(false);
  });

  it('preserves existing local-fonts behavior', () => {
    expect(decideMidiPermission({ permission: 'local-fonts', isPrimary: false, isTrustedLocation: false })).toBe(true);
  });

  it('denies all other permissions', () => {
    expect(decideMidiPermission({ permission: 'clipboard-read', isPrimary: true, isTrustedLocation: true })).toBe(false);
    expect(decideMidiPermission({ permission: 'unknown', isPrimary: true, isTrustedLocation: true })).toBe(false);
  });

  it('matches the current file document or current development origin', () => {
    expect(isSameApplicationLocation('file:///app/renderer/index.html#score', 'file:///app/renderer/index.html')).toBe(true);
    expect(isSameApplicationLocation('file:///tmp/other.html', 'file:///app/renderer/index.html')).toBe(false);
    expect(isSameApplicationLocation('http://localhost:5173/settings', 'http://localhost:5173/')).toBe(true);
    expect(isSameApplicationLocation('https://example.com/', 'http://localhost:5173/')).toBe(false);
  });
});
