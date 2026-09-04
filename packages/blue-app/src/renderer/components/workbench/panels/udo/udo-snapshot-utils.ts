import { OpcodeDefinition, UDOStyle, convertToClassic, convertToModern } from '@blue/data';

import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';

export const EMPTY_UDO_SNAPSHOT: UdoDefinitionSnapshot = {
  name: 'newOpcode',
  style: 'CLASSIC',
  outTypes: '',
  inTypes: '',
  inputArguments: '',
  code: '',
  comments: '',
};

export function cloneUdoSnapshot(snapshot: UdoDefinitionSnapshot): UdoDefinitionSnapshot {
  return { ...snapshot };
}

export function opcodeToUdoSnapshot(udo: OpcodeDefinition): UdoDefinitionSnapshot {
  return {
    name: udo.getName(),
    style: udo.getStyle() as 'CLASSIC' | 'MODERN',
    outTypes: udo.getOutTypes(),
    inTypes: udo.getInTypes(),
    inputArguments: udo.getInputArguments(),
    code: udo.getCode(),
    comments: udo.getComments(),
  };
}

export function udoSnapshotToOpcode(snapshot: UdoDefinitionSnapshot): OpcodeDefinition {
  const udo = new OpcodeDefinition();
  udo.setName(snapshot.name);
  udo.setStyle(snapshot.style as UDOStyle);
  udo.setOutTypes(snapshot.outTypes);
  udo.setInTypes(snapshot.inTypes);
  udo.setInputArguments(snapshot.inputArguments);
  udo.setCode(snapshot.code);
  udo.setComments(snapshot.comments);
  return udo;
}

export function convertUdoSnapshotStyle(
  snapshot: UdoDefinitionSnapshot,
  style: 'CLASSIC' | 'MODERN',
): UdoDefinitionSnapshot {
  const udo = udoSnapshotToOpcode(snapshot);
  if (style === 'MODERN') {
    convertToModern(udo);
  } else {
    convertToClassic(udo);
  }
  return opcodeToUdoSnapshot(udo);
}

export function formatUdoListAsOpcodeText(udos: UdoDefinitionSnapshot[]): string {
  return udos
    .map((snapshot) => udoSnapshotToOpcode(snapshot).generateCode())
    .filter((text) => text.trim().length > 0)
    .join('\n\n');
}
