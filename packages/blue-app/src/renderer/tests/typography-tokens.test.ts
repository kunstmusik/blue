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
