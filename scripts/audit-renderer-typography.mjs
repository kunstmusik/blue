import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');

const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.svg']);
const ignoredDirectories = new Set([
  '__mocks__',
  'browser',
  'tests',
  'dist',
  'build',
  'node_modules',
  '.git',
]);

const APPROVED_ROLES = [
  {
    id: 'large-title',
    utility: 'text-role-large-title',
    variable: '--text-role-large-title',
    sizePx: 26,
    lineHeightPx: 32,
  },
  {
    id: 'title-2',
    utility: 'text-role-title-2',
    variable: '--text-role-title-2',
    sizePx: 17,
    lineHeightPx: 22,
  },
  {
    id: 'title-3',
    utility: 'text-role-title-3',
    variable: '--text-role-title-3',
    sizePx: 15,
    lineHeightPx: 20,
  },
  {
    id: 'headline',
    utility: 'text-role-headline',
    variable: '--text-role-headline',
    sizePx: 13,
    lineHeightPx: 16,
  },
  {
    id: 'body',
    utility: 'text-role-body',
    variable: '--text-role-body',
    sizePx: 13,
    lineHeightPx: 16,
  },
  {
    id: 'callout',
    utility: 'text-role-callout',
    variable: '--text-role-callout',
    sizePx: 12,
    lineHeightPx: 15,
  },
  {
    id: 'subheadline',
    utility: 'text-role-subheadline',
    variable: '--text-role-subheadline',
    sizePx: 11,
    lineHeightPx: 14,
  },
];

const legacyUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-(nano|micro|tiny|ui|body|content)\b/g;
const legacyVariableRegex = /--text-(nano|micro|tiny|ui|body|content)(?:--line-height)?\b/g;
const defaultScaleUtilityRegex =
  /\b(?:[A-Za-z0-9_-]+:)*text-(xs|sm|base|lg|xl|[2-9]xl)(?:\/(?:\[[^\]]+\]|[0-9]{1,3}))?\b/g;
const arbitraryFontSizeUtilityRegex =
  /\b(?:[A-Za-z0-9_-]+:)*text-\[(?<value>\d+(?:\.\d+)?(?:px|rem|em|pt)|var\(--[^)]+\))\](?:\/\[[^\]]+\])?/g;
const bracketFontSizeUtilityRegex =
  /(?:^|[^A-Za-z0-9_-])(?:[A-Za-z0-9_-]+:)*\[(?:font-size|font):(?<value>[^\]]+)\]/g;
const arbitraryLengthUtilityRegex = /\b(?:[A-Za-z0-9_-]+:)*text-\(length:(?<value>[^)]+)\)/g;
const rawCssFontSizeRegex = /(?<![-\w])font-size\s*:\s*(?<value>[^;}\n]+)/g;
const rawCssFontRegex = /(?<![-\w])font\s*:\s*(?<value>[^;}\n]+)/g;
const rawCssLineHeightRegex = /(?<![-\w])line-height\s*:\s*(?<value>[^;}\n]+)/g;
const inlineFontSizeRegex =
  /\b(?:fontSize|font-size)\s*:\s*(?:(?<numVal>\d+(?:\.\d+)?)|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>|\{(?<jsxVal>[^}]+)\})/g;
const svgFontSizeRegex =
  /<text\b[^>]*\b(?:fontSize|font-size)\s*=\s*(?:\{(?<jsxVal>[^}]+)\}|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>)/g;
const jsxFontSizeAttributeRegex =
  /\b(?:fontSize|font-size)\s*=\s*(?:\{(?<jsxVal>[^}]+)\}|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>)/g;
const inlineLineHeightRegex =
  /\b(?:lineHeight|line-height)\s*:\s*(?:(?<numVal>\d+(?:\.\d+)?)|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>|\{(?<jsxVal>[^}]+)\})/g;
const inlineStyleFontRegex =
  /\bstyle\s*=\s*\{\{[^}\n]*\bfont\s*:\s*(?:(?<quote>['"])(?<strVal>[^'"]+)\k<quote>|\{(?<jsxVal>[^}]+)\})/g;
const styleAssignmentRegex =
  /\bstyle\.(?<property>fontSize|font|lineHeight)\s*=\s*(?<value>(?:\d+(?:\.\d+)?(?:px|rem|em|pt)?|['"][^'"]+['"]|var\(--[^)]+\)))/g;
const styleSetPropertyRegex =
  /\.setProperty\(\s*['"](?<property>font-size|font|line-height)['"]\s*,\s*(?<value>[^,)]+)[^)]*\)/g;
const canvasFontLiteralRegex =
  /\b(?:ctx|context)\.font\s*=\s*(?<quote>['"`])(?<value>[^'"`]+)\k<quote>/g;
const leadingOverrideUtilityRegex =
  /\b(?:[A-Za-z0-9_-]+:)*(?:leading-(?:none|tight|snug|normal|relaxed|loose|\d+)|leading-\[[^\]]+\])/g;
const canvasTextCallRegex = /\b(?:ctx|context)\.(?:fillText|strokeText)\s*\(/g;
const implicitSmallElementRegex = /<(?:small|sub|sup)\b[^>]*>/g;
const headlineUtilityRegex = /(?:^|[\s"'`])(?:[A-Za-z0-9_-]+:)*text-role-headline(?=$|[\s"'`])/g;

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
      textExtensions.has(path.extname(entry.name)) &&
      !/\.(?:test|spec)\.[^.]+$/u.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function parseExceptions(guidePath) {
  if (!existsSync(guidePath)) {
    throw new Error(`Typography guide not found at ${guidePath}`);
  }
  const markdown = readFileSync(guidePath, 'utf8');
  const markerMatch = markdown.match(
    /<!-- renderer-typography-exceptions:start -->([\s\S]*?)<!-- renderer-typography-exceptions:end -->/,
  );
  if (!markerMatch) {
    throw new Error('Typography exception registry markers are missing');
  }

  const jsonMatch = markerMatch[1].match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    throw new Error('Typography exception registry JSON block is missing');
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.exceptions)) {
      throw new Error(
        'Typography exception registry must use schemaVersion 1 with an exceptions array',
      );
    }

    const allowedCategories = new Set([
      'project-authored-font',
      'non-text-glyph',
      'single-line-line-height',
    ]);
    const ids = new Set();
    for (const exception of parsed.exceptions) {
      if (
        !exception ||
        typeof exception.id !== 'string' ||
        ids.has(exception.id) ||
        typeof exception.path !== 'string' ||
        exception.path.includes('\\') ||
        exception.path.includes('*') ||
        exception.path.includes('..') ||
        typeof exception.category !== 'string' ||
        !allowedCategories.has(exception.category) ||
        typeof exception.expression !== 'string' ||
        exception.expression.length === 0 ||
        !Number.isInteger(exception.expectedOccurrences) ||
        exception.expectedOccurrences < 1 ||
        typeof exception.ownerSurface !== 'string' ||
        typeof exception.reason !== 'string' ||
        typeof exception.verification !== 'string' ||
        typeof exception.reviewPolicy !== 'string'
      ) {
        throw new Error('Typography exception registry contains a malformed or duplicate record');
      }
      ids.add(exception.id);
    }
    return parsed.exceptions;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Typography exception registry')) {
      throw error;
    }
    throw new Error(
      `Typography exception registry JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
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
  const themeMatch = content.match(/@theme(?<modifier>\s+static)?\s*\{(?<body>[^}]*)\}/s);
  return themeMatch
    ? { body: themeMatch.groups?.body ?? '', isStatic: Boolean(themeMatch.groups?.modifier) }
    : null;
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
    unapprovedImplicitElements: 0,
    unapprovedHeadlineWeights: 0,
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
    const theme = extractThemeBlock(themeContent);

    if (!theme) {
      catalogErrors.push('Typography theme block is missing');
    } else {
      if (!theme.isStatic) {
        catalogErrors.push('Typography theme block must use @theme static');
      }
      if (!/--text-\*:\s*initial\s*;/.test(theme.body)) {
        catalogErrors.push(
          'Typography theme must reset the --text-* namespace before role definitions',
        );
      }

      const primaryTextTokens = [...theme.body.matchAll(/^\s*--text-([A-Za-z0-9-]+):/gm)]
        .map((match) => `--text-${match[1]}`)
        .filter((name) => !name.endsWith('--line-height'));
      const approvedTokenNames = new Set(APPROVED_ROLES.map((role) => role.variable));
      for (const token of primaryTextTokens) {
        if (!approvedTokenNames.has(token)) {
          catalogErrors.push(`Unapproved primary typography token: ${token}`);
        }
      }
    }

    for (const role of APPROVED_ROLES) {
      const varRegex = new RegExp(`${role.variable}:\\s*${role.sizePx}px;`);
      const lhRegex = new RegExp(`${role.variable}--line-height:\\s*${role.lineHeightPx}px;`);
      if (!varRegex.test(themeContent)) {
        catalogErrors.push(`Missing role variable definition: ${role.variable}: ${role.sizePx}px;`);
      }
      if (!lhRegex.test(themeContent)) {
        catalogErrors.push(
          `Missing role line-height definition: ${role.variable}--line-height: ${role.lineHeightPx}px;`,
        );
      }
      if (role.sizePx < 11 || role.lineHeightPx < role.sizePx) {
        catalogErrors.push(`Role ${role.id} violates the minimum size/line-height contract`);
      }
    }

    // Check Body baseline in global body rule
    if (
      !/font-size:\s*var\(--text-role-body\)/.test(themeContent) ||
      !/line-height:\s*var\(--text-role-body--line-height\)/.test(themeContent)
    ) {
      catalogErrors.push('Global body rule does not establish font-size: var(--text-role-body)');
    }
  } else {
    catalogErrors.push(`Theme file not found at ${themePath}`);
  }

  // Check 5 renderer entrypoints
  const entrypoints = [
    'main.tsx',
    'settings-main.tsx',
    'about-main.tsx',
    'effect-editor.tsx',
    'track-instrument-editor.tsx',
  ];
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
          if (ex.category === 'project-authored-font')
            counts.approvedProjectAuthoredExceptions += matches;
          else if (ex.category === 'non-text-glyph') counts.approvedNonTextExceptions += matches;
          else if (ex.category === 'single-line-line-height')
            counts.approvedLineHeightExceptions += matches;
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

      if (!isThemeFile && !line.includes('font-bold')) {
        for (const match of line.matchAll(headlineUtilityRegex)) {
          counts.unapprovedHeadlineWeights += 1;
          findings.push({
            path: relPath,
            line: lineNumber,
            column: (match.index ?? 0) + 1,
            category: 'headline-weight',
            value: 'text-role-headline',
            suggestedRole: 'headline',
            classification: 'rejected',
            exceptionId: null,
          });
        }
      }

      const lineEx = hasExceptionMatch(relPath, line);

      // 1. Legacy custom roles
      for (const m of line.matchAll(legacyUtilityRegex)) {
        if (m[0].includes('text-role-')) continue;
        const isBelow = isSubFloor(
          m[1] === 'nano' ? '8px' : m[1] === 'micro' ? '9px' : m[1] === 'tiny' ? '10px' : '11px',
        );
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

    const lineLocation = (index) => {
      const line = content.slice(0, index).split('\n').length;
      const lineStart = content.lastIndexOf('\n', index - 1) + 1;
      return { line, column: index - lineStart + 1 };
    };

    const lineExceptionAt = (index) => {
      const lineStart = content.lastIndexOf('\n', index - 1) + 1;
      const lineEnd = content.indexOf('\n', index);
      const lineContent = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
      return hasExceptionMatch(relPath, lineContent);
    };

    const recordAssignment = ({
      match,
      category,
      value,
      countKey,
      suggestedRole = null,
      approved,
      countsFloor = true,
    }) => {
      if (approved) return;
      const index = match.index ?? 0;
      const location = lineLocation(index);
      const lineEx = lineExceptionAt(index);
      if (lineEx) {
        inventory.push({
          path: relPath,
          line: location.line,
          column: location.column,
          category,
          value: match[0],
          suggestedRole,
          classification: 'approved-exception',
          exceptionId: lineEx.id,
        });
        return;
      }

      if (countsFloor && isSubFloor(value)) counts.applicationTextBelowFloor += 1;
      counts[countKey] += 1;
      findings.push({
        path: relPath,
        line: location.line,
        column: location.column,
        category,
        value: match[0],
        suggestedRole,
        classification: 'rejected',
        exceptionId: null,
      });
    };

    const isRoleVariable = (value) => String(value).includes('var(--text-role-');
    const isRoleLineHeightVariable = (value) =>
      /var\(--text-role-(?:large-title|title-2|title-3|headline|body|callout|subheadline)--line-height\)/.test(
        String(value),
      );

    if (isCssFile) {
      for (const regex of [rawCssFontRegex, rawCssLineHeightRegex]) {
        for (const match of content.matchAll(regex)) {
          const value = match.groups?.value?.trim() ?? '';
          const isLineHeight = regex === rawCssLineHeightRegex;
          recordAssignment({
            match,
            category: isLineHeight ? 'raw-css-line-height' : 'raw-css-font',
            value,
            countKey: isLineHeight ? 'unapprovedLineHeightOverrides' : 'unapprovedCssSizes',
            approved: isLineHeight ? isRoleLineHeightVariable(value) : isRoleVariable(value),
            countsFloor: !isLineHeight,
          });
        }
      }

      if (!isThemeFile) {
        for (const match of content.matchAll(
          /(?<property>--[A-Za-z0-9_-]*(?:font-size|line-height|font)[A-Za-z0-9_-]*)\s*:\s*(?<value>[^;}\n]+)/g,
        )) {
          const value = match.groups?.value?.trim() ?? '';
          recordAssignment({
            match,
            category: 'raw-css-custom-property',
            value,
            countKey: 'unapprovedCssSizes',
            approved: isRoleVariable(value) || isRoleLineHeightVariable(value),
          });
        }
      }
    } else {
      const svgTextRanges = [];
      for (const tag of content.matchAll(/<text\b[\s\S]*?>/gi)) {
        svgTextRanges.push({
          start: tag.index ?? 0,
          end: (tag.index ?? 0) + tag[0].length,
          multiline: tag[0].includes('\n'),
        });
      }
      const isInsideSvgText = (index) =>
        svgTextRanges.some((range) => index >= range.start && index < range.end);

      for (const match of content.matchAll(jsxFontSizeAttributeRegex)) {
        const index = match.index ?? 0;
        if (isInsideSvgText(index)) continue;
        const value = match.groups?.strVal ?? match.groups?.jsxVal ?? '';
        recordAssignment({
          match,
          category: 'inline-font-size',
          value,
          countKey: 'unapprovedInlineSizes',
          approved: isRoleVariable(value),
        });
      }

      for (const range of svgTextRanges.filter((candidate) => candidate.multiline)) {
        const tagContent = content.slice(range.start, range.end);
        for (const match of tagContent.matchAll(
          /\b(?:fontSize|font-size)\s*=\s*(?:\{(?<jsxVal>[^}]+)\}|(?<quote>['"])(?<strVal>[^'"]+)\k<quote>)/g,
        )) {
          const value = match.groups?.strVal ?? match.groups?.jsxVal ?? '';
          recordAssignment({
            match: { ...match, index: range.start + (match.index ?? 0) },
            category: 'svg-font-size',
            value,
            countKey: 'unapprovedSvgSizes',
            approved: isRoleVariable(value),
          });
        }
      }

      for (const match of content.matchAll(inlineLineHeightRegex)) {
        const value = match.groups?.strVal ?? match.groups?.jsxVal ?? match.groups?.numVal ?? '';
        recordAssignment({
          match,
          category: 'inline-line-height',
          value,
          countKey: 'unapprovedLineHeightOverrides',
          approved: isRoleLineHeightVariable(value),
          countsFloor: false,
        });
      }

      for (const match of content.matchAll(inlineStyleFontRegex)) {
        const value = match.groups?.strVal ?? match.groups?.jsxVal ?? '';
        recordAssignment({
          match,
          category: 'inline-font',
          value,
          countKey: 'unapprovedInlineSizes',
          approved: isRoleVariable(value),
        });
      }

      for (const match of content.matchAll(styleAssignmentRegex)) {
        const property = match.groups?.property ?? '';
        const value = match.groups?.value?.trim() ?? '';
        recordAssignment({
          match,
          category: `dom-${property}`,
          value,
          countKey:
            property === 'lineHeight' ? 'unapprovedLineHeightOverrides' : 'unapprovedInlineSizes',
          approved:
            property === 'lineHeight' ? isRoleLineHeightVariable(value) : isRoleVariable(value),
          countsFloor: property !== 'lineHeight',
        });
      }

      for (const match of content.matchAll(styleSetPropertyRegex)) {
        const property = match.groups?.property ?? '';
        const value = match.groups?.value?.trim() ?? '';
        recordAssignment({
          match,
          category: `set-property-${property}`,
          value,
          countKey:
            property === 'line-height' ? 'unapprovedLineHeightOverrides' : 'unapprovedInlineSizes',
          approved:
            property === 'line-height' ? isRoleLineHeightVariable(value) : isRoleVariable(value),
          countsFloor: property !== 'line-height',
        });
      }

      for (const match of content.matchAll(canvasTextCallRegex)) {
        if (
          !content.includes('resolveTypographyRoleFont(') &&
          !content.match(canvasFontLiteralRegex)
        ) {
          recordAssignment({
            match,
            category: 'canvas-text-without-role-resolver',
            value: '',
            countKey: 'unapprovedCanvasFonts',
            approved: false,
            countsFloor: false,
          });
        }
      }

      if (['.tsx', '.jsx', '.html', '.svg'].includes(path.extname(absPath))) {
        for (const match of content.matchAll(implicitSmallElementRegex)) {
          const tagStart = match.index ?? 0;
          const tagEnd = content.indexOf('>', tagStart) + 1;
          const tagContent = content.slice(tagStart, tagEnd);
          if (
            !/text-role-(?:large-title|title-2|title-3|headline|body|callout|subheadline)/.test(
              tagContent,
            )
          ) {
            recordAssignment({
              match,
              category: 'implicit-subfloor-element',
              value: '',
              countKey: 'unapprovedImplicitElements',
              approved: false,
              countsFloor: false,
            });
          }
        }
      }
    }
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

  const passed =
    counts.catalogErrors === 0 &&
    counts.staleExceptions === 0 &&
    counts.unapprovedLegacyRoles === 0 &&
    counts.unapprovedDefaultScaleUtilities === 0 &&
    counts.unapprovedArbitrarySizes === 0 &&
    counts.applicationTextBelowFloor === 0 &&
    counts.unapprovedCssSizes === 0 &&
    counts.unapprovedInlineSizes === 0 &&
    counts.unapprovedSvgSizes === 0 &&
    counts.unapprovedCanvasFonts === 0 &&
    counts.unapprovedLineHeightOverrides === 0 &&
    counts.unapprovedImplicitElements === 0 &&
    counts.unapprovedHeadlineWeights === 0;

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
