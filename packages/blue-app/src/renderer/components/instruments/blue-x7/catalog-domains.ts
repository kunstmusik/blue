/**
 * Catalog-derived widget domains (Spec 092). Every BlueX7 editor bound comes
 * from the authoritative 151-entry parameter catalog so panels, patch
 * validation, the automation chooser, and engine quantization cannot drift.
 */
import { getBlueX7Descriptor } from '@blue/data';

export interface BlueX7WidgetDomain {
  min: number;
  max: number;
}

export function blueX7WidgetDomain(key: string): BlueX7WidgetDomain {
  const descriptor = getBlueX7Descriptor(key);
  if (!descriptor) {
    throw new Error(`BlueX7 parameter catalog is missing descriptor '${key}'`);
  }
  return { min: descriptor.minimum, max: descriptor.maximum };
}
