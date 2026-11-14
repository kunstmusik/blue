import type { BsbInterfacePatch, ProjectDocumentPatch } from './contract';

export function changesScoreTimeContext(transport: ProjectDocumentPatch['transport']): boolean {
  return (
    transport?.tempoMapPatch !== undefined ||
    transport?.meterMapPatch !== undefined ||
    transport?.tempoMap?.enabled !== undefined
  );
}

export function changesBsbAutomationCatalog(bsb: BsbInterfacePatch | undefined): boolean {
  return (
    changesBsbAutomationProperties(bsb) ||
    (bsb !== undefined &&
      bsb.type !== 'updateSliderBankValue' &&
      bsb.type !== 'updateWidgetProperties')
  );
}

export function changesBsbAutomationProperties(bsb: BsbInterfacePatch | undefined): boolean {
  return (
    bsb?.type === 'updateWidgetProperties' &&
    ('objectName' in bsb.properties ||
      'label' in bsb.properties ||
      'minimum' in bsb.properties ||
      'maximum' in bsb.properties ||
      'xMin' in bsb.properties ||
      'xMax' in bsb.properties ||
      'yMin' in bsb.properties ||
      'yMax' in bsb.properties ||
      'resolution' in bsb.properties ||
      'resolutionDecimal' in bsb.properties ||
      'numberOfSliders' in bsb.properties ||
      'sliders' in bsb.properties ||
      'dropdownItems' in bsb.properties ||
      'automationAllowed' in bsb.properties)
  );
}
