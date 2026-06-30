import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { ParameterIdList } from './parameter-id-list';

describe('ParameterIdList', () => {
  it('adds and retrieves parameter ids', () => {
    const list = new ParameterIdList();
    list.addParameterId('paramA');
    list.addParameterId('paramB');
    expect(list.getIds()).toEqual(['paramA', 'paramB']);
  });

  it('sorts case-insensitively after add', () => {
    const list = new ParameterIdList();
    list.addParameterId('Zebra');
    list.addParameterId('alpha');
    list.addParameterId('middle');
    expect(list.getIds()).toEqual(['alpha', 'middle', 'Zebra']);
  });

  it('does not add duplicate parameter ids', () => {
    const list = new ParameterIdList();
    list.addParameterId('paramA');
    list.addParameterId('paramA');
    expect(list.getIds()).toEqual(['paramA']);
  });

  it('preserves selected id when a sorted insert shifts its index', () => {
    const list = new ParameterIdList();
    list.addParameterId('beta');
    list.addParameterId('delta');
    list.setSelectedParameter('delta');

    list.addParameterId('alpha');

    expect(list.getIds()).toEqual(['alpha', 'beta', 'delta']);
    expect(list.getSelectedId()).toBe('delta');
  });

  it('removes a parameter id', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.addParameterId('b');
    list.addParameterId('c');
    list.removeParameterId('b');
    expect(list.getIds()).toEqual(['a', 'c']);
  });

  it('contains returns true for existing id', () => {
    const list = new ParameterIdList();
    list.addParameterId('x');
    expect(list.contains('x')).toBe(true);
    expect(list.contains('y')).toBe(false);
  });

  it('clear removes all ids', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.addParameterId('b');
    list.clear();
    expect(list.getIds()).toEqual([]);
  });

  it('selectedIndex defaults to -1 when empty', () => {
    const list = new ParameterIdList();
    expect(list.getSelectedIndex()).toBe(-1);
  });

  it('selectedIndex defaults to 0 after first add', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    expect(list.getSelectedIndex()).toBe(0);
  });

  it('selectedIndex tracks the selected id through add/remove', () => {
    const list = new ParameterIdList();
    list.addParameterId('b');
    list.addParameterId('a');
    list.setSelectedIndex(0);
    expect(list.getSelectedId()).toBe('a');

    list.removeParameterId('a');
    expect(list.getSelectedIndex()).toBe(0);
    expect(list.getSelectedId()).toBe('b');
  });

  it('selectedIndex clamps when removed id was last', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.addParameterId('b');
    list.setSelectedIndex(1);
    list.removeParameterId('b');
    expect(list.getSelectedIndex()).toBe(0);
  });

  it('selectedIndex resets to -1 when list is cleared', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.clear();
    expect(list.getSelectedIndex()).toBe(-1);
  });

  it('setSelectedParameter finds the id', () => {
    const list = new ParameterIdList();
    list.addParameterId('b');
    list.addParameterId('a');
    list.setSelectedParameter('b');
    expect(list.getSelectedId()).toBe('b');
  });

  it('round-trips XML with ids and selectedIndex', () => {
    const list = new ParameterIdList();
    list.addParameterId('param1');
    list.addParameterId('param2');
    list.setSelectedIndex(1);

    const xml = list.saveAsXML();
    const reloaded = ParameterIdList.loadFromXML(Element.parse(xml.toXml()));

    expect(reloaded.getIds()).toEqual(['param1', 'param2']);
    expect(reloaded.getSelectedIndex()).toBe(1);
  });

  it('deep copies ids and selectedIndex', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.setSelectedIndex(0);

    const copy = list.deepCopy();
    copy.removeParameterId('a');

    expect(list.getIds()).toEqual(['a']);
    expect(copy.getIds()).toEqual([]);
  });

  it('size returns count', () => {
    const list = new ParameterIdList();
    expect(list.size()).toBe(0);
    list.addParameterId('x');
    expect(list.size()).toBe(1);
  });

  it('getParameterId returns by index', () => {
    const list = new ParameterIdList();
    list.addParameterId('a');
    list.addParameterId('b');
    expect(list.getParameterId(0)).toBe('a');
    expect(list.getParameterId(1)).toBe('b');
  });
});
