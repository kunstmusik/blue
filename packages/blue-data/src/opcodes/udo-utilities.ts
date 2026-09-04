/**
 * UDOUtilities — parsing, conversion, and deduplication for User Defined Opcodes.
 * Mirrors the Java UDOUtilities class.
 */
import { OpcodeDefinition } from './opcode-definition';
import { OpcodeList } from './opcode-list';
import { UDOStyle } from './udo-style';
import { replaceOpcodeNames } from '../utilities/text';
import {
  getModernOutTypesFromSignature,
  getInputArgumentsFromCodeBody,
  getInputArgumentsFromTypeString,
  applyLegacyTypeAnnotations,
  removeXinLines,
  trimLeadingBlankLines,
  joinedOutTypesToCommaSeparated,
  commaSeparatedOutTypesToJoined,
  getInTypesFromInputArguments,
  stripTypeAnnotations,
} from './udo-type-utils';

const MODERN_UDO_REGEX = /^([^\(]+)\((.*)\)\s*:\s*(.+)$/s;

/**
 * Parse Csound UDO text into an OpcodeList.
 * Handles both classic and modern UDO declarations, including
 * multi-line declarations (state 2).
 */
export function parseUDOText(udoText: string): OpcodeList {
  const retVal = new OpcodeList();
  const cleanedText = stripMultiLineComments(udoText);

  let state = 0;
  let currentUDO: OpcodeDefinition | null = null;
  let codeBody = '';
  let declaration = '';

  const lines = cleanedText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    switch (state) {
      case 0: {
        currentUDO = parseUDODeclaration(line);
        if (currentUDO != null) {
          codeBody = '';
          state = 1;
        } else if (stripSingleLineComments(line.trim()).startsWith('opcode')) {
          declaration = line.trim();
          state = 2;
        }
        break;
      }
      case 1: {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('opcode')) {
          currentUDO = null;
          state = 0;
        } else if (trimmedLine.startsWith('endop')) {
          if (currentUDO != null) {
            currentUDO.setCode(codeBody);
            retVal.addOpcode(currentUDO);
          }
          currentUDO = null;
          state = 0;
        } else {
          codeBody += line + '\n';
        }
        break;
      }
      case 2: {
        const trimmedLine = line.trim();
        if (isInstrOrUDODeclarationBoundary(trimmedLine)) {
          declaration = '';
          state = 0;
          i--;
          break;
        }

        if (trimmedLine.length > 0) {
          declaration += '\n' + trimmedLine;
        }

        currentUDO = parseUDODeclaration(declaration);
        if (currentUDO != null) {
          codeBody = '';
          declaration = '';
          state = 1;
        }
        break;
      }
    }
  }

  return retVal;
}

/**
 * Parse a single UDO declaration line.
 * Returns null if the line is not a valid UDO declaration.
 */
export function parseUDODeclaration(line: string): OpcodeDefinition | null {
  const trimmedLine = stripSingleLineComments(line.trim());
  if (!trimmedLine.startsWith('opcode')) return null;

  const declaration = trimmedLine.substring(6).trim();
  const modernMatcher = declaration.match(MODERN_UDO_REGEX);

  if (modernMatcher) {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.MODERN);
    udo.setName(modernMatcher[1].trim());
    udo.setInputArguments(modernMatcher[2].trim());
    udo.setOutTypes(getModernOutTypesFromSignature(modernMatcher[3]));
    return udo;
  }

  const parts = declaration.split(',', 3);
  if (parts.length === 3) {
    const udo = new OpcodeDefinition();
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setName(parts[0].trim());
    udo.setOutTypes(parts[1].trim());
    udo.setInTypes(parts[2].trim());
    return udo;
  }

  return null;
}

function isInstrOrUDODeclarationBoundary(trimmedLine: string): boolean {
  return (
    trimmedLine.startsWith('opcode') ||
    trimmedLine.startsWith('instr') ||
    trimmedLine.startsWith('endop') ||
    trimmedLine.startsWith('endin')
  );
}

function stripMultiLineComments(text: string): string {
  // Remove /* ... */ comments
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripSingleLineComments(line: string): string {
  // Remove ; single-line comments (but not inside strings)
  const semiIndex = line.indexOf(';');
  if (semiIndex >= 0) return line.substring(0, semiIndex);
  return line;
}

// ─── Style Conversion ───

export function convertToModern(udo: OpcodeDefinition): void {
  let convertedInputArguments = getInputArgumentsFromCodeBody(udo.getCode());
  if (convertedInputArguments.trim().length === 0) {
    convertedInputArguments = getInputArgumentsFromTypeString(udo.getInTypes());
  } else {
    convertedInputArguments = applyLegacyTypeAnnotations(convertedInputArguments, udo.getInTypes());
  }

  udo.setInputArguments(convertedInputArguments);
  udo.setCode(trimLeadingBlankLines(removeXinLines(udo.getCode())));
  udo.setOutTypes(joinedOutTypesToCommaSeparated(udo.getOutTypes()));
  udo.setInTypes('');
  udo.setStyle(UDOStyle.MODERN);
}

export function convertToClassic(udo: OpcodeDefinition): void {
  const derivedInTypes = getInTypesFromInputArguments(udo.getInputArguments());
  if (derivedInTypes.length > 0) {
    udo.setInTypes(derivedInTypes);
  } else {
    udo.setInTypes('0');
  }

  udo.setOutTypes(commaSeparatedOutTypesToJoined(udo.getOutTypes()));

  const cleanedCodeBody = trimLeadingBlankLines(removeXinLines(udo.getCode()));
  if (udo.getInputArguments().trim().length === 0) {
    udo.setCode(cleanedCodeBody);
  } else {
    udo.setCode(stripTypeAnnotations(udo.getInputArguments()) + '\txin\n' + cleanedCodeBody);
  }

  udo.setInputArguments('');
  udo.setStyle(UDOStyle.CLASSIC);
}

/**
 * Append UDOs from newList into masterList, preserving Java-style
 * equivalence checks and collision renaming behavior.
 */
export function appendUserDefinedOpcodes(
  newList: OpcodeList,
  masterList: OpcodeList,
): Map<string, string> {
  const keyValues = new Map<string, string>();

  for (const udo of newList.getOpcodes()) {
    if (keyValues.size > 0) {
      udo.setCode(replaceOpcodeNames(keyValues, udo.getCode()));
    }

    const oldName = udo.getName();
    let newName = masterList.getNameOfEquivalentCopy(udo);

    if (newName == null) {
      if (!masterList.isNameUnique(oldName)) {
        newName = masterList.getUniqueName();
        udo.setName(newName);
      }

      masterList.addOpcode(udo);
    }

    if (newName != null && newName !== oldName) {
      keyValues.set(oldName, newName);
    }
  }

  return keyValues;
}
