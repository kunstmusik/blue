import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BlueSynthBuilder } from '@blue/data';
import { Element } from '@blue/data';
import {
  collectBsbReplacementKeysFromSnapshotTree,
  createDefaultBsbWidgetSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
  type BsbWidgetNodeSnapshot,
  type UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import BSBCodeEditor from '../components/workbench/panels/orchestra/bsb/BSBCodeEditor';
import BSBInterfaceEditor from '../components/workbench/panels/orchestra/bsb/BSBInterfaceEditor';
import { createBsbReplacementKeys } from '../components/workbench/panels/orchestra/bsb/bsb-completions';

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

const BSB_INSTRUMENT: BlueSynthBuilderInstrumentSnapshot = {
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
  editEnabled: false,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
  widgetTree: {
    id: 'root', type: 'BSBRootGroup', objectName: '',
    x: 0, y: 0, width: 0, height: 0,
    value: 0, minimum: 0, maximum: 0,
    editable: true, properties: {},
    children: [
      { id: 'w1', type: 'BSBKnob', objectName: 'amp', x: 0, y: 0, width: 60, height: 60, value: 0.5, minimum: 0, maximum: 1, editable: true, properties: {} },
      { id: 'w2', type: 'BSBValue', objectName: 'freq', x: 70, y: 0, width: 60, height: 24, value: 440, minimum: 20, maximum: 20000, editable: true, properties: {} },
    ],
  },
};

describe('BlueSynthBuilder editor', () => {
  it('generates instrument text with BSB widget replacement values', () => {
    const instrument = BlueSynthBuilder.loadFromXML(
      Element.parse(`<instrument type="blue.orchestra.BlueSynthBuilder">
        <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
        <graphicInterface>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
            <objectName>amp</objectName>
            <value>0.25</value>
          </bsbObject>
        </graphicInterface>
        <opcodeList/>
      </instrument>`),
    );

    expect(instrument.generateInstrument()).toBe('aout oscili 0.25, 440');
  });

  it('maps BSB object names into Java Blue replacement completion keys', () => {
    expect(createBsbReplacementKeys(['amp'])).toEqual([
      { key: 'amp', objectType: 'BSB object' },
    ]);
  });

  it('renders BSB code editor tabs', () => {
    const html = renderToStaticMarkup(
      <BSBCodeEditor
        instrument={BSB_INSTRUMENT}
        onInstrumentPatch={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Always On');
    expect(html).toContain('Global Sco');
    expect(html).toContain('aout oscili');
    expect((html.match(/data-editor-language="csound-orc"/g) ?? []).length).toBe(4);
  });

  it('renders BSB interface editor with preset bar and edit mode toggle', () => {
    const html = renderToStaticMarkup(
      <BSBInterfaceEditor instrument={BSB_INSTRUMENT} onInstrumentPatch={vi.fn()} />,
    );

    expect(html).toContain('Edit Mode');
    expect(html).toContain('Presets');
  });

  it('collects canonical BSB replacement keys from snapshot trees', () => {
    const xy = createDefaultBsbWidgetSnapshot('BSBXYController')!;
    xy.id = 'xy-1';
    xy.objectName = 'pad';

    const bank = createDefaultBsbWidgetSnapshot('BSBHSliderBank')!;
    bank.id = 'bank-1';
    bank.objectName = 'bank';
    bank.properties.sliders = [{ value: 0 }, { value: 0 }, { value: 0 }];

    const line = createDefaultBsbWidgetSnapshot('BSBLineObject')!;
    line.id = 'line-1';
    line.objectName = 'curve';
    line.properties.lines = [
      { varName: 'freq' },
      { varName: 'amp' },
    ];

    const tree: BsbWidgetNodeSnapshot = {
      id: 'root',
      type: 'BSBRootGroup',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      value: 0,
      minimum: 0,
      maximum: 1,
      editable: true,
      properties: {},
      children: [xy, bank, line],
    };

    expect(collectBsbReplacementKeysFromSnapshotTree(tree)).toEqual([
      'bank_0',
      'bank_1',
      'bank_2',
      'curve_amp',
      'curve_freq',
      'padX',
      'padY',
    ]);
  });

  describe('UDO completion scope (US1)', () => {
    it('BSB orchestra fields aggregate owner-plus-project UDOs while preserving replacement keys', () => {
      const instrument: BlueSynthBuilderInstrumentSnapshot = {
        ...BSB_INSTRUMENT,
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <BSBCodeEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
      // Each orchestra field (Instrument, Always On, Global Orc) receives both scopes.
      expect(scopes.filter((scope) => scope === '1:1').length).toBe(3);
      // Replacement keys remain available across all BSB fields.
      expect(html).toContain('amp');
    });

    it('BSB Global Sco field keeps replacement keys but receives no UDO scope', () => {
      const instrument: BlueSynthBuilderInstrumentSnapshot = {
        ...BSB_INSTRUMENT,
        udolist: [udoSnapshot('OwnerUDO')],
      };

      const html = renderToStaticMarkup(
        <BSBCodeEditor
          instrument={instrument}
          projectUdos={[udoSnapshot('ProjectUDO')]}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );

      const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
      // Global Sco is the only score field: exactly one of the four editors
      // receives no UDO scope, and that field still renders its replacement keys.
      expect(scopes.filter((scope) => scope === '0:0').length).toBe(1);
      expect(html).toContain('data-bsb-code-tab="globalSco"');
    });
  });
});
