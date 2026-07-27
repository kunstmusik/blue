import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';
import type { JavaBlueUdoCompletionDefinition } from './editor-adapter-types';

/**
 * Convert an authored UDO definition snapshot into the lightweight
 * signature-bearing completion definition accepted by the completion adapter.
 * Code and comments are dropped — completion consumes only the callable
 * signature fields.
 */
export function toUdoCompletionDefinition(
  snapshot: UdoDefinitionSnapshot,
): JavaBlueUdoCompletionDefinition {
  return {
    name: snapshot.name,
    style: snapshot.style,
    outTypes: snapshot.outTypes,
    inTypes: snapshot.inTypes,
    inputArguments: snapshot.inputArguments,
  };
}

export function toUdoCompletionDefinitions(
  snapshots: readonly UdoDefinitionSnapshot[],
): JavaBlueUdoCompletionDefinition[] {
  return snapshots.map(toUdoCompletionDefinition);
}
