import { act } from 'react';

export interface TestDataTransfer {
  readonly dropEffect: DataTransfer['dropEffect'];
  readonly effectAllowed: DataTransfer['effectAllowed'];
  readonly files: FileList;
  readonly items: DataTransferItemList;
  readonly types: readonly string[];
  clearData: (format?: string) => void;
  getData: (format: string) => string;
  setData: (format: string, data: string) => void;
  setDragImage: () => void;
}

export function createTestDataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    get types() {
      return [...values.keys()];
    },
    clearData(format?: string) {
      if (format) values.delete(format);
      else values.clear();
    },
    getData(format: string) {
      return values.get(format) ?? '';
    },
    setData(format: string, data: string) {
      values.set(format, data);
    },
    setDragImage() {},
  } as DataTransfer;
}

export function setElementRect(
  element: Element,
  rect: Partial<DOMRect> & Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): void {
  const value = {
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect;
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => value,
  });
}

export function dispatchContextMenuKey(element: Element, key = 'F10'): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key,
      shiftKey: key === 'F10',
    }));
  });
}

export function dispatchPointerEvent(
  element: Element,
  type: string,
  init: PointerEventInit = {},
): void {
  const EventConstructor = globalThis.PointerEvent ?? MouseEvent;
  act(() => {
    element.dispatchEvent(new EventConstructor(type, {
      bubbles: true,
      cancelable: true,
      ...init,
    }));
  });
}

export function dispatchDragEvent(
  element: Element,
  type: 'dragover' | 'dragleave' | 'drop',
  dataTransfer: DataTransfer,
  coordinates: { clientX?: number; clientY?: number } = {},
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: coordinates.clientX ?? 0 },
    clientY: { value: coordinates.clientY ?? 0 },
    relatedTarget: { value: null },
  });
  act(() => { element.dispatchEvent(event); });
}
