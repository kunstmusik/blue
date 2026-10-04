/** Ordered timeline markers. XML is a boundary representation, never owned state. */
import { Element } from './serialization/xml-reader';
import { BlueDataObject } from './blue-data-object';
import { XmlLoadContext } from './serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber, readDouble } from './utilities/xml';
import { TimePosition } from './time/time-position';

type Marker = { name: string; time: TimePosition };

export class MarkersList implements BlueDataObject {
  private markers: Marker[] = [];

  constructor(other?: MarkersList) {
    // TimePosition is immutable; only the mutable marker records need copying.
    if (other) this.markers = other.markers.map((marker) => ({ ...marker }));
  }

  size(): number {
    return this.markers.length;
  }

  private static markerXml(marker: Marker): Element {
    const element = new Element('marker');
    element.setAttribute('name', marker.name);
    element.addElement(marker.time.saveAsXML().setName('time'));
    return element;
  }

  getMarker(index: number): Element | undefined {
    const marker = this.markers[index];
    return marker ? MarkersList.markerXml(marker) : undefined;
  }

  getMarkers(): Element[] {
    return this.markers.map(MarkersList.markerXml);
  }
  getMarkerName(index: number): string {
    return this.markers[index]?.name ?? '';
  }
  setMarkerName(index: number, name: string): void {
    if (this.markers[index]) this.markers[index].name = name;
  }
  getMarkerTime(index: number): number {
    return this.getMarkerTimePosition(index).getValue();
  }
  getMarkerTimePosition(index: number): TimePosition {
    return this.markers[index]?.time ?? TimePosition.beats(0);
  }
  setMarkerTime(index: number, time: number): void {
    this.setMarkerTimePosition(index, TimePosition.beats(time));
  }
  setMarkerTimePosition(index: number, time: TimePosition): void {
    if (this.markers[index]) this.markers[index].time = time;
  }
  addMarker(name: string, time: number): number {
    return this.addMarkerPosition(name, TimePosition.beats(time));
  }
  addMarkerPosition(name: string, time: TimePosition): number {
    this.markers.push({ name, time });
    return this.markers.length - 1;
  }
  removeMarker(index: number): void {
    if (index >= 0 && index < this.markers.length) this.markers.splice(index, 1);
  }
  saveAsXML(): Element {
    const element = new Element('markersList');
    for (const marker of this.markers) element.addElement(MarkersList.markerXml(marker));
    return element;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MarkersList {
    checkRoot(data, 'markersList', context);
    checkShape(data, [], ['marker'], context, ['marker']);
    const list = new MarkersList();
    for (const marker of data.getElements('marker')) {
      // Direct numeric text is an explicitly supported historical scalar form.
      checkShape(marker, ['name', 'time'], ['time', 'timePosition'], context, [], true);
      const positions: TimePosition[] = [];
      for (const child of marker.getElements()) {
        positions.push(
          child.getAttribute('type') !== null
            ? TimePosition.loadFromXML(child, context)
            : TimePosition.beats(readDouble(child, context)),
        );
      }
      const attribute = marker.getAttribute('time');
      if (attribute !== null)
        positions.push(TimePosition.beats(parseXmlNumber(attribute, context.at(marker), '@time')));
      if (marker.getTextString().trim() !== '')
        positions.push(
          TimePosition.beats(parseXmlNumber(marker.getTextString(), context.at(marker))),
        );
      const time = positions[0] ?? TimePosition.beats(0);
      if (positions.some((position) => position.saveAsXML().toXml() !== time.saveAsXML().toXml()))
        throw context.at(marker).error({
          code: 'conflict',
          message: 'Marker time representations disagree.',
          recovery: 'Keep one authoritative marker time or equal aliases.',
        });
      list.addMarkerPosition(marker.getAttribute('name') ?? '', time);
    }
    return list;
  }

  deepCopy(): BlueDataObject {
    return new MarkersList(this);
  }
}
