import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DockviewReact, type DockviewApi } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyAuxiliaryLayout,
  createDefaultAuxiliaryLayoutState,
} from '../components/workbench/auxiliary-layout';

describe('Dockview left auxiliary restoration', () => {
  let host: HTMLDivElement;
  let root: Root;

  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  beforeEach(() => {
    host = document.createElement('div');
    host.style.width = '1200px';
    host.style.height = '800px';
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('recreates a left auxiliary group at its saved pixel width', async () => {
    let api: DockviewApi | undefined;
    await act(async () => {
      root.render(
        <DockviewReact
          components={{ default: () => <div /> }}
          onReady={(event) => {
            api = event.api;
          }}
        />,
      );
    });

    const state = createDefaultAuxiliaryLayoutState();
    const properties = state.groups.find((group) => group.seedGroupId === 'properties-main')!;
    properties.edge = 'left';
    properties.panelIds = ['LibrariesTopComponent'];
    properties.dockedPanelIds = ['LibrariesTopComponent'];
    properties.activePanelId = 'LibrariesTopComponent';
    properties.dockedSize = 360;

    await act(async () => {
      api!.layout(1200, 800);
      api!.addPanel({
        id: 'ScoreTopComponent',
        component: 'default',
        title: 'Score',
      });
      applyAuxiliaryLayout(api!, state);
      api!.layout(1200, 800);
    });

    const leftGroup = api!.groups.find((group) => group.id === 'blue-aux-edge-left')!;
    expect(leftGroup.element.getBoundingClientRect().width).toBeCloseTo(360, 0);
  });
});
