import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export interface JsxNumericSite {
  filePath: string;
  relativePath: string;
  line: number;
  tagName: string;
  isRawInput: boolean;
}

export function scanRendererNumericSites(rendererDir: string): {
  allSites: JsxNumericSite[];
  rawInputSites: JsxNumericSite[];
  wrapperSites: JsxNumericSite[];
} {
  const allSites: JsxNumericSite[] = [];
  const rawInputSites: JsxNumericSite[] = [];
  const wrapperSites: JsxNumericSite[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'tests' ||
          entry.name === 'browser' ||
          entry.name === 'node_modules' ||
          entry.name === 'dist'
        ) {
          continue;
        }
        walk(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        // Skip CommitNumberInput's own implementation
        const isCommitNumberInputImpl = entry.name === 'CommitNumberInput.tsx';

        const content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes('number')) continue;

        const sourceFile = ts.createSourceFile(
          fullPath,
          content,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );

        function visit(node: ts.Node): void {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tagName = node.tagName.getText(sourceFile);
            let hasTypeNumber = false;
            for (const prop of node.attributes.properties) {
              if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === 'type') {
                const init = prop.initializer;
                if (
                  init &&
                  (init.getText(sourceFile) === '"number"' ||
                    init.getText(sourceFile) === "'number'" ||
                    init.getText(sourceFile) === '{"number"}' ||
                    init.getText(sourceFile) === "{'number'}")
                ) {
                  hasTypeNumber = true;
                  break;
                }
              }
            }

            if (hasTypeNumber) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              const relativePath = path.relative(rendererDir, fullPath);
              const site: JsxNumericSite = {
                filePath: fullPath,
                relativePath,
                line: line + 1,
                tagName,
                isRawInput: tagName === 'input',
              };

              // Only count sites outside of CommitNumberInput implementation
              if (!isCommitNumberInputImpl) {
                allSites.push(site);
                if (site.isRawInput) {
                  rawInputSites.push(site);
                } else {
                  wrapperSites.push(site);
                }
              }
            }
          }
          ts.forEachChild(node, visit);
        }

        visit(sourceFile);
      }
    }
  }

  walk(rendererDir);
  return { allSites, rawInputSites, wrapperSites };
}

const NUMERIC_TAGS = new Set([
  'CommitNumberInput',
  'CommitNumberField',
  'SettingsNumberField',
  'SettingsDraftNumberField',
  'LiveNumberInput',
  'DraftNumberInput',
]);

export function countMigratedNumericComponentsInFile(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let count = 0;
  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (NUMERIC_TAGS.has(tagName)) {
        count++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

describe('Number input inventory and source boundaries (T005, T028, T037, T043)', () => {
  const rendererDir = path.resolve(__dirname, '..');

  const ORDINARY_MIGRATED_SITES: Record<string, number> = {
    'components/settings/OscSettings.tsx': 1,
    'components/settings/PlaybackSettings.tsx': 2,
    'components/settings/UtilitySettings.tsx': 1,
    'components/settings/GeneralSettings.tsx': 1,
    'components/settings/RealtimeRenderSettings.tsx': 2,
    'components/effect-editor/EffectEditorPanel.tsx': 2,
    'components/workbench/panels/orchestra/bsb/BSBGridSettingsPanel.tsx': 2,
    'components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx': 2,
    'components/workbench/panels/VirtualKeyboardPanel.tsx': 3,
    'components/workbench/panels/MixerPanel.tsx': 1,
    'components/workbench/panels/blue-live/LiveSpaceTab.tsx': 2,
    'components/workbench/panels/shared/line-editor/LineDefinitionTable.tsx': 2,
    'components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx': 2,
    'components/workbench/panels/score-object/editors/TrackerObjectEditor.tsx': 1,
    'components/workbench/panels/score-object/editors/ZakLineObjectEditor.tsx': 2,
    'components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx': 5,
    'components/workbench/panels/score-object/editors/PatternObjectEditor.tsx': 2,
    'components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor.tsx': 1,
    'components/workbench/panels/score-object/editors/pianoroll/FieldDefinitionsEditor.tsx': 3,
  };

  const SPECIALIZED_MIGRATED_SITES: Record<string, number> = {
    'components/instruments/blue-x7/lfo-panel.tsx': 4,
    'components/instruments/blue-x7/common-panel.tsx': 3,
    'components/instruments/blue-x7/operator-panel.tsx': 13,
    'components/instruments/blue-x7/pitch-envelope-panel.tsx': 2,
    'components/workbench/panels/score/TempoPointDialog.tsx': 2,
    'components/workbench/panels/score/ShiftObjectsDialog.tsx': 1,
    'components/workbench/panels/score/MeterEntryDialog.tsx': 1,
    'components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx': 1,
    'components/workbench/panels/score/MeterMapEditorDialog.tsx': 1,
    'components/workbench/panels/score/TempoMapEditorDialog.tsx': 1,
  };

  it('verifies that all 37 ordinary audited numeric sites are accounted for (T028, T043)', () => {
    let ordinaryTotal = 0;
    for (const [relPath, expectedCount] of Object.entries(ORDINARY_MIGRATED_SITES)) {
      const fullPath = path.join(rendererDir, relPath);
      expect(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`).toBe(true);
      const actualCount = countMigratedNumericComponentsInFile(fullPath);
      expect(
        actualCount,
        `Expected ${expectedCount} migrated components in ${relPath} but found ${actualCount}`,
      ).toBe(expectedCount);
      ordinaryTotal += actualCount;
    }
    expect(ordinaryTotal).toBe(37);
  });

  it('verifies that all 29 specialized audited numeric sites are accounted for (T037, T043)', () => {
    let specializedTotal = 0;
    for (const [relPath, expectedCount] of Object.entries(SPECIALIZED_MIGRATED_SITES)) {
      const fullPath = path.join(rendererDir, relPath);
      expect(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`).toBe(true);
      const actualCount = countMigratedNumericComponentsInFile(fullPath);
      expect(
        actualCount,
        `Expected ${expectedCount} migrated components in ${relPath} but found ${actualCount}`,
      ).toBe(expectedCount);
      specializedTotal += actualCount;
    }
    expect(specializedTotal).toBe(29);
  });

  it('verifies total migrated inventory is exactly 66 sites (37 ordinary + 29 specialized) (T043)', () => {
    const ordinaryCount = Object.values(ORDINARY_MIGRATED_SITES).reduce((a, b) => a + b, 0);
    const specializedCount = Object.values(SPECIALIZED_MIGRATED_SITES).reduce((a, b) => a + b, 0);
    expect(ordinaryCount).toBe(37);
    expect(specializedCount).toBe(29);
    expect(ordinaryCount + specializedCount).toBe(66);
  });

  it('verifies that 0 raw number inputs remain outside CommitNumberInput.tsx across entire renderer (T037, T043)', () => {
    const { allSites, rawInputSites, wrapperSites } = scanRendererNumericSites(rendererDir);

    // All 66 audited production sites have been consolidated into CommitNumberInput:
    // Exactly 0 raw number inputs outside CommitNumberInput.tsx remain across the entire renderer!
    expect(allSites.length).toBe(0);
    expect(rawInputSites.length).toBe(0);
    expect(wrapperSites.length).toBe(0);
    expect(allSites).toEqual([]);
  });

  it('verifies no old jmask path exists or is imported anywhere in renderer (T018, T037, T043)', () => {
    const oldJmaskPath = path.resolve(
      rendererDir,
      'components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx',
    );
    expect(fs.existsSync(oldJmaskPath)).toBe(false);

    // Scan all non-test files in rendererDir for stale imports
    function scanImports(currentDir: string): void {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'tests' ||
            entry.name === 'browser'
          )
            continue;
          scanImports(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(
            content.includes('score-object/editors/jmask/CommitNumberInput'),
            `Found stale jmask import in ${fullPath}`,
          ).toBe(false);
        }
      }
    }
    scanImports(rendererDir);
  });
});
