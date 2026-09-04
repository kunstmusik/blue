import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  GenericInstrumentSnapshot,
  JavaScriptInstrumentSnapshot,
  PythonInstrumentSnapshot,
  UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import BlueSynthBuilderEditor from '../components/workbench/panels/orchestra/BlueSynthBuilderEditor';
import GenericInstrumentEditor from '../components/workbench/panels/orchestra/GenericInstrumentEditor';
import JavaScriptInstrumentEditor from '../components/workbench/panels/orchestra/JavaScriptInstrumentEditor';
import PythonInstrumentEditor from '../components/workbench/panels/orchestra/PythonInstrumentEditor';

function udoSnapshot(name: string): UdoDefinitionSnapshot {
  return {
    name,
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    code: '',
    comments: '',
  };
}

describe('Orchestra code instrument editors', () => {
  it('renders GenericInstrument code tabs with Csound editor metadata', () => {
    const instrument: GenericInstrumentSnapshot = {
      assignmentId: '1',
      type: 'generic',
      name: 'Lead',
      enabled: true,
      comment: '',
      text: 'aout oscili p4, p5',
      globalOrc: 'gi1 ftgen 0, 0, 1024, 10, 1',
      globalSco: '',
      udolist: [],
    };

    const html = renderToStaticMarkup(
      <GenericInstrumentEditor
        instrument={instrument}
        onInstrumentPatch={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Instrument');
    expect(html).toContain('UDO');
    expect(html).toContain('Global Orc');
    expect(html).toContain('data-editor-language="csound-orc"');
    expect(html).toContain('aout oscili');
    expect((html.match(/data-editor-language="csound-orc"/g) ?? []).length).toBe(3);
  });

  it('renders JavaScriptInstrument text editing surface', () => {
    const instrument: JavaScriptInstrumentSnapshot = {
      assignmentId: '2',
      type: 'javascript',
      name: 'Script',
      enabled: true,
      comment: '',
      text: 'instrument = "aout oscili 0.2, 440"',
      globalOrc: '',
      globalSco: '',
      udolist: [],
    };

    const html = renderToStaticMarkup(
      <JavaScriptInstrumentEditor
        instrument={instrument}
        onInstrumentPatch={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Script');
    expect(html).toContain('UDO');
    expect(html).toContain('Global Orc');
    expect(html).toContain('instrument = &quot;aout oscili 0.2, 440&quot;');
    expect((html.match(/data-editor-language="csound-orc"/g) ?? []).length).toBe(2);
  });

  it('renders BlueSynthBuilder code and interface entry points', () => {
    const instrument: BlueSynthBuilderInstrumentSnapshot = {
      assignmentId: '3',
      type: 'blueSynthBuilder',
      name: 'Builder',
      enabled: true,
      comment: '',
      instrumentText: 'aout oscili <amp>, <freq>',
      alwaysOnInstrumentText: '',
      globalOrc: '',
      globalSco: '',
      objectNames: ['amp', 'freq'],
      widgets: [
        { objectName: 'amp', widgetType: 'BSBKnob', value: 0.5, minimum: 0, maximum: 1 },
        { objectName: 'freq', widgetType: 'BSBValue', value: 440, minimum: 20, maximum: 20000 },
      ],
      editEnabled: true,
      gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10 },
      widgetTree: {
        id: 'root',
        type: 'BSBRootGroup',
        objectName: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        value: 0,
        minimum: 0,
        maximum: 0,
        editable: true,
        properties: {},
        children: [
          {
            id: 'w1',
            type: 'BSBKnob',
            objectName: 'amp',
            x: 0,
            y: 0,
            width: 60,
            height: 60,
            value: 0.5,
            minimum: 0,
            maximum: 1,
            editable: true,
            properties: {},
          },
          {
            id: 'w2',
            type: 'BSBValue',
            objectName: 'freq',
            x: 0,
            y: 0,
            width: 60,
            height: 24,
            value: 440,
            minimum: 20,
            maximum: 20000,
            editable: true,
            properties: {},
          },
        ],
      },
      udolist: [],
    };

    const html = renderToStaticMarkup(
      <BlueSynthBuilderEditor
        instrument={instrument}
        onInstrumentPatch={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Builder');
    expect(html).toContain('Code');
    expect(html).toContain('Interface');
    expect(html).toContain('UDO');
    expect(html).toContain('aout oscili');

    const editorTabs = [...html.matchAll(/data-bsb-editor-tab="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(editorTabs).toEqual(['interface', 'code', 'udo']);
  });

  describe('UDO completion scope (US1)', () => {
    it('Generic Instrument receives owner-plus-project UDO scope in orchestra fields', () => {
      const instrument: GenericInstrumentSnapshot = {
        assignmentId: '1',
        type: 'generic',
        name: 'Lead',
        enabled: true,
        comment: '',
        text: '',
        globalOrc: '',
        globalSco: '',
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <GenericInstrumentEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      // The Instrument and Global Orc fields (2 orchestra editors) receive
      // owner-plus-project scope; Global Sco receives none.
      const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
      expect(scopes.filter((scope) => scope === '1:1').length).toBe(2);
      expect(scopes.filter((scope) => scope === '0:0').length).toBe(1);
    });

    it('Generic Instrument Global Sco field receives no context-aware UDO scope', () => {
      const instrument: GenericInstrumentSnapshot = {
        assignmentId: '1',
        type: 'generic',
        name: 'Lead',
        enabled: true,
        comment: '',
        text: '',
        globalOrc: '',
        globalSco: 'f1 0 8192 10 1',
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <GenericInstrumentEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      // Global Sco carries score code and must not receive UDO collections.
      expect(html).toContain('data-udo-scope="0:0"');
    });

    it('JavaScript Instrument Global Orc receives owner-plus-project scope; JavaScript source stays excluded', () => {
      const instrument: JavaScriptInstrumentSnapshot = {
        assignmentId: '2',
        type: 'javascript',
        name: 'Script',
        enabled: true,
        comment: '',
        text: 'instrument = "aout oscili"',
        globalOrc: '',
        globalSco: '',
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <JavaScriptInstrumentEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      // Global Orc (the only orchestra field) receives owner-plus-project scope.
      const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
      expect(scopes).toContain('1:1');
      // JavaScript source is a plain textarea, not a SelectedCodeEditor.
      expect(html).toContain('textarea');
    });

    it('Python Instrument Global Orc receives owner-plus-project scope; Python source stays excluded from Csound UDO autocompletion', () => {
      const instrument: PythonInstrumentSnapshot = {
        assignmentId: '3',
        type: 'python',
        name: 'Python',
        enabled: true,
        comment: '',
        text: 'instrument = "aout oscili"',
        globalOrc: '',
        globalSco: '',
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <PythonInstrumentEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      // Global Orc receives owner-plus-project scope (1:1)
      const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
      expect(scopes).toContain('1:1');
      // Python and Global Sco editors have scope 0:0
      expect(scopes.filter((scope) => scope === '0:0').length).toBe(2);
    });
  });
});
