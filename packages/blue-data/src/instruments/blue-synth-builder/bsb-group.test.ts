import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BSBGroup } from './bsb-group';
import { BSBKnob } from './bsb-knob';

describe('BSBGroup', () => {
  it('clears existing children before loading replacement XML', () => {
    const group = new BSBGroup();
    const staleChild = new BSBKnob();
    staleChild.id = 'stale-knob';
    staleChild.objectName = 'oldGain';
    group.addChild(staleChild);

    group.loadFromXML(
      Element.parse(`
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup">
        <groupName>Loaded</groupName>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="fresh-knob">
          <objectName>newGain</objectName>
          <value>0.75</value>
        </bsbObject>
      </bsbObject>`),
    );

    const children = group.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0]?.id).toBe('fresh-knob');
    expect(children[0]?.objectName).toBe('newGain');
  });

  it('deep-copies nested structure with fresh widget ids', () => {
    const group = new BSBGroup();
    group.id = 'group-root';
    group.groupName = 'Root';

    const knob = new BSBKnob();
    knob.id = 'gain-knob';
    knob.objectName = 'gain';
    knob.value = 0.5;

    const nested = new BSBGroup();
    nested.id = 'nested-group';
    nested.groupName = 'Nested';

    group.addChild(knob);
    group.addChild(nested);

    const copy = group.deepCopy();
    const copyChildren = copy.getChildren();
    const originalChildren = group.getChildren();

    expect(copy).not.toBe(group);
    expect(copy.id).toBeTruthy();
    expect(copy.id).not.toBe('group-root');
    expect(copyChildren).toHaveLength(2);
    expect(copyChildren[0]?.id).toBeTruthy();
    expect(copyChildren[0]?.id).not.toBe('gain-knob');
    expect(copyChildren[1]?.id).toBeTruthy();
    expect(copyChildren[1]?.id).not.toBe('nested-group');

    const copiedKnob = copyChildren[0];
    const originalKnob = originalChildren[0];
    const copiedNested = copyChildren[1];
    const originalNested = originalChildren[1];

    expect(copiedKnob).toBeInstanceOf(BSBKnob);
    expect(copiedKnob).not.toBe(originalKnob);
    expect(copiedNested).toBeInstanceOf(BSBGroup);
    expect(copiedNested).not.toBe(originalNested);

    if (!(copiedKnob instanceof BSBKnob) || !(originalKnob instanceof BSBKnob)) {
      throw new Error('Expected copied and original first children to be knobs');
    }

    if (!(copiedNested instanceof BSBGroup) || !(originalNested instanceof BSBGroup)) {
      throw new Error('Expected copied and original second children to be groups');
    }

    copiedKnob.value = 0.9;
    copiedNested.addChild(new BSBKnob());

    expect(originalKnob.value).toBe(0.5);
    expect(originalNested.getChildren()).toHaveLength(0);
  });
});
