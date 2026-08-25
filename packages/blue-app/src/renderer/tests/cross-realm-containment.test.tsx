// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { isEditableShortcutTarget } from '../components/workbench/panels/blue-live/LiveSpaceTab';
import { isEditableTarget } from '../components/workbench/panels/score-object/editors/PianoRollEditor';

// Second realm mirrors a Dockview popout window: its elements fail
// `instanceof HTMLElement` from this module's realm.
const popout = new JSDOM('<!doctype html><html><body><input id="in"><textarea id="ta"></textarea><div id="ce" contenteditable="true"></div></body></html>');
const popoutDoc = popout.window.document;

describe('realm-safe editable-target guards', () => {
  it('isEditableShortcutTarget recognizes popout-realm editable elements structurally', () => {
    const input = popoutDoc.getElementById('in')!;
    const textarea = popoutDoc.getElementById('ta')!;

    expect(isEditableShortcutTarget(input)).toBe(true);
    // jsdom does not implement isContentEditable, so the contenteditable div
    // resolves via its tagName path in these guards; TEXTAREA covers tagName
    // matching for a second element kind.
    expect(isEditableShortcutTarget(textarea)).toBe(true);
    expect(isEditableShortcutTarget(popoutDoc.body)).toBe(false);
    expect(isEditableShortcutTarget(null)).toBe(false);
    expect(isEditableShortcutTarget(popout.window)).toBe(false);
  });

  it('isEditableTarget recognizes popout-realm editable elements structurally', () => {
    const input = popoutDoc.getElementById('in')!;
    const textarea = popoutDoc.getElementById('ta')!;

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(popoutDoc.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('still recognizes main-realm editable elements', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(div)).toBe(false);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
  });
});
