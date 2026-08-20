import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');

const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.svg']);
const ignoredDirectories = new Set(['__mocks__', 'browser', 'tests', 'dist', 'build', 'node_modules', '.git']);

const APPROVED_ROLES = [
  { id: 'large-title', utility: 'text-role-large-title', variable: '--text-role-large-title', sizePx: 26, lineHeightPx: 32 },
  { id: 'title-2', utility: 'text-role-title-2', variable: '--text-role-title-2', sizePx: 17, lineHeightPx: 22 },
  { id: 'title-3', utility: 'text-role-title-3', variable: '--text-role-title-3', sizePx: 15, lineHeightPx: 20 },
  { id: 'headline', utility: 'text-role-headline', variable: '--text-role-headline', sizePx: 13, lineHeightPx: 16 },
  { id: 'body', utility: 'text-role-body', variable: '--text-role-body', sizePx: 13, lineHeightPx: 16 },
  { id: 'callout', utility: 'text-role-callout', variable: '--text-role-callout', sizePx: 12, lineHeightPx: 15 },
  { id: 'subheadline', utility: 'text-role-subheadline', variable: '--text-role-subheadline', sizePx: 11, lineHeightPx: 14 },
];

const legacyUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-(nano|micro|tiny|ui|body|content)\b/g;
const legacyVariableRegex = /--text-(nano|micro|tiny|ui|body|content)(?:--line-height)?\b/g;
const defaultScaleUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-(xs|sm|base|lg|xl|[2-9]xl)(?:\/(?:\[[^\]]+\]|[0-9]{1,3}))?\b/g;
const arbitraryFontSizeUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-\[(?<value>\d+(?:\.\d+)?(?:px|rem|em|pt)|var\(--[^)]+\))\](?:\/\[[^\]]+\])?/g;
const bracketFontSizeUtilityRegex = /(?:^|[^A-Za-z0-9_-])(?:[A-Za-z0-9_-]+:)*\[(?:font-size|font):(?<value>[^\]]+)\]/g;
const arbitraryLengthUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-\(length:(?<value>[^)]+)\)/g;
const rawCssFontSizeRegex = /\bfont-size\s*:\s*(?<value>[^;}\n]+)/g;
const inlineFontSizeRegex = /\b(?:fontSize|font-size)\s*:\s*(?:(?<numVal>\d+(?:\.\d+)?)|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>|\{(?<jsxVal>[^}]+)\})/g;
const svgFontSizeRegex = /<text\b[^>]*\b(?:fontSize|font-size)\s*=\s*(?:\{(?<jsxVal>[^}]+)\}|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>)/g;
const canvasFontLiteralRegex = /\b(?:ctx|context)\.font\s*=\s*(?<quote>['"`])(?<value>[^'"`]+)\k<quote>/g;
const leadingOverrideUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*(?:leading-(?:none|tight|snug|normal|relaxed|loose|\d+)|leading-\[[^\]]+\])/g;

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      files.push(...listFiles(absolutePath));
      continue;
    }

    if (
      textExtensions.has(path.extname(entry.name))
      && !/\.(?:test|spec)\.[^.]+$/u.test(entry.name)
      && !entry.name.endsWith('.d.ts')
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function parseExceptions(guidePath) {
  if (!existsSync(guidePath)) {
    return [];
  }
  const markdown = readFileSync(guidePath, 'utf8');
  const markerMatch = markdown.match(/<!-- renderer-typography-exceptions:start -->([\s\S]*?)<!-- renderer-typography-exceptions:end -->/);
  if (!markerMatch) {
    return [];
  }

  const jsonMatch = markerMatch[1].match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return Array.isArray(parsed?.exceptions) ? parsed.exceptions : [];
  } catch {
    return [];
  }
}

function isSubFloor(val) {
  if (!val) return false;
  const str = String(val).trim();
  const pxMatch = str.match(/(\d+(?:\.\d+)?)px/);
  if (pxMatch) {
    return Number.parseFloat(pxMatch[1]) < 11;
  }
  const remMatch = str.match(/(\d+(?:\.\d+)?)rem/);
  if (remMatch) {
    return Number.parseFloat(remMatch[1]) * 16 < 11;
  }
  const ptMatch = str.match(/(\d+(?:\.\d+)?)pt/);
  if (ptMatch) {
    return Number.parseFloat(ptMatch[1]) < 11;
  }
  const numMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return Number.parseFloat(numMatch[1]) < 11;
  }
  return false;
}

function extractThemeBlock(content) {
  const themeMatch = content.match(/@theme(?:\s+static)?\s*\{([^}]*)\}/s);
  return themeMatch ? themeMatch[1] : '';
}

export function runTypographyAudit(options = {}) {
  const repoRoot = options.root ? path.resolve(options.root) : defaultRepoRoot;
  const rendererScope = path.join(repoRoot, 'packages/blue-app/src/renderer');
  const sharedScope = path.join(repoRoot, 'packages/blue-app/src/shared');
  const themePath = options.theme ?? path.join(rendererScope, 'styles/index.css');
  const guidePath = options.guide ?? path.join(repoRoot, 'docs/typography.md');

  const findings = [];
  const inventory = [];
  const catalogErrors = [];

  const counts = {
    approvedRoleAssignments: 0,
    approvedProjectAuthoredExceptions: 0,
    approvedNonTextExceptions: 0,
    approvedLineHeightExceptions: 0,
    unapprovedLegacyRoles: 0,
    unapprovedDefaultScaleUtilities: 0,
    unapprovedArbitrarySizes: 0,
    applicationTextBelowFloor: 0,
    unapprovedCssSizes: 0,
    unapprovedInlineSizes: 0,
    unapprovedSvgSizes: 0,
    unapprovedCanvasFonts: 0,
    unapprovedLineHeightOverrides: 0,
    catalogErrors: 0,
    staleExceptions: 0,
  };

  const rawExceptions = parseExceptions(guidePath);
  const exceptionMatchCounts = new Map();
  for (const ex of rawExceptions) {
    exceptionMatchCounts.set(ex.id, 0);
  }

  // 1. Verify Catalog in themePath
  if (existsSync(themePath)) {
    const themeContent = readFileSync(themePath, 'utf8');

    for (const role of APPROVED_ROLES) {
      const varRegex = new RegExp(`${role.variable}:\\s*${role.sizePx}px;`);
      const lhRegex = new RegExp(`${role.variable}--line-height:\\s*${role.lineHeightPx}px;`);
      if (!varRegex.test(themeContent)) {
        catalogErrors.push(`Missing role variable definition: ${role.variable}: ${role.sizePx}px;`);
      }
      if (!lhRegex.test(themeContent)) {
        catalogErrors.push(`Missing role line-height definition: ${role.variable}--line-height: ${role.lineHeightPx}px;`);
      }
    }

    // Check Body baseline in global body rule
    if (!/font-size:\s*var\(--text-role-body\)/.test(themeContent)) {
      catalogErrors.push('Global body rule does not establish font-size: var(--text-role-body)');
    }
  } else {
    catalogErrors.push(`Theme file not found at ${themePath}`);
  }

  // Check 5 renderer entrypoints
  const entrypoints = ['main.tsx', 'settings-main.tsx', 'about-main.tsx', 'effect-editor.tsx', 'track-instrument-editor.tsx'];
  for (const ep of entrypoints) {
    const epPath = path.join(rendererScope, ep);
    if (existsSync(epPath)) {
      const epContent = readFileSync(epPath, 'utf8');
      if (!/import\s+['"].\/styles\/index\.css['"]/.test(epContent)) {
        catalogErrors.push(`Entrypoint ${ep} does not import styles/index.css`);
      }
    }
  }

  counts.catalogErrors = catalogErrors.length;

  // 2. Scan Files
  const allFiles = [...listFiles(rendererScope), ...listFiles(sharedScope)];

  // Match and count exceptions in scanned files
  for (const ex of rawExceptions) {
    const targetPath = path.join(repoRoot, ex.path);
    if (existsSync(targetPath)) {
      const targetContent = readFileSync(targetPath, 'utf8');
      if (ex.expression) {
        let matches = 0;
        let pos = 0;
        while ((pos = targetContent.indexOf(ex.expression, pos)) !== -1) {
          matches += 1;
          pos += ex.expression.length;
        }
        exceptionMatchCounts.set(ex.id, matches);
        if (matches === ex.expectedOccurrences) {
          if (ex.category === 'project-authored-font') counts.approvedProjectAuthoredExceptions += matches;
          else if (ex.category === 'non-text-glyph') counts.approvedNonTextExceptions += matches;
          else if (ex.category === 'single-line-line-height') counts.approvedLineHeightExceptions += matches;
        }
      }
    }
  }

  function hasExceptionMatch(relPath, lineContent) {
    for (const ex of rawExceptions) {
      if (ex.path === relPath && ex.expression && lineContent.includes(ex.expression)) {
        return ex;
      }
    }
    return null;
  }

  for (const absPath of allFiles) {
    const relPath = toPosix(path.relative(repoRoot, absPath));
    const isThemeFile = path.resolve(absPath) === path.resolve(themePath);
    const isCssFile = path.extname(absPath) === '.css';
    const content = readFileSync(absPath, 'utf8');
    const lines = content.split('\n');

    let inThemeBlock = false;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      if (isThemeFile) {
        if (line.includes('@theme')) inThemeBlock = true;
        if (inThemeBlock && line.includes('}')) inThemeBlock = false;
        if (inThemeBlock) return;
      }

      // Check approved role usages for inventory
      for (const role of APPROVED_ROLES) {
        if (line.includes(role.utility)) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: line.indexOf(role.utility) + 1,
            category: 'approved-role',
            value: role.utility,
            suggestedRole: role.id,
            classification: 'approved-role',
            exceptionId: null,
          });
          counts.approvedRoleAssignments += 1;
        }
      }

      const lineEx = hasExceptionMatch(relPath, line);

      // 1. Legacy custom roles
      for (const m of line.matchAll(legacyUtilityRegex)) {
        if (m[0].includes('text-role-')) continue;
        const isBelow = isSubFloor(m[1] === 'nano' ? '8px' : m[1] === 'micro' ? '9px' : m[1] === 'tiny' ? '10px' : '11px');
        if (isBelow && !lineEx) counts.applicationTextBelowFloor += 1;

        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'legacy-role',
            value: m[0],
            suggestedRole: 'body',
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedLegacyRoles += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'legacy-role',
            value: m[0],
            suggestedRole: 'body',
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      // Legacy variables
      for (const m of line.matchAll(legacyVariableRegex)) {
        if (m[0].includes('--text-role-')) continue;
        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'legacy-variable',
            value: m[0],
            suggestedRole: 'body',
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedLegacyRoles += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'legacy-variable',
            value: m[0],
            suggestedRole: 'body',
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      // 2. Default scale utilities
      for (const m of line.matchAll(defaultScaleUtilityRegex)) {
        const matched = m[0];
        if (matched.includes('text-role-')) continue;
        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'default-scale-utility',
            value: matched,
            suggestedRole: 'body',
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedDefaultScaleUtilities += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'default-scale-utility',
            value: matched,
            suggestedRole: 'body',
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      // 3. Arbitrary font sizes
      for (const m of line.matchAll(arbitraryFontSizeUtilityRegex)) {
        const val = m.groups?.value;
        if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedArbitrarySizes += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      for (const m of line.matchAll(bracketFontSizeUtilityRegex)) {
        const val = m.groups?.value;
        if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedArbitrarySizes += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      for (const m of line.matchAll(arbitraryLengthUtilityRegex)) {
        if (lineEx) {
          inventory.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'approved-exception',
            exceptionId: lineEx.id,
          });
        } else {
          counts.unapprovedArbitrarySizes += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: m.index + 1,
            category: 'arbitrary-size',
            value: m[0],
            suggestedRole: null,
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      // 4. Raw CSS font-size
      if (isCssFile) {
        for (const m of line.matchAll(rawCssFontSizeRegex)) {
          const val = m.groups?.value?.trim();
          if (val && !val.startsWith('var(--text-role-')) {
            if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

            if (lineEx) {
              inventory.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'raw-css-size',
                value: m[0],
                suggestedRole: null,
                classification: 'approved-exception',
                exceptionId: lineEx.id,
              });
            } else {
              counts.unapprovedCssSizes += 1;
              findings.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'raw-css-size',
                value: m[0],
                suggestedRole: null,
                classification: 'rejected',
                exceptionId: null,
              });
            }
          }
        }
      }

      // 5. Inline/React font-size
      if (!isCssFile) {
        for (const m of line.matchAll(inlineFontSizeRegex)) {
          const val = m.groups?.numVal ?? m.groups?.strVal ?? m.groups?.jsxVal;
          if (val && !String(val).includes('var(--text-role-')) {
            if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

            if (lineEx) {
              inventory.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'inline-font-size',
                value: m[0],
                suggestedRole: null,
                classification: 'approved-exception',
                exceptionId: lineEx.id,
              });
            } else {
              counts.unapprovedInlineSizes += 1;
              findings.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'inline-font-size',
                value: m[0],
                suggestedRole: null,
                classification: 'rejected',
                exceptionId: null,
              });
            }
          }
        }

        // 6. SVG font-size
        for (const m of line.matchAll(svgFontSizeRegex)) {
          const val = m.groups?.strVal ?? m.groups?.jsxVal;
          if (val && !String(val).includes('var(--text-role-')) {
            if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

            if (lineEx) {
              inventory.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'svg-font-size',
                value: m[0],
                suggestedRole: null,
                classification: 'approved-exception',
                exceptionId: lineEx.id,
              });
            } else {
              counts.unapprovedSvgSizes += 1;
              findings.push({
                path: relPath,
                line: lineNumber,
                column: m.index + 1,
                category: 'svg-font-size',
                value: m[0],
                suggestedRole: null,
                classification: 'rejected',
                exceptionId: null,
              });
            }
          }
        }

        // 7. Canvas font literal
        for (const m of line.matchAll(canvasFontLiteralRegex)) {
          const val = m.groups?.value;
          if (isSubFloor(val) && !lineEx) counts.applicationTextBelowFloor += 1;

          if (lineEx) {
            inventory.push({
              path: relPath,
              line: lineNumber,
              column: m.index + 1,
              category: 'canvas-font',
              value: m[0],
              suggestedRole: null,
              classification: 'approved-exception',
              exceptionId: lineEx.id,
            });
          } else {
            counts.unapprovedCanvasFonts += 1;
            findings.push({
              path: relPath,
              line: lineNumber,
              column: m.index + 1,
              category: 'canvas-font',
              value: m[0],
              suggestedRole: null,
              classification: 'rejected',
              exceptionId: null,
            });
          }
        }

        // 8. Line height override
        for (const m of line.matchAll(leadingOverrideUtilityRegex)) {
          if (lineEx) {
            inventory.push({
              path: relPath,
              line: lineNumber,
              column: m.index + 1,
              category: 'line-height-override',
              value: m[0],
              suggestedRole: null,
              classification: 'approved-exception',
              exceptionId: lineEx.id,
            });
          } else {
            counts.unapprovedLineHeightOverrides += 1;
            findings.push({
              path: relPath,
              line: lineNumber,
              column: m.index + 1,
              category: 'line-height-override',
              value: m[0],
              suggestedRole: null,
              classification: 'rejected',
              exceptionId: null,
            });
          }
        }
      }
    });
  }

  // Check stale exceptions
  const staleExceptions = [];
  const approvedExceptions = [];
  for (const ex of rawExceptions) {
    const count = exceptionMatchCounts.get(ex.id) || 0;
    if (count !== ex.expectedOccurrences) {
      staleExceptions.push({ ...ex, observedOccurrences: count });
    } else {
      approvedExceptions.push(ex);
    }
  }
  counts.staleExceptions = staleExceptions.length;

  const passed = counts.catalogErrors === 0
    && counts.staleExceptions === 0
    && counts.unapprovedLegacyRoles === 0
    && counts.unapprovedDefaultScaleUtilities === 0
    && counts.unapprovedArbitrarySizes === 0
    && counts.applicationTextBelowFloor === 0
    && counts.unapprovedCssSizes === 0
    && counts.unapprovedInlineSizes === 0
    && counts.unapprovedSvgSizes === 0
    && counts.unapprovedCanvasFonts === 0
    && counts.unapprovedLineHeightOverrides === 0;

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column);
  inventory.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column);

  return {
    schemaVersion: 1,
    root: toPosix(path.relative(repoRoot, repoRoot) || '.'),
    catalog: APPROVED_ROLES,
    counts,
    inventory,
    approvedExceptions,
    staleExceptions,
    findings,
    catalogErrors,
    passed,
  };
}

// If run from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let root = defaultRepoRoot;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) {
      root = args[i + 1];
      i += 1;
    }
  }

  try {
    const result = runTypographyAudit({ root });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error('Fatal error during typography audit:', err);
    process.exit(2);
  }
}
