// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissingAudioAssetsModal from '../components/workbench/panels/MissingAudioAssetsModal';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MockProjectState {
  missingAudioSession: MissingAudioAssetsSession | null;
  setMissingAudioSession: (session: MissingAudioAssetsSession | null) => void;
  applyMissingAudioResolvedSnapshot: (snapshot: unknown) => void;
}

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    missingAudioSession: null as MissingAudioAssetsSession | null,
    setMissingAudioSession: vi.fn((session: MissingAudioAssetsSession | null) => {
      mockProjectState.missingAudioSession = session;
    }),
    applyMissingAudioResolvedSnapshot: vi.fn(),
  } satisfies MockProjectState,
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) =>
    selector(mockProjectState),
}));

interface BlueApiMock {
  chooseMissingAudioReplacement: ReturnType<typeof vi.fn>;
  resolveMissingAudioAssets: ReturnType<typeof vi.fn>;
  dismissMissingAudioAssets: ReturnType<typeof vi.fn>;
}

function makeSession(rows: Array<{ originalPath: string; replacementPath?: string }>): MissingAudioAssetsSession {
  return {
    sessionId: 'sess-1',
    projectSessionId: 1,
    projectFilePath: '/proj/test.blue',
    missingFiles: rows.map((r) => ({
      originalPath: r.originalPath,
      replacementPath: r.replacementPath ?? '',
    })),
  };
}

describe('MissingAudioAssetsModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let blueAPI: BlueApiMock;

  beforeEach(() => {
    mockProjectState.missingAudioSession = null;
    mockProjectState.setMissingAudioSession.mockClear();
    mockProjectState.applyMissingAudioResolvedSnapshot.mockClear();
    blueAPI = {
      chooseMissingAudioReplacement: vi.fn(),
      resolveMissingAudioAssets: vi.fn(),
      dismissMissingAudioAssets: vi.fn().mockResolvedValue({ ok: true }),
    };
    Object.assign(window, { blueAPI });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (window as Window & { blueAPI?: BlueApiMock }).blueAPI;
    vi.clearAllMocks();
  });

  function renderModal(): void {
    act(() => {
      root.render(React.createElement(MissingAudioAssetsModal));
    });
  }

  it('renders nothing when there is no active session', () => {
    renderModal();
    expect(container.textContent).toBe('');
  });

  it('renders one row per unique missing original path', () => {
    mockProjectState.missingAudioSession = makeSession([
      { originalPath: 'a.wav' },
      { originalPath: 'b.wav' },
    ]);
    renderModal();
    expect(container.textContent).toContain('a.wav');
    expect(container.textContent).toContain('b.wav');
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('Browse calls the choose-replacement IPC and shows the selected path', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'missing.wav' }]);
    blueAPI.chooseMissingAudioReplacement.mockResolvedValue('/chosen/replacement.wav');
    renderModal();

    await act(async () => {
      const browseButton = [...container.querySelectorAll('button')].find((b) =>
        b.textContent === 'Browse',
      )!;
      browseButton.click();
      await Promise.resolve();
    });

    expect(blueAPI.chooseMissingAudioReplacement).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      originalPath: 'missing.wav',
      currentReplacementPath: undefined,
    });
    expect(
      container.querySelector('[data-testid="replacement-missing.wav"]')?.textContent,
    ).toContain('/chosen/replacement.wav');
  });

  it('OK with no replacements resolves as a no-op and clears the session without applying a snapshot', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    blueAPI.resolveMissingAudioAssets.mockResolvedValue({ ok: true, changed: false });
    renderModal();

    await act(async () => {
      const okButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'OK')!;
      okButton.click();
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      replacements: [{ originalPath: 'a.wav', replacementPath: '' }],
    });
    expect(mockProjectState.applyMissingAudioResolvedSnapshot).not.toHaveBeenCalled();
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('OK with replacements applies the refreshed snapshot and marks the session cleared', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    blueAPI.chooseMissingAudioReplacement.mockResolvedValue('/new.wav');
    blueAPI.resolveMissingAudioAssets.mockResolvedValue({
      ok: true,
      changed: true,
      project: { sessionId: 1 },
    });
    renderModal();

    await act(async () => {
      ([...container.querySelectorAll('button')].find((b) => b.textContent === 'Browse')!).click();
      await Promise.resolve();
    });
    await act(async () => {
      ([...container.querySelectorAll('button')].find((b) => b.textContent === 'OK')!).click();
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      replacements: [{ originalPath: 'a.wav', replacementPath: '/new.wav' }],
    });
    expect(mockProjectState.applyMissingAudioResolvedSnapshot).toHaveBeenCalledWith({ sessionId: 1 });
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('Cancel dismisses the session without resolving and leaves the project unchanged', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    renderModal();

    await act(async () => {
      ([...container.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!).click();
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).not.toHaveBeenCalled();
    expect(blueAPI.dismissMissingAudioAssets).toHaveBeenCalledWith({ sessionId: 'sess-1' });
    expect(mockProjectState.applyMissingAudioResolvedSnapshot).not.toHaveBeenCalled();
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('Escape dismisses the session without changes', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    renderModal();

    await act(async () => {
      const overlay = container.querySelector('.fixed.inset-0') as HTMLElement;
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).not.toHaveBeenCalled();
    expect(blueAPI.dismissMissingAudioAssets).toHaveBeenCalledWith({ sessionId: 'sess-1' });
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('overlay click (background only) dismisses the session without changes', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    renderModal();

    await act(async () => {
      const overlay = container.querySelector('.fixed.inset-0') as HTMLElement;
      overlay.click();
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).not.toHaveBeenCalled();
    expect(blueAPI.dismissMissingAudioAssets).toHaveBeenCalledWith({ sessionId: 'sess-1' });
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('stale resolve result clears the session without applying a snapshot', async () => {
    mockProjectState.missingAudioSession = makeSession([{ originalPath: 'a.wav' }]);
    blueAPI.resolveMissingAudioAssets.mockResolvedValue({ ok: false, changed: false, stale: true });
    renderModal();

    await act(async () => {
      ([...container.querySelectorAll('button')].find((b) => b.textContent === 'OK')!).click();
      await Promise.resolve();
    });

    expect(mockProjectState.applyMissingAudioResolvedSnapshot).not.toHaveBeenCalled();
    expect(mockProjectState.setMissingAudioSession).toHaveBeenCalledWith(null);
  });

  it('partial resolution sends only mapped rows and leaves unmapped rows empty', async () => {
    mockProjectState.missingAudioSession = makeSession([
      { originalPath: 'one.wav' },
      { originalPath: 'two.wav' },
    ]);
    blueAPI.chooseMissingAudioReplacement.mockResolvedValue('/fixed-one.wav');
    blueAPI.resolveMissingAudioAssets.mockResolvedValue({ ok: true, changed: true, project: {} });
    renderModal();

    const buttons = () => [...container.querySelectorAll('button')];

    await act(async () => {
      (buttons().find((b) => b.textContent === 'Browse')!).click();
      await Promise.resolve();
    });

    await act(async () => {
      (buttons().find((b) => b.textContent === 'OK')!).click();
      await Promise.resolve();
    });

    expect(blueAPI.resolveMissingAudioAssets).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      replacements: [
        { originalPath: 'one.wav', replacementPath: '/fixed-one.wav' },
        { originalPath: 'two.wav', replacementPath: '' },
      ],
    });
  });
});
