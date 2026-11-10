import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import SelectedCodeEditor from '../components/workbench/panels/editors/SelectedCodeEditor';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * T059: a floated panel containing a code editor painted as a blank window.
 * CodeMirror appends its themed tooltip container to the hosting body; the
 * editor theme's root rule made that container fill the body above Dockview's
 * absolutely positioned popout root.
 */
describe('SelectedCodeEditor tooltip container in a hosting document (T059)', () => {
  let root: Root | null = null;
  let iframe: HTMLIFrameElement | null = null;

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    iframe?.remove();
    iframe = null;
  });

  it('does not let the tooltip container cover a popout root', async () => {
    iframe = document.createElement('iframe');
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    document.body.appendChild(iframe);
    const hostDocument = iframe.contentDocument!;
    hostDocument.body.style.margin = '0';
    // Mirror the main window's stylesheets so CSS variables and CodeMirror's
    // style-mod rules resolve in the hosting document as in a Dockview popout.
    for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      hostDocument.head.appendChild(node.cloneNode(true));
    }
    const popoutRoot = hostDocument.createElement('div');
    popoutRoot.id = 'dv-popout-window';
    Object.assign(popoutRoot.style, { position: 'absolute', inset: '0' });
    hostDocument.body.appendChild(popoutRoot);
    const mount = hostDocument.createElement('div');
    mount.style.height = '300px';
    popoutRoot.appendChild(mount);

    root = createRoot(mount);
    await act(async () => {
      root!.render(
        <HostDocumentContext.Provider value={hostDocument}>
          <SelectedCodeEditor value="instr 1\nendin" ariaLabel="floated" onChange={() => {}} />
        </HostDocumentContext.Provider>,
      );
    });

    const editor = mount.querySelector<HTMLElement>('.cm-editor');
    expect(editor).not.toBeNull();
    const tooltipContainers = Array.from(hostDocument.body.children).filter(
      (child): child is HTMLElement => child !== popoutRoot && child.tagName === 'DIV',
    );
    expect(tooltipContainers.length).toBeGreaterThan(0);
    for (const container of tooltipContainers) {
      expect(container.getBoundingClientRect().height).toBe(0);
    }
    const hit = hostDocument.elementFromPoint(400, 150);
    expect(popoutRoot.contains(hit)).toBe(true);
    // The editor itself still receives the theme's sizing and surface.
    expect(editor!.getBoundingClientRect().height).toBe(300);
  });
});
