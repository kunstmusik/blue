import { describe, expect, it } from 'vitest';
import { BlueData, BlueSynthBuilder, BSBGroup, BSBKnob } from '@blue/data';
import type { Parameter } from '@blue/data';
import { applyProjectDocumentPatch } from './project-editor';

function findParamByName(builder: BlueSynthBuilder, name: string): Parameter | undefined {
  return builder.getParameters().find((candidate) => candidate.getName() === name);
}

describe('BSB group/ungroup document patches', () => {
  it('preserves the timeline automation parameter through makeGroup and breakGroup', () => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const root = instrument.getGraphicInterface().getRootGroup();

    const knob = new BSBKnob();
    knob.id = 'knob-1';
    knob.objectName = 'test1';
    knob.automationAllowed = true;
    root.addChild(knob);

    data.getArrangement().addInstrument(instrument, '1');

    const parameter = findParamByName(instrument, 'test1')!;
    parameter.setAutomationEnabled(true);
    parameter.addPoint(0.0, 0.0);
    parameter.addPoint(1.0, 0.75);

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'updateInstrument',
          assignmentId: '1',
          patch: {
            bsbInterface: {
              type: 'makeGroup',
              widgetIds: [knob.id],
            },
          },
        },
      }),
    ).toBe(true);

    const group = root.getChildren().find((child) => child instanceof BSBGroup);
    expect(group).toBeInstanceOf(BSBGroup);
    expect((group as BSBGroup).getChildren()[0]).toBe(knob);

    const afterGroup = findParamByName(instrument, 'test1');
    expect(afterGroup).toBe(parameter);
    expect(knob.automationAllowed).toBe(true);
    expect(afterGroup!.isAutomationEnabled()).toBe(true);
    expect(afterGroup!.getPoints()).toEqual([
      { time: 0.0, value: 0.0 },
      { time: 1.0, value: 0.75 },
    ]);

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'updateInstrument',
          assignmentId: '1',
          patch: {
            bsbInterface: {
              type: 'breakGroup',
              widgetId: group!.id,
            },
          },
        },
      }),
    ).toBe(true);

    const afterBreak = findParamByName(instrument, 'test1');
    expect(afterBreak).toBe(parameter);
    expect(root.getChildren()).toContain(knob);
    expect(root.getChildren().some((child) => child.id === group!.id)).toBe(false);
    expect(knob.automationAllowed).toBe(true);
    expect(afterBreak!.isAutomationEnabled()).toBe(true);
    expect(afterBreak!.getPoints()).toEqual([
      { time: 0.0, value: 0.0 },
      { time: 1.0, value: 0.75 },
    ]);
  });
});
