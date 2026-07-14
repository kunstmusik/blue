// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OscSettings from '../components/settings/OscSettings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<{ root: Root; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function renderPanel(props: Partial<React.ComponentProps<typeof OscSettings>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  act(() => {
    root.render(
      <OscSettings
        settings={{ preferredPort: 8000 }}
        runtime={{
          phase: 'listening',
          preferredPort: 8000,
          activePort: 8001,
          fallbackFrom: 8000,
          lastBindError: null,
          lastPacketError: null,
          revision: 1,
          updatedAt: new Date().toISOString(),
        }}
        onChange={onChange}
        {...props}
      />,
    );
  });
  roots.push({ root, container });
  return { container, onChange };
}

describe('OscSettings', () => {
  it('shows a fallback active port without exposing deprecated output settings', () => {
    const { container } = renderPanel();
    expect(container.textContent).toContain('Preferred Server Port');
    expect(container.textContent).toContain('Active port: 8001');
    expect(container.textContent).toContain('fallback port 8001');
    expect(container.textContent).not.toContain('OSC Output Host');
    expect(container.textContent).not.toContain('OSC Output Port');
  });

  it('renders the complete command registry as grouped message and description rows', () => {
    const { container } = renderPanel();
    expect(container.textContent).toContain('Supported OSC Messages');
    expect(container.textContent).toContain('Score');
    expect(container.textContent).toContain('Blue Live');
    expect(container.querySelectorAll('[data-osc-command]')).toHaveLength(8);
    expect(container.textContent).toContain('/score/play');
    expect(container.textContent).toContain('Start a fresh regular-score performance.');
    expect(container.textContent).toContain('/blueLive/allNotesOff');
    expect(container.textContent).toContain('Send all-notes-off to the active Blue Live session.');
  });

  it('reports invalid drafted ports through the field state', () => {
    const { container } = renderPanel({ settings: { preferredPort: 0 } });
    expect(container.textContent).toContain('Enter a whole port number from 1 through 65535');
  });

  it('passes a changed numeric preferred port to the Settings draft', () => {
    const { container, onChange } = renderPanel();
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '9100');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ preferredPort: 9100 });
  });
});
