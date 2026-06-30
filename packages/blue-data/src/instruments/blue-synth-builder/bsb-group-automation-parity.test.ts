/**
 * Parity regression coverage for Java Blue commit 8cfbcea1
 * ("fix: preserve timeline automation when grouping and ungrouping BSB widgets").
 *
 * The Java bug existed because BSBGroup's ObservableSet listener destroyed the
 * backing Parameter on any removal (including structural reparents), and the
 * Swing group/ungroup actions deep-copied widgets. The TypeScript port is
 * architecturally immune: BSBGroup holds no live ParameterList coupling, and
 * BlueSynthBuilder.syncParametersFromWidgets() reconciles Parameters by name,
 * reusing the same Parameter instances (with automation-enabled flag and line
 * points) across structural moves. The makeGroup/breakGroup patches move widget
 * references directly without touching objectName or automationAllowed.
 *
 * These tests lock in that invariant so a future refactor cannot silently
 * reintroduce the Java-style coupling.
 */
import { describe, expect, it } from 'vitest';
import { BlueSynthBuilder } from '../blue-synth-builder';
import { BSBGroup } from './bsb-group';
import { BSBKnob } from './bsb-knob';
import { BSBXYController } from './bsb-xy-controller';
import type { Parameter } from '../../automation/parameter';

function findParamByName(builder: BlueSynthBuilder, name: string): Parameter | undefined {
  return builder.getParameters().find((candidate) => candidate.getName() === name);
}

describe('BSB group/ungroup preserves timeline automation (Java 8cfbcea1 parity)', () => {
  it('preserves the same Parameter instance, automation flag, and line points through group/ungroup', () => {
    const builder = new BlueSynthBuilder();
    const root = builder.getGraphicInterface().getRootGroup();

    const knob = new BSBKnob();
    knob.id = 'knob-1';
    knob.objectName = 'test1';
    knob.automationAllowed = true;
    root.addChild(knob);

    expect(findParamByName(builder, 'test1')).toBeTruthy();

    const parameter = findParamByName(builder, 'test1')!;
    parameter.setAutomationEnabled(true);
    parameter.addPoint(0.0, 0.0);
    parameter.addPoint(1.0, 0.75);

    // Structural move: reparent knob into a new group (mirrors makeGroup).
    const group = new BSBGroup();
    group.id = 'group-1';
    root.removeChildById(knob.id);
    group.addChild(knob);
    root.addChild(group);

    const afterGroup = findParamByName(builder, 'test1');
    expect(afterGroup).toBe(parameter);
    expect(knob.automationAllowed).toBe(true);
    expect(afterGroup!.isAutomationEnabled()).toBe(true);
    expect(afterGroup!.getPoints()).toHaveLength(2);

    // Structural move back: reparent knob to root, then delete empty group
    // (mirrors breakGroup: move children out while group is still attached,
    // then remove the empty group).
    group.removeChildById(knob.id);
    root.addChild(knob);
    expect(root.removeChildById(group.id)).toBe(true);

    const afterUngroup = findParamByName(builder, 'test1');
    expect(afterUngroup).toBe(parameter);
    expect(knob.automationAllowed).toBe(true);
    expect(afterUngroup!.isAutomationEnabled()).toBe(true);
    expect(afterUngroup!.getPoints()).toHaveLength(2);
  });

  it('keeps automation disabled and does not create a Parameter through group/ungroup', () => {
    const builder = new BlueSynthBuilder();
    const root = builder.getGraphicInterface().getRootGroup();

    const knob = new BSBKnob();
    knob.id = 'knob-disabled';
    knob.objectName = 'test1';
    knob.automationAllowed = false;
    root.addChild(knob);

    expect(knob.automationAllowed).toBe(false);
    expect(findParamByName(builder, 'test1')).toBeUndefined();

    const group = new BSBGroup();
    group.id = 'group-disabled';
    root.removeChildById(knob.id);
    group.addChild(knob);
    root.addChild(group);

    expect(knob.automationAllowed).toBe(false);
    expect(findParamByName(builder, 'test1')).toBeUndefined();

    group.removeChildById(knob.id);
    root.addChild(knob);
    expect(root.removeChildById(group.id)).toBe(true);

    expect(knob.automationAllowed).toBe(false);
    expect(findParamByName(builder, 'test1')).toBeUndefined();
  });

  it('preserves both X and Y Parameters for a multi-parameter widget (BSBXYController)', () => {
    const builder = new BlueSynthBuilder();
    const root = builder.getGraphicInterface().getRootGroup();

    const xy = new BSBXYController();
    xy.id = 'xy-1';
    xy.objectName = 'xy';
    xy.automationAllowed = true;
    root.addChild(xy);

    expect(builder.getParameters().filter((p) => p.getName() === 'xyX' || p.getName() === 'xyY')).toHaveLength(2);

    const xParameter = findParamByName(builder, 'xyX')!;
    const yParameter = findParamByName(builder, 'xyY')!;
    xParameter.setAutomationEnabled(true);
    xParameter.addPoint(0.0, 0.0);
    xParameter.addPoint(1.0, 0.25);
    yParameter.setAutomationEnabled(true);
    yParameter.addPoint(0.0, 1.0);
    yParameter.addPoint(1.0, 0.75);

    const group = new BSBGroup();
    group.id = 'group-xy';
    root.removeChildById(xy.id);
    group.addChild(xy);
    root.addChild(group);

    expect(findParamByName(builder, 'xyX')).toBe(xParameter);
    expect(findParamByName(builder, 'xyY')).toBe(yParameter);
    expect(xy.automationAllowed).toBe(true);
    expect(xParameter.isAutomationEnabled()).toBe(true);
    expect(yParameter.isAutomationEnabled()).toBe(true);
    expect(xParameter.getPoints()).toHaveLength(2);
    expect(yParameter.getPoints()).toHaveLength(2);

    group.removeChildById(xy.id);
    root.addChild(xy);
    expect(root.removeChildById(group.id)).toBe(true);

    expect(findParamByName(builder, 'xyX')).toBe(xParameter);
    expect(findParamByName(builder, 'xyY')).toBe(yParameter);
    expect(xParameter.getPoints()).toHaveLength(2);
    expect(yParameter.getPoints()).toHaveLength(2);
  });

  it('preserves automation when reparenting a nested child group', () => {
    const builder = new BlueSynthBuilder();
    const root = builder.getGraphicInterface().getRootGroup();

    const childGroup = new BSBGroup();
    childGroup.id = 'child-group';
    const knob = new BSBKnob();
    knob.id = 'nested-knob';
    knob.objectName = 'test1';
    knob.automationAllowed = true;
    childGroup.addChild(knob);
    root.addChild(childGroup);

    const parameter = findParamByName(builder, 'test1')!;
    parameter.setAutomationEnabled(true);
    parameter.addPoint(0.0, 0.0);
    parameter.addPoint(1.0, 0.75);

    const parentGroup = new BSBGroup();
    parentGroup.id = 'parent-group';
    root.removeChildById(childGroup.id);
    parentGroup.addChild(childGroup);
    root.addChild(parentGroup);

    const afterMoveIn = findParamByName(builder, 'test1');
    expect(afterMoveIn).toBe(parameter);
    expect(knob.automationAllowed).toBe(true);
    expect(afterMoveIn!.isAutomationEnabled()).toBe(true);
    expect(afterMoveIn!.getPoints()).toHaveLength(2);

    parentGroup.removeChildById(childGroup.id);
    root.addChild(childGroup);
    expect(root.removeChildById(parentGroup.id)).toBe(true);

    const afterMoveOut = findParamByName(builder, 'test1');
    expect(afterMoveOut).toBe(parameter);
    expect(afterMoveOut!.getPoints()).toHaveLength(2);
  });

  it('destructive widget removal drops the backing Parameter', () => {
    const builder = new BlueSynthBuilder();
    const gi = builder.getGraphicInterface();

    const knob = new BSBKnob();
    knob.id = 'deleting-knob';
    knob.objectName = 'doomed';
    knob.automationAllowed = true;
    gi.getRootGroup().addChild(knob);

    const parameter = findParamByName(builder, 'doomed')!;
    parameter.setAutomationEnabled(true);
    parameter.addPoint(0.5, 0.5);
    expect(findParamByName(builder, 'doomed')).toBeTruthy();

    expect(gi.removeWidget(knob.id)).toBe(true);
    builder.invalidateGraphicInterfaceCache();

    expect(findParamByName(builder, 'doomed')).toBeUndefined();
  });
});
