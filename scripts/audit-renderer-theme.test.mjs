import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseColor,
  compositeAlpha,
  contrastRatio,
  validateException,
  CONTRAST_FLOORS,
} from './renderer-accessibility-contract.mjs';
import { auditRendererTheme } from './audit-renderer-theme.mjs';

async function createFixtureWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'blue-theme-audit-test-'));
  const rendererDir = path.join(root, 'renderer');
  const stylesDir = path.join(rendererDir, 'styles');
  const specsDir = path.join(root, 'specs');
  await mkdir(stylesDir, { recursive: true });
  await mkdir(specsDir, { recursive: true });

  const themePath = path.join(stylesDir, 'index.css');
  const exceptionsPath = path.join(specsDir, 'theme-exceptions.md');

  const defaultThemeCss = `@theme static {
  --color-app-bg: #1a1a2e;
  --color-app-surface: #16213e;
  --color-app-text: #ffffff;
  --color-app-text-muted: #c8c8d8;
  --color-app-accent: #5a85c3;
  --color-app-accent-foreground: #ffffff;
  --color-app-focus: #4a9eff;
  --color-app-border: #0f3460;
}
`;
  await writeFile(themePath, defaultThemeCss, 'utf8');

  const defaultExceptionsMd = `# Theme Exceptions

<!-- audit-exceptions:start -->
\`\`\`json
[]
\`\`\`
<!-- audit-exceptions:end -->
`;
  await writeFile(exceptionsPath, defaultExceptionsMd, 'utf8');

  return {
    root,
    rendererDir,
    themePath,
    exceptionsPath,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('parseColor handles hex, rgb, rgba, and named colors', () => {
  assert.deepEqual(parseColor('#ffffff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#000'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('white'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('black'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.deepEqual(parseColor('rgba(255, 0, 0, 0.5)'), { r: 255, g: 0, b: 0, a: 0.5 });
});

test('compositeAlpha calculates alpha composited color correctly', () => {
  const fg = { r: 255, g: 255, b: 255, a: 0.5 };
  const bg = { r: 0, g: 0, b: 0, a: 1 };
  const composited = compositeAlpha(fg, bg);
  assert.equal(composited.r, 128);
  assert.equal(composited.g, 128);
  assert.equal(composited.b, 128);
  assert.equal(composited.a, 1);
});

test('contrastRatio calculates WCAG ratio without rounding failures upward', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  assert.equal(contrastRatio(white, black), 21);

  // Colors that yield 4.48:1 must NOT round up to 4.5:1
  const c1 = { r: 136, g: 136, b: 136 }; // #888888
  const c2 = { r: 22, g: 33, b: 62 }; // #16213e
  const ratio = contrastRatio(c1, c2);
  assert.ok(ratio < 4.5, `Expected ratio < 4.5 but got ${ratio}`);
  assert.equal(Math.floor(ratio * 100) / 100 < 4.5, true);
});

test('governed contrast pairs detect passing and failing contrast', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const passingPair = {
      id: 'passing-test-pair',
      foregroundToken: 'app-text', // #ffffff
      backgroundToken: 'app-bg', // #1a1a2e
      usage: 'normal-text',
      minRatio: CONTRAST_FLOORS.normalText,
      targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
      representativeSurfaces: ['Test Surface'],
    };

    const failingPair = {
      id: 'failing-test-pair',
      foregroundToken: 'app-surface', // #16213e
      backgroundToken: 'app-bg', // #1a1a2e (very low contrast)
      usage: 'normal-text',
      minRatio: CONTRAST_FLOORS.normalText,
      targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
      representativeSurfaces: ['Test Surface'],
    };

    const passingResult = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [passingPair],
    });
    assert.equal(passingResult.report.summary.contrastFailures, 0);

    const failingResult = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [failingPair],
    });
    assert.equal(failingResult.report.summary.contrastFailures, 1);
    const finding = failingResult.report.findings.find(
      (f) => f.category === 'contrast-ratio-failure',
    );
    assert.ok(finding);
    assert.ok(finding.reason.includes('failing-test-pair'));
  } finally {
    await ws.cleanup();
  }
});

test('fill and on-fill directionality requires dedicated on-fill token', async () => {
  const ws = await createFixtureWorkspace();
  try {
    // app-accent (#5a85c3) with app-bg (#1a1a2e)
    // Dark background on dark accent fails, but white on accent passes
    const onFillPair = {
      id: 'accent-on-fill',
      foregroundToken: 'app-accent-foreground', // #ffffff
      backgroundToken: 'app-accent', // #5a85c3
      usage: 'normal-text',
      minRatio: CONTRAST_FLOORS.normalText,
      targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
      representativeSurfaces: ['Primary Button'],
    };

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [onFillPair],
    });
    // #ffffff on #5a85c3 is 3.76:1, so the exact foreground-on-fill direction fails.
    assert.equal(result.report.summary.contrastFailures, 1);
    assert.equal(result.report.findings[0]?.value.startsWith('accent-on-fill:'), true);
  } finally {
    await ws.cleanup();
  }
});

test('reports undefined theme aliases with file path and line number', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const componentPath = path.join(ws.rendererDir, 'TestComponent.tsx');
    await writeFile(
      componentPath,
      `export function Test() {
  return <div className="bg-app-undefined-color text-app-text">Hello</div>;
}
`,
      'utf8',
    );

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [],
    });

    assert.equal(result.report.summary.undefinedThemeAliases, 1);
    const finding = result.report.findings.find((f) => f.category === 'undefined-theme-alias');
    assert.ok(finding);
    assert.equal(finding.value, 'app-undefined-color');
    assert.equal(finding.line, 2);
  } finally {
    await ws.cleanup();
  }
});

test('reports prohibited global focus suppression in CSS', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const cssPath = path.join(ws.rendererDir, 'styles', 'suppression.css');
    await writeFile(
      cssPath,
      `/* Bad global reset */
[tabindex]:focus,
[tabindex]:focus-visible {
  outline: none;
}
`,
      'utf8',
    );

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [],
    });

    assert.equal(result.report.summary.prohibitedFocusSuppression, 1);
    const finding = result.report.findings.find(
      (f) => f.category === 'prohibited-focus-suppression',
    );
    assert.ok(finding);
    assert.equal(finding.line, 2);
  } finally {
    await ws.cleanup();
  }
});

test('exact approved exceptions suppress findings', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const componentPath = path.join(ws.rendererDir, 'SyntaxView.tsx');
    await writeFile(componentPath, `export const style = { color: '#89ddff' };\n`, 'utf8');

    const exceptionsMd = `# Theme Exceptions

<!-- audit-exceptions:start -->
\`\`\`json
[
  {
    "path": "renderer/SyntaxView.tsx",
    "value": "#89ddff",
    "kind": "syntax-palette",
    "reason": "CodeMirror syntax token color.",
    "ownerSurface": "Syntax highlighter",
    "reviewBy": "permanent"
  }
]
\`\`\`
<!-- audit-exceptions:end -->
`;
    await writeFile(ws.exceptionsPath, exceptionsMd, 'utf8');

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [],
    });

    assert.equal(result.report.summary.unapprovedStaticInlineColors, 0);
    assert.equal(result.report.summary.approvedExceptions, 1);
    assert.equal(result.report.summary.staleExceptions, 0);
    assert.equal(result.report.summary.malformedExceptions, 0);
  } finally {
    await ws.cleanup();
  }
});

test('reports stale exceptions when value is missing from target file', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const componentPath = path.join(ws.rendererDir, 'SyntaxView.tsx');
    await writeFile(componentPath, `export const OTHER_CODE = "clear";\n`, 'utf8');

    const exceptionsMd = `# Theme Exceptions

<!-- audit-exceptions:start -->
\`\`\`json
[
  {
    "path": "renderer/SyntaxView.tsx",
    "value": "#nonexistent_color",
    "kind": "syntax-palette",
    "reason": "Stale token.",
    "ownerSurface": "Syntax highlighter",
    "reviewBy": "permanent"
  }
]
\`\`\`
<!-- audit-exceptions:end -->
`;
    await writeFile(ws.exceptionsPath, exceptionsMd, 'utf8');

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [],
    });

    assert.equal(result.report.summary.staleExceptions, 1);
    const finding = result.report.findings.find((f) => f.category === 'stale-exception');
    assert.ok(finding);
    assert.equal(finding.value, '#nonexistent_color');
  } finally {
    await ws.cleanup();
  }
});

test('reports malformed exceptions with missing required fields or invalid kind', async () => {
  const ws = await createFixtureWorkspace();
  try {
    const exceptionsMd = `# Theme Exceptions

<!-- audit-exceptions:start -->
\`\`\`json
[
  {
    "path": "renderer/SyntaxView.tsx",
    "value": "#123456",
    "kind": "invalid-kind-name"
  }
]
\`\`\`
<!-- audit-exceptions:end -->
`;
    await writeFile(ws.exceptionsPath, exceptionsMd, 'utf8');

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
      governedPairs: [],
    });

    assert.equal(result.report.summary.malformedExceptions, 1);
    const finding = result.report.findings.find((f) => f.category === 'malformed-exception');
    assert.ok(finding);
  } finally {
    await ws.cleanup();
  }
});

test('failure-first detection for muted, subtle, accent, status fills, CodeMirror comments, borders, focus, and error states', async () => {
  const ws = await createFixtureWorkspace();
  try {
    // Deliberately set all tokens to low-contrast values to trigger failure-first detection
    const lowContrastThemeCss = `@theme static {
  --color-app-bg: #202020;
  --color-app-surface: #252525;
  --color-app-surface-raised: #282828;
  --color-app-canvas: #1f1f1f;
  --color-app-input: #222222;
  --color-app-text: #555555;
  --color-app-text-strong: #666666;
  --color-app-text-muted: #3a3a3a;
  --color-app-text-subtle: #2f2f2f;
  --color-app-accent: #334455;
  --color-app-accent-hover: #3a4b5c;
  --color-app-accent-foreground: #405060;
  --color-app-warning: #443300;
  --color-app-warning-foreground: #554400;
  --color-app-success: #003300;
  --color-app-success-foreground: #004400;
  --color-app-danger: #440000;
  --color-app-danger-foreground: #550000;
  --color-app-error: #441111;
  --color-app-focus: #282828;
  --color-app-border: #242424;
  --color-codemirror-comment: #303030;
}
`;
    await writeFile(ws.themePath, lowContrastThemeCss, 'utf8');

    const result = auditRendererTheme({
      repoRoot: ws.root,
      rendererRoot: ws.rendererDir,
      themePath: ws.themePath,
      exceptionsPath: ws.exceptionsPath,
    });

    const findings = result.report.findings.filter((f) => f.category === 'contrast-ratio-failure');
    assert.ok(
      findings.length >= 10,
      `Expected at least 10 contrast failures, got ${findings.length}`,
    );

    // Verify key families are captured in failures
    const failedPairIds = findings.map((f) => f.value.split(':')[0]);
    assert.ok(failedPairIds.includes('text-on-bg'), 'text-on-bg must fail');
    assert.ok(failedPairIds.includes('text-muted-on-bg'), 'text-muted-on-bg must fail');
    assert.ok(failedPairIds.includes('text-subtle-on-bg'), 'text-subtle-on-bg must fail');
    assert.ok(failedPairIds.includes('accent-on-bg'), 'accent-on-bg must fail');
    assert.ok(
      failedPairIds.includes('accent-foreground-on-accent'),
      'accent-foreground-on-accent must fail',
    );
    assert.ok(
      failedPairIds.includes('warning-foreground-on-warning'),
      'warning-foreground-on-warning must fail',
    );
    assert.ok(
      failedPairIds.includes('success-foreground-on-success'),
      'success-foreground-on-success must fail',
    );
    assert.ok(failedPairIds.includes('border-against-bg'), 'border-against-bg must fail');
    assert.ok(failedPairIds.includes('focus-on-bg'), 'focus-on-bg must fail');
  } finally {
    await ws.cleanup();
  }
});
