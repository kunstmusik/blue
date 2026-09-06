import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRAST_FLOORS,
  SEMANTIC_COLOR_ROLES,
  GOVERNED_CONTRAST_PAIRS,
  parseColor,
  compositeAlpha,
  contrastRatio,
  validateException,
} from './renderer-accessibility-contract.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');
const defaultRendererScope = 'packages/blue-app/src/renderer';

const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set([
  '__mocks__',
  'browser',
  'tests',
  'node_modules',
  'dist',
  'build',
]);
const colorNamedLiteralPattern = String.raw`(?<![A-Za-z-])(?:white|black|transparent)(?![A-Za-z-])`;
const colorLiteralPattern = String.raw`(?:#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^\n)]*\)|hsla?\([^\n)]*\)|\b${colorNamedLiteralPattern}\b)`;

const arbitraryUtilityRegex = new RegExp(
  String.raw`\b(?:[A-Za-z0-9_-]+:)*(?:bg|text|border(?:-[trblxy])?|from|to|via|ring|stroke|fill|decoration|outline|shadow)-\[(?<value>[^\]]*${colorLiteralPattern}[^\]]*)\]`,
  'g',
);

const arbitraryFontSizeUtilityRegex =
  /\b(?:[A-Za-z0-9_-]+:)*text-\[(?<value>\d+(?:\.\d+)?(?:px|rem|em|pt))\](?:\/\[[^\]]+\])?/g;

const inlineColorRegex = new RegExp(
  String.raw`\b(?:background(?:Color)?|color|border(?:Color)?|outlineColor|fill|stroke|boxShadow)\s*:\s*(?<quote>['"])(?<value>[^'"]*${colorLiteralPattern}[^'"]*)\k<quote>`,
  'g',
);

const rawCssColorRegex = new RegExp(colorLiteralPattern, 'g');

const themeAliasRegex = new RegExp(
  String.raw`\b(?:[A-Za-z0-9_-]+:)*(?:bg|text|border(?:-[trblxy])?|from|to|via|ring|stroke|fill|decoration|outline)-(?<value>(?:app|blue)-[a-z0-9-]+)(?:\/(?:\[[^\]]+\]|[0-9]{1,3}))?\b`,
  'g',
);

const themeVariableRegex = /--color-([a-z0-9-]+)\s*:\s*([^;]+);/g;

const suggestedRoles = [
  ['#1a1a2e', 'app-bg'],
  ['#16213e', 'app-surface'],
  ['#10192a', 'app-surface-strong'],
  ['#0d0d1a', 'app-canvas'],
  ['#0f3460', 'app-border'],
  ['#e94560', 'app-accent'],
  ['#c73650', 'app-accent-hover'],
  ['#c8c8d8', 'app-text'],
  ['#ffffff', 'app-text-strong'],
  ['#fff', 'app-text-strong'],
  ['#888888', 'app-text-muted'],
  ['#888', 'app-text-muted'],
  ['#666666', 'app-text-subtle'],
  ['#666', 'app-text-subtle'],
  ['#cc8800', 'app-warning'],
  ['#ff6666', 'app-danger'],
  ['white', 'app-text-strong'],
  ['black', 'app-canvas'],
];

export function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

export function listFiles(directory) {
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
      !/\.(?:test|spec)\.[^.]+$/u.test(entry.name)
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

export function extractBlock(content, blockName) {
  const blockStart = content.indexOf(blockName);
  if (blockStart === -1) {
    return null;
  }

  const openBraceIndex = content.indexOf('{', blockStart);
  if (openBraceIndex === -1) {
    return null;
  }

  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const character = content[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          startIndex: blockStart,
          endIndex: index,
          content: content.slice(openBraceIndex + 1, index),
        };
      }
    }
  }

  return null;
}

export function indexToLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function findSuggestedRole(value) {
  const normalizedValue = value.toLowerCase();

  for (const [pattern, role] of suggestedRoles) {
    if (normalizedValue.includes(pattern)) {
      return role;
    }
  }

  return '';
}

export function parseExceptions(markdown) {
  if (!markdown) return [];
  const markerMatch = markdown.match(
    /<!-- audit-exceptions:start -->([\s\S]*?)<!-- audit-exceptions:end -->/,
  );
  if (!markerMatch) {
    return [];
  }

  const jsonMatch = markerMatch[1].match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function matchException(exceptions, relativePath, value, category) {
  return exceptions.find((exception) => {
    if (exception.path !== relativePath) {
      return false;
    }
    if (exception.value !== value) {
      return false;
    }
    if (typeof exception.category === 'string' && exception.category !== category) {
      return false;
    }
    return true;
  });
}

export function resolveTokenMap(themeCss) {
  const tokenMap = new Map();
  const themeBlock = extractBlock(themeCss, '@theme');
  if (!themeBlock) return tokenMap;

  for (const match of themeBlock.content.matchAll(themeVariableRegex)) {
    const name = match[1];
    const rawVal = match[2].trim();
    tokenMap.set(name, rawVal);
  }

  // Handle var(--color-xxx) indirection
  for (let i = 0; i < 3; i++) {
    for (const [name, val] of tokenMap.entries()) {
      const varMatch = val.match(/^var\(--color-([a-z0-9-]+)\)$/);
      if (varMatch && tokenMap.has(varMatch[1])) {
        tokenMap.set(name, tokenMap.get(varMatch[1]));
      }
    }
  }

  return tokenMap;
}

export function auditRendererTheme(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const rendererScope = options.rendererScope ?? defaultRendererScope;
  const rendererRoot = options.rendererRoot ?? path.join(repoRoot, rendererScope);
  const themePath = options.themePath ?? path.join(rendererRoot, 'styles/index.css');
  const exceptionsPath =
    options.exceptionsPath ??
    path.join(repoRoot, 'specs/051-theme-token-cleanup/theme-exceptions.md');
  const governedPairs = options.governedPairs ?? GOVERNED_CONTRAST_PAIRS;

  const findings = [];
  const matchedExceptions = new Set();

  let exceptionRecords = [];
  if (existsSync(exceptionsPath)) {
    exceptionRecords = parseExceptions(readFileSync(exceptionsPath, 'utf8'));
  }

  // Validate exceptions schema for malformed records
  for (let idx = 0; idx < exceptionRecords.length; idx++) {
    const exc = exceptionRecords[idx];
    const errors = validateException(exc);
    if (errors.length > 0) {
      findings.push({
        path: toPosix(path.relative(repoRoot, exceptionsPath)),
        line: idx + 1,
        value: JSON.stringify(exc),
        category: 'malformed-exception',
        suggestedRole: '',
        approvedException: false,
        reason: errors.join('; '),
      });
    }
  }

  let themeCss = '';
  let themeBlock = null;
  let themeBlockStartLine = -1;
  let themeBlockEndLine = -1;
  const tokenMap = new Map();

  if (existsSync(themePath)) {
    themeCss = readFileSync(themePath, 'utf8');
    themeBlock = extractBlock(themeCss, '@theme');
    if (themeBlock) {
      themeBlockStartLine = indexToLineNumber(themeCss, themeBlock.startIndex);
      themeBlockEndLine = indexToLineNumber(themeCss, themeBlock.endIndex);
    }
    const resolved = resolveTokenMap(themeCss);
    for (const [k, v] of resolved.entries()) {
      tokenMap.set(k, v);
    }
  }

  function pushFinding(relativePath, line, value, category) {
    const exception = matchException(exceptionRecords, relativePath, value, category);
    if (exception) {
      matchedExceptions.add(exception);
    }
    findings.push({
      path: relativePath,
      line,
      value,
      category,
      suggestedRole: findSuggestedRole(value),
      approvedException: Boolean(exception),
      reason: exception?.reason ?? '',
    });
  }

  const allFiles = listFiles(rendererRoot);

  for (const absolutePath of allFiles) {
    const relativePath = toPosix(path.relative(repoRoot, absolutePath));
    const content = readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    const isCssFile = path.extname(absolutePath) === '.css';

    // Check for prohibited global focus suppression in CSS
    if (isCssFile) {
      const globalSuppressionRegex = /(\[tabindex\][^{]*\{[^}]*outline\s*:\s*(?:none|0)[^}]*\})/gi;
      let match;
      while ((match = globalSuppressionRegex.exec(content)) !== null) {
        const line = indexToLineNumber(content, match.index);
        pushFinding(
          relativePath,
          line,
          match[1].replace(/\s+/g, ' ').trim(),
          'prohibited-focus-suppression',
        );
      }
    }

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      for (const match of line.matchAll(arbitraryUtilityRegex)) {
        pushFinding(relativePath, lineNumber, match.groups.value, 'arbitrary-utility');
      }

      for (const match of line.matchAll(arbitraryFontSizeUtilityRegex)) {
        pushFinding(relativePath, lineNumber, match.groups.value, 'arbitrary-utility');
      }

      for (const match of line.matchAll(inlineColorRegex)) {
        pushFinding(relativePath, lineNumber, match.groups.value, 'static-inline-color');
      }

      for (const match of line.matchAll(themeAliasRegex)) {
        const alias = match.groups.value;
        if (/^blue-\d{2,3}$/u.test(alias)) {
          continue;
        }
        if (tokenMap.has(alias)) {
          continue;
        }
        pushFinding(relativePath, lineNumber, alias, 'undefined-theme-alias');
      }

      if (!isCssFile) {
        return;
      }

      if (
        absolutePath === themePath &&
        lineNumber >= themeBlockStartLine &&
        lineNumber <= themeBlockEndLine
      ) {
        return;
      }

      for (const match of line.matchAll(rawCssColorRegex)) {
        pushFinding(relativePath, lineNumber, match[0], 'raw-css-color');
      }
    });
  }

  // Check for stale exceptions
  for (const exc of exceptionRecords) {
    if (!matchedExceptions.has(exc)) {
      const targetAbs = path.join(repoRoot, exc.path);
      if (!existsSync(targetAbs)) {
        findings.push({
          path: exc.path,
          line: 1,
          value: exc.value,
          category: 'stale-exception',
          suggestedRole: '',
          approvedException: false,
          reason: `Target file not found: ${exc.path}`,
        });
      } else {
        const fileText = readFileSync(targetAbs, 'utf8');
        if (!fileText.includes(exc.value)) {
          findings.push({
            path: exc.path,
            line: 1,
            value: exc.value,
            category: 'stale-exception',
            suggestedRole: '',
            approvedException: false,
            reason: `Exception value '${exc.value}' does not exist in target file`,
          });
        }
      }
    }
  }

  // Audit governed contrast pairs
  for (const pair of governedPairs) {
    const fgVal = tokenMap.get(pair.foregroundToken);
    const bgVal = tokenMap.get(pair.backgroundToken);

    if (!fgVal || !bgVal) {
      findings.push({
        path: toPosix(path.relative(repoRoot, themePath)),
        line: 1,
        value: `${pair.id}: fg=${pair.foregroundToken} (${fgVal ?? 'missing'}), bg=${pair.backgroundToken} (${bgVal ?? 'missing'})`,
        category: 'contrast-ratio-failure',
        suggestedRole: '',
        approvedException: false,
        reason: `Governed pair '${pair.id}' has undefined token: fg=${fgVal}, bg=${bgVal}`,
      });
      continue;
    }

    const parsedFg = parseColor(fgVal);
    const parsedBg = parseColor(bgVal);

    if (!parsedFg || !parsedBg) {
      findings.push({
        path: toPosix(path.relative(repoRoot, themePath)),
        line: 1,
        value: `${pair.id}: ${fgVal} on ${bgVal}`,
        category: 'contrast-ratio-failure',
        suggestedRole: '',
        approvedException: false,
        reason: `Failed to parse colors for pair '${pair.id}': fg=${fgVal}, bg=${bgVal}`,
      });
      continue;
    }

    const compositedFg = compositeAlpha(parsedFg, parsedBg);
    const ratio = contrastRatio(compositedFg, parsedBg);

    if (ratio < pair.minRatio) {
      const formattedRatio = (Math.floor(ratio * 100) / 100).toFixed(2);
      findings.push({
        path: toPosix(path.relative(repoRoot, themePath)),
        line: 1,
        value: `${pair.id}: ${formattedRatio}:1 (required >= ${pair.minRatio}:1)`,
        category: 'contrast-ratio-failure',
        suggestedRole: '',
        approvedException: false,
        reason: `Governed pair '${pair.id}' (${pair.foregroundToken} on ${pair.backgroundToken}) measured ${formattedRatio}:1, below floor of ${pair.minRatio}:1. Surfaces: ${pair.representativeSurfaces.join(', ')}`,
      });
    }
  }

  const summary = {
    unapprovedArbitraryUtilities: findings.filter(
      (finding) => finding.category === 'arbitrary-utility' && !finding.approvedException,
    ).length,
    unapprovedRawCssColors: findings.filter(
      (finding) => finding.category === 'raw-css-color' && !finding.approvedException,
    ).length,
    unapprovedStaticInlineColors: findings.filter(
      (finding) => finding.category === 'static-inline-color' && !finding.approvedException,
    ).length,
    undefinedThemeAliases: findings.filter(
      (finding) => finding.category === 'undefined-theme-alias' && !finding.approvedException,
    ).length,
    prohibitedFocusSuppression: findings.filter(
      (finding) =>
        finding.category === 'prohibited-focus-suppression' && !finding.approvedException,
    ).length,
    staleExceptions: findings.filter(
      (finding) => finding.category === 'stale-exception' && !finding.approvedException,
    ).length,
    malformedExceptions: findings.filter(
      (finding) => finding.category === 'malformed-exception' && !finding.approvedException,
    ).length,
    contrastFailures: findings.filter(
      (finding) => finding.category === 'contrast-ratio-failure' && !finding.approvedException,
    ).length,
    approvedExceptions: findings.filter((finding) => finding.approvedException).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    scope: rendererScope,
    summary,
    findings,
    exceptions: exceptionRecords,
  };

  const hasFailures = Object.entries(summary).some(
    ([key, value]) => key !== 'approvedExceptions' && value > 0,
  );

  return {
    report,
    hasFailures,
  };
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { report, hasFailures } = auditRendererTheme();
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasFailures ? 1 : 0);
}
