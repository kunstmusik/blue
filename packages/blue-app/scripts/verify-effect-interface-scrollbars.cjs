/**
 * Run after build:renderer with pnpm --filter @blue/app verify:effect-interface-scrollbars.
 * A disposable Electron profile and classic scrollbars exercise the complete popup
 * page, including display scaling and Chromium page zoom, without launching Blue.
 */
const electron = require('electron');

if (process.type === 'renderer') {
  const knob = {
    id: 'knob',
    type: 'BSBKnob',
    objectName: 'gain',
    x: 20,
    y: 20,
    width: 60,
    height: 76,
    value: 0.5,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: { knobWidth: 60, labelEnabled: false },
    children: [],
  };
  const snapshot = {
    effectId: 'effect',
    ownerType: 'library',
    name: 'Scrollbar regression',
    effectXml: '',
    enabled: true,
    numIns: 1,
    numOuts: 1,
    style: 'CLASSIC',
    code: '',
    comments: '',
    editEnabled: false,
    objectNames: ['gain'],
    widgets: [],
    udos: [],
    projectUdos: [],
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
    widgetTree: {
      ...knob,
      id: 'root',
      type: 'BSBRootGroup',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      properties: {},
      children: [knob],
    },
  };
  electron.contextBridge.exposeInMainWorld('blueAPI', {
    getEffectEditorDocument: async () => snapshot,
  });
} else {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { app, BrowserWindow } = electron;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-effect-scrollbars-'));
  app.setPath('userData', profile);
  app.commandLine.appendSwitch('force-device-scale-factor', '1.25');

  app.whenReady().then(async () => {
    const window = new BrowserWindow({
      show: false,
      webPreferences: { preload: __filename, contextIsolation: true, backgroundThrottling: false },
    });
    try {
      await window.loadFile(path.join(__dirname, '../dist/renderer/effect-editor.html'), {
        query: { ownerType: 'library', effectId: 'effect', mode: 'interface' },
      });
      await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        let attempts = 0;
        const poll = () => {
          if (document.querySelector('[data-shortcut-scope="bsb-interface-canvas"]')) return resolve();
          if (++attempts > 100) return reject(new Error('Effect interface did not load'));
          setTimeout(poll, 20);
        };
        poll();
      })`);
      await window.webContents.executeJavaScript(`(() => {
        const style = document.createElement('style');
        style.textContent = '* { scrollbar-width:auto !important; scrollbar-color:auto !important; } ::-webkit-scrollbar { width:16px; height:16px; }';
        document.head.appendChild(style);
      })()`);

      for (const zoom of [1, 1.1, 1.2, 1.3, 0.9, 2]) {
        window.webContents.setZoomFactor(zoom);
        for (const [width, height] of [
          [40, 40],
          [460, 560],
          [461, 561],
          [1280, 960],
          [1281, 961],
        ]) {
          window.setContentSize(width, height);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const frames = await window.webContents.executeJavaScript(`(async () => {
            const viewport = document.querySelector('[data-shortcut-scope="bsb-interface-canvas"]');
            viewport.scrollLeft = 20;
            viewport.scrollTop = 20;
            const frames = [];
            for (let frame = 0; frame < 8; frame++) {
              await new Promise(resolve => requestAnimationFrame(resolve));
              frames.push({ clientWidth: viewport.clientWidth, clientHeight: viewport.clientHeight,
                scrollWidth: viewport.scrollWidth, scrollHeight: viewport.scrollHeight,
                width: viewport.offsetWidth, height: viewport.offsetHeight,
                scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop });
            }
            return frames;
          })()`);
          for (const frame of frames) {
            const context = JSON.stringify({
              zoom,
              contentWidth: width,
              contentHeight: height,
              ...frame,
            });
            if (width === 40) {
              assert.ok(frame.scrollWidth > frame.clientWidth, context);
              assert.ok(frame.scrollHeight > frame.clientHeight, context);
              assert.ok(frame.width > frame.clientWidth, 'Classic scrollbar gutter required');
              assert.ok(frame.scrollLeft > 0 && frame.scrollTop > 0, context);
            } else {
              assert.equal(frame.scrollWidth, frame.clientWidth, context);
              assert.equal(frame.scrollHeight, frame.clientHeight, context);
              assert.equal(frame.width, frame.clientWidth, context);
              assert.equal(frame.height, frame.clientHeight, context);
            }
          }
        }
      }
      console.log(
        'Effect interface scrollbars: real overflow scrolls; fitting content stays stable.',
      );
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      window.destroy();
      app.exit(process.exitCode ?? 0);
    }
  });
}
