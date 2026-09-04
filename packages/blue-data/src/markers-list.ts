/**
 * MarkersList — holds timeline markers.
 * Mirrors the Java MarkersList class.
 *
 * Preserves marker child elements losslessly for round-trip compatibility.
 */
import { Element } from './serialization/xml-reader';
import { BlueDataObject } from './blue-data-object';
import { TimePosition } from './time/time-position';

export class MarkersList implements BlueDataObject {
  private _rawChildren: Element[] = [];

  private static readMarkerTimePosition(elem: Element): TimePosition {
    const timeElement = elem.getElement('timePosition') ?? elem.getElement('time');

    if (timeElement) {
      if (timeElement.getAttributeValue('type') != null) {
        return TimePosition.loadFromXML(timeElement);
      }

      const childText = timeElement.getTextString();
      const childValue = childText ? parseFloat(childText) : 0;
      return TimePosition.beats(Number.isFinite(childValue) ? childValue : 0);
    }

    const legacyText = elem.getAttribute('time') ?? elem.getTextString() ?? '0';
    const legacyValue = parseFloat(legacyText);
    return TimePosition.beats(Number.isFinite(legacyValue) ? legacyValue : 0);
  }

  private static writeMarkerTimePosition(elem: Element, position: TimePosition): void {
    elem.removeAttribute('time');
    elem.removeElements('time');
    elem.removeElements('timePosition');
    elem.setText('');
    elem.addElement(position.saveAsXML().setName('time'));
  }

  constructor(other?: MarkersList) {
    if (other) {
      this._rawChildren = other._rawChildren.map((e) => e.clone());
    }
  }

  size(): number {
    return this._rawChildren.length;
  }

  getMarker(index: number): Element | undefined {
    return this._rawChildren[index];
  }

  getMarkers(): Element[] {
    return [...this._rawChildren];
  }

  getMarkerName(index: number): string {
    const elem = this._rawChildren[index];
    if (!elem) return '';
    return elem.getAttribute('name') ?? '';
  }

  setMarkerName(index: number, name: string): void {
    const elem = this._rawChildren[index];
    if (elem) {
      elem.setAttribute('name', name);
    }
  }

  getMarkerTime(index: number): number {
    const elem = this._rawChildren[index];
    if (!elem) return 0;
    const timeElement = elem.getElement('timePosition') ?? elem.getElement('time');
    if (timeElement?.getAttributeValue('type') != null) {
      const position = TimePosition.loadFromXML(timeElement);
      return position.getValue();
    }

    const timeText =
      timeElement?.getTextString() ?? elem.getTextString() ?? elem.getAttribute('time') ?? '0';
    return parseFloat(timeText) || 0;
  }

  getMarkerTimePosition(index: number): TimePosition {
    const elem = this._rawChildren[index];
    if (!elem) return TimePosition.beats(0);
    return MarkersList.readMarkerTimePosition(elem);
  }

  setMarkerTime(index: number, time: number): void {
    const elem = this._rawChildren[index];
    if (elem) {
      elem.setText(String(time));
    }
  }

  setMarkerTimePosition(index: number, position: TimePosition): void {
    const elem = this._rawChildren[index];
    if (elem) {
      MarkersList.writeMarkerTimePosition(elem, position);
    }
  }

  addMarker(name: string, time: number): number {
    const elem = new Element('marker');
    elem.setAttribute('name', name);
    elem.setText(String(time));
    this._rawChildren.push(elem);
    return this._rawChildren.length - 1;
  }

  addMarkerPosition(name: string, position: TimePosition): number {
    const elem = new Element('marker');
    elem.setAttribute('name', name);
    MarkersList.writeMarkerTimePosition(elem, position);
    this._rawChildren.push(elem);
    return this._rawChildren.length - 1;
  }

  removeMarker(index: number): void {
    if (index >= 0 && index < this._rawChildren.length) {
      this._rawChildren.splice(index, 1);
    }
  }

  saveAsXML(): Element {
    const elem = new Element('markersList');
    for (const child of this._rawChildren) {
      elem.addElement(child);
    }
    return elem;
  }

  static loadFromXML(data: Element): MarkersList {
    const list = new MarkersList();
    const children = data.getElements();
    while (children.hasMoreElements()) {
      list._rawChildren.push(children.next());
    }
    return list;
  }

  deepCopy(): BlueDataObject {
    return new MarkersList(this);
  }
}
