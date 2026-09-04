import { Element } from '../serialization/xml-reader';

/** Move direct child elements from source to destination in order. */
export function moveChildElements(source: Element, destination: Element, childName?: string): void {
  const children = source
    .getElements()
    .toArray()
    .filter((child) => childName === undefined || child.getName() === childName);
  for (const child of children) {
    const removed = source.removeElement(child.getName());
    if (removed) destination.addElement(removed);
  }
}
