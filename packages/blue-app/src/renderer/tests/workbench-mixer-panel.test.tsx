import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAuxiliaryLayoutState } from '../components/workbench/auxiliary-layout';
import { useWorkbenchStore } from '../stores/workbench-store';

function createMixerPanelApiStub() {
  function createEdgeGroup(id: string, width: number, height: number, activePanel?: unknown) {
    return {
      id,
      size: id === 'blue-aux-edge-bottom' ? height : width,
      panels: activePanel ? [activePanel] : [],
      activePanel,
      api: {
        isMaximized: () => false,
      },
      element: {
        getBoundingClientRect: () => ({
          width,
          height,
        }),
      },
    };
  }

  const existingPanel = {
    api: {
      setActive: vi.fn(),
      isMaximized: () => false,
    },
    group: {
      focus: vi.fn(),
      panels: [] as Array<{ id?: string }>,
      activePanel: undefined as unknown,
      api: {
        location: {
          type: 'grid',
        },
      },
    },
  };
  existingPanel.group.panels = [existingPanel];
  existingPanel.group.activePanel = existingPanel;

  const getPanel = vi.fn((panelId: string) =>
    panelId === 'MixerTopComponent' ? existingPanel : undefined,
  );
  const addPanel = vi.fn();
  const groups = [
    createEdgeGroup('blue-aux-edge-left', 360, 228),
    createEdgeGroup('blue-aux-edge-right', 360, 228),
    createEdgeGroup('blue-aux-edge-bottom', 228, 228, existingPanel),
  ];

  return {
    api: {
      getPanel,
      addPanel,
      groups,
    } as never,
    existingPanel,
    getPanel,
    addPanel,
  };
}

afterEach(() => {
  useWorkbenchStore.setState({
    api: null,
    auxiliary: createDefaultAuxiliaryLayoutState(),
  });
});

describe('MixerTopComponent workbench routing', () => {
  it('focuses an existing MixerTopComponent panel when opened', () => {
    const { api, existingPanel, getPanel, addPanel } = createMixerPanelApiStub();
    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });
    const outputGroup = useWorkbenchStore
      .getState()
      .auxiliary.groups.find((group) => group.seedGroupId === 'output-main')!;
    outputGroup.panelIds = ['MixerTopComponent'];
    outputGroup.dockedPanelIds = ['MixerTopComponent'];

    useWorkbenchStore.getState().openPanel('MixerTopComponent');

    expect(getPanel).toHaveBeenCalledWith('MixerTopComponent');
    expect(existingPanel.api.setActive).toHaveBeenCalledTimes(1);
    expect(existingPanel.group.focus).toHaveBeenCalledTimes(1);
    expect(addPanel).not.toHaveBeenCalled();
  });

  it('focuses an existing MixerTopComponent panel when focused directly', () => {
    const { api, existingPanel, getPanel, addPanel } = createMixerPanelApiStub();
    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });
    const outputGroup = useWorkbenchStore
      .getState()
      .auxiliary.groups.find((group) => group.seedGroupId === 'output-main')!;
    outputGroup.panelIds = ['MixerTopComponent'];
    outputGroup.dockedPanelIds = ['MixerTopComponent'];

    useWorkbenchStore.getState().focusPanel('MixerTopComponent');

    expect(getPanel).toHaveBeenCalledWith('MixerTopComponent');
    expect(existingPanel.api.setActive).toHaveBeenCalledTimes(1);
    expect(existingPanel.group.focus).toHaveBeenCalledTimes(1);
    expect(addPanel).not.toHaveBeenCalled();
  });
});
