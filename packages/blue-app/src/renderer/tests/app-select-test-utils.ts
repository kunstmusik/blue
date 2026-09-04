import { act } from 'react';

function ensureRadixDomPolyfills(view: Window): void {
  const elementPrototype = view.Element.prototype as Element & {
    hasPointerCapture?: () => boolean;
    setPointerCapture?: () => void;
    releasePointerCapture?: () => void;
  };
  elementPrototype.hasPointerCapture ??= () => false;
  elementPrototype.setPointerCapture ??= () => undefined;
  elementPrototype.releasePointerCapture ??= () => undefined;
  (view.HTMLElement.prototype as HTMLElement & { scrollIntoView?: () => void }).scrollIntoView ??=
    () => undefined;
}

export async function chooseAppSelectOption(
  trigger: HTMLElement,
  label: string,
  hostDocument: Document = trigger.ownerDocument,
): Promise<void> {
  ensureRadixDomPolyfills(hostDocument.defaultView ?? window);
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const option = [...hostDocument.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!option) throw new Error(`AppSelect option not found: ${label}`);
  await act(async () => {
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function getAppSelectOptionLabels(
  trigger: HTMLElement,
  hostDocument: Document = trigger.ownerDocument,
): Promise<string[]> {
  ensureRadixDomPolyfills(hostDocument.defaultView ?? window);
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const labels = [...hostDocument.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (option) => option.textContent?.trim() ?? '',
  );
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return labels;
}
