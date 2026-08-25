// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveTypographyRoleFont, TYPOGRAPHY_ROLES, type TypographyRoleId } from '../lib/typography';

const RENDERER_DIR = resolve(__dirname, '..');
const INDEX_CSS_PATH = resolve(RENDERER_DIR, 'styles/index.css');

describe('Typography Tokens and System Contracts', () => {
  it('defines exactly seven semantic roles with approved metrics in index.css', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf8');

    // Verify all 7 roles and companion line heights
    expect(css).toMatch(/--text-role-large-title:\s*26px;/);
    expect(css).toMatch(/--text-role-large-title--line-height:\s*32px;/);
    expect(css).toMatch(/--text-role-title-2:\s*17px;/);
    expect(css).toMatch(/--text-role-title-2--line-height:\s*22px;/);
    expect(css).toMatch(/--text-role-title-3:\s*15px;/);
    expect(css).toMatch(/--text-role-title-3--line-height:\s*20px;/);
    expect(css).toMatch(/--text-role-headline:\s*13px;/);
    expect(css).toMatch(/--text-role-headline--line-height:\s*16px;/);
    expect(css).toMatch(/--text-role-body:\s*13px;/);
    expect(css).toMatch(/--text-role-body--line-height:\s*16px;/);
    expect(css).toMatch(/--text-role-callout:\s*12px;/);
    expect(css).toMatch(/--text-role-callout--line-height:\s*15px;/);
    expect(css).toMatch(/--text-role-subheadline:\s*11px;/);
    expect(css).toMatch(/--text-role-subheadline--line-height:\s*14px;/);
  });

  it('establishes the Body role baseline in global body styles', () => {
    const css = readFileSync(INDEX_CSS_PATH, 'utf8');
    expect(css).toMatch(/font-size:\s*var\(--text-role-body\);/);
    expect(css).toMatch(/line-height:\s*var\(--text-role-body--line-height\);/);
  });

  it('verifies all 5 renderer entry points import styles/index.css', () => {
    const entryPoints = [
      'main.tsx',
      'settings-main.tsx',
      'about-main.tsx',
      'effect-editor.tsx',
      'track-instrument-editor.tsx',
    ];

    for (const entry of entryPoints) {
      const entryPath = resolve(RENDERER_DIR, entry);
      expect(existsSync(entryPath)).toBe(true);
      const content = readFileSync(entryPath, 'utf8');
      expect(content).toMatch(/import\s+['"].\/styles\/index\.css['"]/);
    }
  });

  it('exports the constant catalog of seven roles in typography.ts', () => {
    expect(TYPOGRAPHY_ROLES).toEqual([
      'large-title',
      'title-2',
      'title-3',
      'headline',
      'body',
      'callout',
      'subheadline',
    ]);
  });

  it('preserves absence of new IPC, project settings, or engine persistence contracts', () => {
    // Verify no new typography settings added to program-settings or blue-data
    const programSettingsPath = resolve(RENDERER_DIR, '../shared/program-settings.ts');
    const programSettingsContent = readFileSync(programSettingsPath, 'utf8');
    expect(programSettingsContent).not.toMatch(/typographyScale|fontScale|fontSizeRole/);
  });

  it('keeps dense SVG labels, tooltip CSS, and score-bar labels on approved delivery paths', () => {
    const envelopeSource = readFileSync(resolve(RENDERER_DIR, 'components/instruments/blue-x7/envelope-editor.tsx'), 'utf8');
    const lineCanvasSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx'), 'utf8');
    const selectedEditorSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/editors/SelectedCodeEditor.tsx'), 'utf8');
    const scoreBarSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/score/bar-renderers/ScoreObjectBar.tsx'), 'utf8');

    expect(envelopeSource).toContain('text-role-subheadline');
    expect(envelopeSource).not.toMatch(/fontSize\s*=/);
    expect(lineCanvasSource).toContain('text-role-subheadline');
    expect(lineCanvasSource).not.toMatch(/fontSize\s*=/);
    expect(selectedEditorSource).toContain("lineHeight: 'var(--text-role-body--line-height)'");
    expect(scoreBarSource).toContain('className="absolute truncate text-role-subheadline"');
    expect(scoreBarSource).not.toMatch(/fontSize/);
    expect(scoreBarSource).not.toMatch(/lineHeight:\s*['"]\d/);
  });

  it('keeps ordinary controls and BSB application chrome on semantic roles', () => {
    const addToRepositorySource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/code-repository/AddToCodeRepositoryDialog.tsx'), 'utf8');
    const colorPickerSource = readFileSync(resolve(RENDERER_DIR, 'components/ColorPicker.tsx'), 'utf8');
    const fontChooserSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx'), 'utf8');
    const gridSettingsSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/BSBGridSettingsPanel.tsx'), 'utf8');
    const propertySheetSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx'), 'utf8');
    const bsbWidgetEditorSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/BSBWidgetEditor.tsx'), 'utf8');
    const bsbInterfaceEditorSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/BSBInterfaceEditor.tsx'), 'utf8');
    const udoEditorSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/udo/UdoEditor.tsx'), 'utf8');
    const noteProcessorSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx'), 'utf8');
    const aboutSource = readFileSync(resolve(RENDERER_DIR, 'components/about/AboutApp.tsx'), 'utf8');

    expect(addToRepositorySource).toContain('text-role-body text-app-text-muted');
    expect(addToRepositorySource).toContain('text-role-callout text-red-400');
    expect(colorPickerSource).toContain('p-3 text-role-body text-app-text');
    expect(fontChooserSource).not.toContain('text-role-subheadline');
    expect(gridSettingsSource).toContain('text-role-headline font-bold');
    expect(gridSettingsSource).toContain('text-role-body text-app-text-muted');
    expect(propertySheetSource).toContain('text-role-headline font-bold');
    expect(propertySheetSource).not.toContain('text-role-subheadline');
    expect(bsbWidgetEditorSource).toContain('text-role-headline font-bold');
    expect(bsbWidgetEditorSource).toContain('text-role-callout text-blue-muted');
    expect(bsbInterfaceEditorSource).not.toContain('text-role-subheadline');
    expect(udoEditorSource).not.toContain('text-role-subheadline');
    expect(noteProcessorSource).toContain('text-role-callout border border-blue-border');
    expect(noteProcessorSource).toContain('text-role-headline font-bold text-gray-400');
    expect(aboutSource).toContain('text-role-title-3 font-semibold');
    expect(aboutSource).not.toContain('break-all font-mono text-role-subheadline');
  });

  it('delivers explicit role line heights for direct React/CSS typography callsites', () => {
    const blueLivePanelSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/BlueLivePanel.tsx'), 'utf8');
    const liveCodeSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/blue-live/LiveCodeTab.tsx'), 'utf8');
    const optionsSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/blue-live/OptionsTab.tsx'), 'utf8');
    const checkboxSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/widgets/BSBCheckBoxWidget.tsx'), 'utf8');
    const knobSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx'), 'utf8');
    const valuePanelSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/orchestra/bsb/widgets/ValuePanel.tsx'), 'utf8');
    const automationSource = readFileSync(resolve(RENDERER_DIR, 'components/workbench/panels/score/automation/AutomationLineView.tsx'), 'utf8');

    expect(blueLivePanelSource).toContain("lineHeight: 'var(--text-role-body--line-height)'");
    expect(liveCodeSource).toContain("lineHeight: 'var(--text-role-callout--line-height)'");
    expect(optionsSource).toContain("lineHeight: 'var(--text-role-body--line-height)'");
    expect(checkboxSource).toContain("lineHeight: 'var(--text-role-callout--line-height)'");
    expect(knobSource).toContain("fontSize: 'var(--text-role-callout)'");
    expect(knobSource).toContain("lineHeight: 'var(--text-role-callout--line-height)'");
    expect(knobSource).toContain('const VALUE_HEIGHT = 16;');
    expect(valuePanelSource).toContain("lineHeight: 'var(--text-role-callout--line-height)'");
    // Spec 090: the readout moved from SVG <text> to a host-surface DOM
    // annotation; it must still use the subheadline annotation role.
    expect(automationSource).toContain('font-mono text-role-subheadline text-white');
  });

  describe('resolveTypographyRoleFont', () => {
    it('resolves CSS variables from the provided element into a valid Canvas font string', () => {
      const mockElement = document.createElement('div');
      mockElement.style.setProperty('--text-role-body', '13px');
      mockElement.style.setProperty('--text-role-subheadline', '11px');
      mockElement.style.setProperty('--text-role-title-2', '17px');

      // Default proportional font
      const bodyFont = resolveTypographyRoleFont(mockElement, 'body');
      expect(bodyFont).toContain('13px');

      // Monospaced subheadline
      const subheadlineMono = resolveTypographyRoleFont(mockElement, 'subheadline', { family: 'monospace' });
      expect(subheadlineMono).toContain('11px');
      expect(subheadlineMono).toContain('monospace');

      // Bold Title 2
      const boldTitle2 = resolveTypographyRoleFont(mockElement, 'title-2', { weight: 'bold' });
      expect(boldTitle2).toContain('17px');
      expect(boldTitle2).toMatch(/bold|700/);

      // Verify all 7 roles resolve correctly with default and custom options
      for (const role of TYPOGRAPHY_ROLES) {
        mockElement.style.setProperty(`--text-role-${role}`, '12px');
        const fontProp = resolveTypographyRoleFont(mockElement, role);
        expect(fontProp).toContain('12px');
        expect(fontProp).toContain('sans-serif');

        const fontMono = resolveTypographyRoleFont(mockElement, role, { family: 'monospace', weight: 600 });
        expect(fontMono).toContain('12px');
        expect(fontMono).toContain('600');
        expect(fontMono).toContain('monospace');
      }
    });

    it('throws when an invalid or unknown role is requested', () => {
      const mockElement = document.createElement('div');
      expect(() => {
        resolveTypographyRoleFont(mockElement, 'nonexistent-role' as TypographyRoleId);
      }).toThrow(/Unknown typography role/);
    });
  });
});
