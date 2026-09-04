import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const rendererScope = 'packages/blue-app/src/renderer';
const rendererRoot = path.join(repoRoot, rendererScope);
const themePath = path.join(rendererRoot, 'styles/index.css');
const exceptionsPath = path.join(repoRoot, 'specs/051-theme-token-cleanup/theme-exceptions.md');

const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set(['__mocks__', 'browser', 'tests']);
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

const themeVariableRegex = /--color-([a-z0-9-]+)\s*:/g;

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

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function listFiles(directory) {
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

function extractBlock(content, blockName) {
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

function indexToLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function findSuggestedRole(value) {
  const normalizedValue = value.toLowerCase();

  for (const [pattern, role] of suggestedRoles) {
    if (normalizedValue.includes(pattern)) {
      return role;
    }
  }

  return '';
}

function parseExceptions(markdown) {
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

function matchException(exceptions, relativePath, value, category) {
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

function pushFinding(findings, exceptions, relativePath, line, value, category) {
  const exception = matchException(exceptions, relativePath, value, category);
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

const themeCss = readFileSync(themePath, 'utf8');
const themeBlock = extractBlock(themeCss, '@theme');
const definedThemeAliases = new Set();

if (themeBlock) {
  for (const match of themeBlock.content.matchAll(themeVariableRegex)) {
    definedThemeAliases.add(match[1]);
  }
}

const themeBlockStartLine = themeBlock ? indexToLineNumber(themeCss, themeBlock.startIndex) : -1;
const themeBlockEndLine = themeBlock ? indexToLineNumber(themeCss, themeBlock.endIndex) : -1;
const exceptionRecords = parseExceptions(readFileSync(exceptionsPath, 'utf8'));
const findings = [];

for (const absolutePath of listFiles(rendererRoot)) {
  const relativePath = toPosix(path.relative(repoRoot, absolutePath));
  const content = readFileSync(absolutePath, 'utf8');
  const lines = content.split('\n');
  const isCssFile = path.extname(absolutePath) === '.css';

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    for (const match of line.matchAll(arbitraryUtilityRegex)) {
      pushFinding(
        findings,
        exceptionRecords,
        relativePath,
        lineNumber,
        match.groups.value,
        'arbitrary-utility',
      );
    }

    for (const match of line.matchAll(arbitraryFontSizeUtilityRegex)) {
      pushFinding(
        findings,
        exceptionRecords,
        relativePath,
        lineNumber,
        match.groups.value,
        'arbitrary-utility',
      );
    }

    for (const match of line.matchAll(inlineColorRegex)) {
      pushFinding(
        findings,
        exceptionRecords,
        relativePath,
        lineNumber,
        match.groups.value,
        'static-inline-color',
      );
    }

    for (const match of line.matchAll(themeAliasRegex)) {
      const alias = match.groups.value;
      if (/^blue-\d{2,3}$/u.test(alias)) {
        continue;
      }
      if (definedThemeAliases.has(alias)) {
        continue;
      }
      pushFinding(
        findings,
        exceptionRecords,
        relativePath,
        lineNumber,
        alias,
        'undefined-theme-alias',
      );
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
      pushFinding(findings, exceptionRecords, relativePath, lineNumber, match[0], 'raw-css-color');
    }
  });
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
  approvedExceptions: findings.filter((finding) => finding.approvedException).length,
};

const report = {
  generatedAt: new Date().toISOString(),
  scope: rendererScope,
  summary,
  findings,
  exceptions: exceptionRecords,
};

console.log(JSON.stringify(report, null, 2));

const hasFailures = Object.entries(summary).some(
  ([key, value]) => key !== 'approvedExceptions' && value > 0,
);
process.exit(hasFailures ? 1 : 0);
