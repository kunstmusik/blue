import '../styles/index.css';

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  container.style.width = '240px';
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it('sizes the Add Instrument menu to its labels instead of the host viewport', async () => {
  const onOrchestraPatch = vi.fn();
  act(() => {
    root.render(
      <HostDocumentContext.Provider value={document}>
        <ArrangementPanel
          rows={[]}
          selectedAssignmentId={null}
          onSelectAssignment={vi.fn()}
          onOrchestraPatch={onOrchestraPatch}
          projectSessionId={1}
          projectRevision={1}
        />
      </HostDocumentContext.Provider>,
    );
  });
  const trigger = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === '+ Add',
  )!;
  act(() => trigger.click());

  const menu = document.querySelector<HTMLElement>('[data-host-surface][role="menu"]')!;
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(getComputedStyle(menu).visibility).toBe('visible');
  });
  const items = [...menu.querySelectorAll('button')];
  expect(items).toHaveLength(5);
  const longestLabel = Math.max(
    ...items.map((item) => {
      const range = document.createRange();
      range.selectNodeContents(item);
      return range.getBoundingClientRect().width;
    }),
  );
  const width = menu.getBoundingClientRect().width;
  expect(width).toBeGreaterThanOrEqual(180);
  expect(width).toBeLessThanOrEqual(Math.max(180, longestLabel + 26) + 1);
  for (const item of items) {
    expect(item.getBoundingClientRect().width).toBeCloseTo(width - 2, 0);
  }
  act(() => items[0].click());
  expect(onOrchestraPatch).toHaveBeenCalledWith({
    type: 'addInstrument',
    instrumentType: 'generic',
  });
  expect(document.querySelector('[data-host-surface]')).toBeNull();
});
