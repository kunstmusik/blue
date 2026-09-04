// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultBsbWidgetSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
} from '../../shared/project-editor';
import { resolveBsbSwingHtmlFontSizePx, stripBsbSwingHtmlText } from '../../shared/bsb-swing-html';
import BSBInterfaceCanvas from '../components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas';
import {
  getSanitizedBsbSwingHtml,
  getWidgetDisplaySize,
} from '../components/workbench/panels/orchestra/bsb/widgets/utils';

function makeInstrument(
  children: BlueSynthBuilderInstrumentSnapshot['widgetTree']['children'],
): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'HTML Labels',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili 0.5, 440',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: [],
    widgets: [],
    editEnabled: false,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
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
      maximum: 1,
      editable: true,
      properties: {},
      children,
    },
  };
}

describe('BSB Swing HTML labels', () => {
  it('renders legacy Swing HTML label text instead of showing the raw tags', () => {
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'label';
    label.x = 10;
    label.y = 10;
    label.properties.label = '<html><font size="+1">OSC 1</font></html>';

    const knob = createDefaultBsbWidgetSnapshot('BSBKnob')!;
    knob.id = 'knob';
    knob.x = 10;
    knob.y = 40;
    knob.properties.labelEnabled = true;
    knob.properties.label = '<html><b>Gain</b></html>';

    const checkBox = createDefaultBsbWidgetSnapshot('BSBCheckBox')!;
    checkBox.id = 'check';
    checkBox.x = 10;
    checkBox.y = 130;
    checkBox.properties.label = '<html><i>Enabled</i></html>';

    const group = createDefaultBsbWidgetSnapshot('BSBGroup')!;
    group.id = 'group';
    group.x = 10;
    group.y = 170;
    group.properties.groupName = '<html><u>Panel</u></html>';

    const dropdown = createDefaultBsbWidgetSnapshot('BSBDropdown')!;
    dropdown.id = 'dropdown';
    dropdown.x = 10;
    dropdown.y = 210;
    dropdown.properties.selectedIndex = 0;
    dropdown.properties.dropdownItems = [
      { name: '<html><font size="+1">Mode A</font></html>', value: 'a', uniqueId: 'mode-a' },
    ];

    const subChannel = createDefaultBsbWidgetSnapshot('BSBSubChannelDropdown')!;
    subChannel.id = 'sub-channel';
    subChannel.x = 10;
    subChannel.y = 250;
    subChannel.properties.channelOutput = '<html><b>Bus 1</b></html>';

    const html = renderToStaticMarkup(
      createElement(BSBInterfaceCanvas, {
        instrument: makeInstrument([label, knob, checkBox, group, dropdown, subChannel]),
        selectedWidgetIds: new Set<string>(),
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        onBsbInterfacePatch: vi.fn(),
        onInstrumentPatch: vi.fn(),
      }),
    );

    expect(html).toContain('OSC 1');
    expect(html).toContain('Gain');
    expect(html).toContain('Enabled');
    expect(html).toContain('Panel');
    expect(html).toContain('Mode A');
    expect(html).toContain('Bus 1');
    expect(html).not.toContain('&lt;html&gt;');
    expect(html).not.toContain('&lt;font');
    expect(html).not.toContain('&lt;b&gt;');
    expect(html).not.toContain('&lt;i&gt;');
  });

  it('sizes HTML labels from their rendered content instead of the raw markup length', () => {
    const plain = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    plain.properties.label = 'OSC 1';

    const htmlLabel = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    htmlLabel.properties.label = '<html><font size="+1">OSC 1</font></html>';

    expect(stripBsbSwingHtmlText(htmlLabel.properties.label as string)).toBe('OSC 1');

    const plainSize = getWidgetDisplaySize(plain);
    const htmlSize = getWidgetDisplaySize(htmlLabel);

    expect(htmlSize.width).toBeGreaterThanOrEqual(plainSize.width);
    expect(htmlSize.width).toBeLessThan(plainSize.width + 40);
    expect(htmlSize.height).toBeGreaterThanOrEqual(plainSize.height);
  });

  it('keeps authored BSB label glyphs inside their measured line box', () => {
    const label = createDefaultBsbWidgetSnapshot('BSBLabel')!;
    label.id = 'label';
    label.properties.label = 'JNO';
    label.properties['font.size'] = 36;

    const html = renderToStaticMarkup(
      createElement(BSBInterfaceCanvas, {
        instrument: makeInstrument([label]),
        selectedWidgetIds: new Set<string>(),
        editEnabled: false,
        onWidgetSelect: vi.fn(),
        onBsbInterfacePatch: vi.fn(),
        onInstrumentPatch: vi.fn(),
      }),
    );

    expect(html).toContain('font-size:36px');
    expect(html).toContain('line-height:normal');
  });

  it('maps legacy Swing font sizes to the same larger bucket Java uses', () => {
    expect(resolveBsbSwingHtmlFontSizePx('+1')).toBe(18);
    expect(resolveBsbSwingHtmlFontSizePx('-1')).toBe(12);
    expect(resolveBsbSwingHtmlFontSizePx('4')).toBe(14);

    const markup = getSanitizedBsbSwingHtml('<html><font size="+1">OSC 1</font></html>');
    expect(markup).toContain('font-size:18px');
  });
});
