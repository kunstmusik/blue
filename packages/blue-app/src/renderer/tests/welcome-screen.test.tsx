// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomeScreen from '../components/welcome/WelcomeScreen';
import { useSettingsStore } from '../stores/settings-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WelcomeScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useSettingsStore.setState({
      recentFiles: ['/Users/test/projects/my-piece.blue', 'C:\\Music\\demo.blue'],
      newProject: vi.fn(),
      openFile: vi.fn(),
      openRecentFile: vi.fn(),
      removeRecentFile: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders recent file items with filename and small full path in muted text without black background', () => {
    act(() => {
      root.render(<WelcomeScreen />);
    });

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.className).not.toContain('bg-black');

    const recentFilesHeading = container.querySelector('h2');
    expect(recentFilesHeading?.classList).toContain('text-role-title-3');
    expect(recentFilesHeading?.classList).toContain('font-semibold');

    // Filenames
    expect(container.textContent).toContain('my-piece.blue');
    expect(container.textContent).toContain('demo.blue');

    // Full paths
    expect(container.textContent).toContain('/Users/test/projects/my-piece.blue');
    expect(container.textContent).toContain('C:\\Music\\demo.blue');

    // Muted path class
    const pathSpans = container.querySelectorAll('span.text-role-callout.text-app-text-muted');
    expect(pathSpans.length).toBe(2);
    expect(pathSpans[0]?.textContent).toBe('/Users/test/projects/my-piece.blue');
    expect(pathSpans[1]?.textContent).toBe('C:\\Music\\demo.blue');
  });

  it('calls openRecentFile when clicking a file entry', () => {
    const openRecentMock = vi.fn();
    useSettingsStore.setState({ openRecentFile: openRecentMock });

    act(() => {
      root.render(<WelcomeScreen />);
    });

    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);

    act(() => {
      items[0]?.click();
    });

    expect(openRecentMock).toHaveBeenCalledWith('/Users/test/projects/my-piece.blue');
  });

  it('080: routes every recent entry through openRecentFile, including Windows-style paths', () => {
    const openRecentMock = vi.fn();
    useSettingsStore.setState({ openRecentFile: openRecentMock });

    act(() => {
      root.render(<WelcomeScreen />);
    });

    const items = container.querySelectorAll('li');
    act(() => {
      items[0]?.click();
      items[1]?.click();
    });

    expect(openRecentMock).toHaveBeenCalledTimes(2);
    expect(openRecentMock).toHaveBeenNthCalledWith(1, '/Users/test/projects/my-piece.blue');
    expect(openRecentMock).toHaveBeenNthCalledWith(2, 'C:\\Music\\demo.blue');
  });

  it('080: routes the Open button through the settings-store openFile action', () => {
    const openFileMock = vi.fn();
    useSettingsStore.setState({ openFile: openFileMock });

    act(() => {
      root.render(<WelcomeScreen />);
    });

    const openButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Open a .blue Project'));
    expect(openButton).toBeDefined();

    act(() => {
      openButton?.click();
    });

    expect(openFileMock).toHaveBeenCalledOnce();
  });

  it('calls removeRecentFile when clicking the delete button', () => {
    const removeRecentMock = vi.fn();
    useSettingsStore.setState({ removeRecentFile: removeRecentMock });

    act(() => {
      root.render(<WelcomeScreen />);
    });

    const buttons = container.querySelectorAll('li button');
    expect(buttons.length).toBe(2);

    act(() => {
      (buttons[0] as HTMLButtonElement)?.click();
    });

    expect(removeRecentMock).toHaveBeenCalledWith('/Users/test/projects/my-piece.blue');
  });
});
