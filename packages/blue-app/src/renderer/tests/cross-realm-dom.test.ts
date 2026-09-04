// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { containsNode, isEventInsidePortalPopup, isNodeLike } from '../utils/cross-realm-dom';

describe('cross-realm DOM utilities', () => {
  const popout = new JSDOM(
    '<!doctype html><html><body><div id="menu"><button id="item"></button></div><div id="outside"></div></body></html>',
  );
  const popoutDoc = popout.window.document;
  const menu = popoutDoc.getElementById('menu')!;
  const item = popoutDoc.getElementById('item')!;
  const outside = popoutDoc.getElementById('outside')!;

  it('classifies foreign-realm nodes as node-like', () => {
    expect(isNodeLike(menu)).toBe(true);
    expect(isNodeLike(item)).toBe(true);
  });

  it('rejects non-node event targets', () => {
    expect(isNodeLike(null)).toBe(false);
    expect(isNodeLike(popout.window)).toBe(false);
    expect(isNodeLike({ nodeType: 1 } as unknown as EventTarget)).toBe(false);
    expect(isNodeLike({ contains: () => true } as unknown as EventTarget)).toBe(false);
  });

  it('performs containment tree walks on foreign-realm subtrees', () => {
    expect(containsNode(menu, item)).toBe(true);
    expect(containsNode(menu, menu)).toBe(true);
    expect(containsNode(menu, outside)).toBe(false);
    expect(containsNode(null, item)).toBe(false);
    expect(containsNode(menu, null)).toBe(false);
  });

  it('detects portal popup targets structurally across realms', () => {
    const host = popoutDoc.createElement('div');
    const content = popoutDoc.createElement('div');
    content.setAttribute('role', 'menu');
    const menuItem = popoutDoc.createElement('div');
    menuItem.setAttribute('role', 'menuitem');
    content.appendChild(menuItem);
    host.appendChild(content);

    expect(isEventInsidePortalPopup(menuItem)).toBe(true);
    expect(isEventInsidePortalPopup(content)).toBe(true);
    expect(isEventInsidePortalPopup(outside)).toBe(false);
    expect(isEventInsidePortalPopup(null)).toBe(false);
  });
});
