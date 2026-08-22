import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '..');
const scriptPath = join(repoRoot, 'scripts', 'audit-renderer-typography.mjs');

const VALID_INDEX_CSS = `@import "tailwindcss";

@theme static {
  --text-*: initial;

  --text-role-large-title: 26px;
  --text-role-large-title--line-height: 32px;
  --text-role-title-2: 17px;
  --text-role-title-2--line-height: 22px;
  --text-role-title-3: 15px;
  --text-role-title-3--line-height: 20px;
  --text-role-headline: 13px;
  --text-role-headline--line-height: 16px;
  --text-role-body: 13px;
  --text-role-body--line-height: 16px;
  --text-role-callout: 12px;
  --text-role-callout--line-height: 15px;
  --text-role-subheadline: 11px;
  --text-role-subheadline--line-height: 14px;
}

@layer base {
  body {
    font-size: var(--text-role-body);
    line-height: var(--text-role-body--line-height);
  }
}
`;

const VALID_TYPOGRAPHY_GUIDE = `# Typography Guide

<!-- renderer-typography-exceptions:start -->
\`\`\`json
{
  "schemaVersion": 1,
  "exceptions": []
}
\`\`\`
<!-- renderer-typography-exceptions:end -->
`;

async function createFixtureWorkspace(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'blue-typography-audit-test-'));
  const rendererDir = join(dir, 'packages', 'blue-app', 'src', 'renderer');
  const sharedDir = join(dir, 'packages', 'blue-app', 'src', 'shared');
  const docsDir = join(dir, 'docs');

  await mkdir(join(rendererDir, 'styles'), { recursive: true });
  await mkdir(sharedDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  // Standard entry points
  await writeFile(join(rendererDir, 'styles', 'index.css'), options.indexCss ?? VALID_INDEX_CSS, 'utf8');
  await writeFile(join(docsDir, 'typography.md'), options.guide ?? VALID_TYPOGRAPHY_GUIDE, 'utf8');

  // Create standard entrypoint files
  for (const entry of ['main.tsx', 'settings-main.tsx', 'about-main.tsx', 'effect-editor.tsx', 'track-instrument-editor.tsx']) {
    await writeFile(join(rendererDir, entry), `import './styles/index.css';\nexport function App() { return <div className="text-role-body">OK</div>; }`, 'utf8');
  }

  // Create custom files if provided
  if (options.files) {
    for (const [relPath, content] of Object.entries(options.files)) {
      const fullPath = join(dir, relPath);
      await mkdir(join(fullPath, '..'), { recursive: true });
      await writeFile(fullPath, content, 'utf8');
    }
  }

  return dir;
}

async function runAudit(workspaceDir, extraArgs = []) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      scriptPath,
      '--root',
      workspaceDir,
      ...extraArgs,
    ], {
      cwd: repoRoot,
    });
    return { exitCode: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const stdout = error.stdout ? JSON.parse(error.stdout) : null;
    return { exitCode: error.code ?? 1, result: stdout, stderr: error.stderr };
  }
}

test('passes when all files use valid typography catalog and body baseline', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/Panel.tsx': `
        export function Panel() {
          return (
            <div>
              <h1 className="text-role-large-title font-bold">App Title</h1>
              <h2 className="text-role-title-2">Window Title</h2>
              <h3 className="text-role-title-3">Section Title</h3>
              <h4 className="text-role-headline font-bold">Group Heading</h4>
              <p className="text-role-body">Body content text</p>
              <span className="text-role-callout">Secondary label</span>
              <span className="text-role-subheadline">Dense annotation</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 0);
    assert.equal(result.passed, true);
    assert.equal(result.catalog.length, 7);
    assert.equal(result.counts.catalogErrors, 0);
    assert.equal(result.counts.unapprovedLegacyRoles, 0);
    assert.equal(result.counts.unapprovedDefaultScaleUtilities, 0);
    assert.equal(result.counts.unapprovedArbitrarySizes, 0);
    assert.equal(result.counts.unapprovedCssSizes, 0);
    assert.equal(result.counts.unapprovedInlineSizes, 0);
    assert.equal(result.counts.unapprovedSvgSizes, 0);
    assert.equal(result.counts.unapprovedCanvasFonts, 0);
    assert.equal(result.counts.unapprovedLineHeightOverrides, 0);
    assert.equal(result.counts.applicationTextBelowFloor, 0);
    assert.equal(result.counts.staleExceptions, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('requires Headline role assignments to opt into bold weight', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/UnweightedHeadline.tsx': `
        export function UnweightedHeadline() {
          return <div className="text-role-headline">Group Heading</div>;
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedHeadlineWeights, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects retired legacy custom vocabulary (text-nano, text-micro, text-tiny, text-ui, text-body, text-content)', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/Legacy.tsx': `
        export function Legacy() {
          return (
            <div>
              <span className="text-nano">Nano</span>
              <span className="text-micro">Micro</span>
              <span className="text-tiny">Tiny</span>
              <span className="text-ui">UI</span>
              <span className="text-body">Old Body</span>
              <span className="text-content">Content</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedLegacyRoles, 6);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects Tailwind default numeric text scale (text-xs, text-sm, text-base, text-lg, etc.) and variants', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/DefaultScale.tsx': `
        export function DefaultScale() {
          return (
            <div>
              <span className="text-xs">Extra Small</span>
              <span className="hover:text-sm">Small on hover</span>
              <span className="text-base">Base</span>
              <span className="md:text-lg">Large</span>
              <span className="text-xl/6">Extra Large with leading</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedDefaultScaleUtilities, 5);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('does not misclassify Tailwind text color or alignment utilities as font sizes', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/ColorAndAlign.tsx': `
        export function ColorAndAlign() {
          return (
            <div className="text-center text-app-text text-app-text-strong text-app-text-muted text-white text-primary dark:text-foreground text-ellipsis text-nowrap">
              <span className="text-role-body text-red-500">Color text</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 0);
    assert.equal(result.passed, true);
    assert.equal(result.counts.unapprovedDefaultScaleUtilities, 0);
    assert.equal(result.counts.unapprovedArbitrarySizes, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects Tailwind arbitrary font size utilities', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/Arbitrary.tsx': `
        export function Arbitrary() {
          return (
            <div>
              <span className="text-[10px]">10px</span>
              <span className="text-[13px]">13px arbitrary</span>
              <span className="text-[0.8rem]">rem arbitrary</span>
              <span className="[font-size:12px]">bracket font size</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedArbitrarySizes, 4);
    assert.ok(result.counts.applicationTextBelowFloor >= 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects raw CSS font-size declarations not using role variables', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/styles/custom.css': `
        .custom-label {
          font-size: 10px;
          line-height: 12px;
        }
        .valid-label {
          font-size: var(--text-role-subheadline);
          line-height: var(--text-role-subheadline--line-height);
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedCssSizes, 1);
    assert.equal(result.counts.applicationTextBelowFloor, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects raw inline/React fontSize styles not using role variables', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/InlineStyles.tsx': `
        export function InlineStyles() {
          return (
            <div>
              <span style={{ fontSize: 10 }}>Raw number</span>
              <span style={{ fontSize: '12px' }}>Raw string px</span>
              <span style={{ fontSize: 'var(--text-role-body)' }}>Valid CSS var</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedInlineSizes, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects raw SVG fontSize attributes not using role variables', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/SvgText.tsx': `
        export function SvgText() {
          return (
            <svg>
              <text fontSize={9}>Small SVG</text>
              <text fontSize="12">String SVG</text>
              <text style={{ fontSize: 'var(--text-role-subheadline)' }}>Valid SVG</text>
            </svg>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedSvgSizes, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects raw Canvas context font assignments not using resolver', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/CanvasDraw.tsx': `
        export function draw(ctx: CanvasRenderingContext2D, el: HTMLElement) {
          ctx.font = '10px monospace';
          ctx.fillText('hello', 0, 0);
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedCanvasFonts, 1);
    assert.equal(result.counts.applicationTextBelowFloor, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('accepts Canvas drawing using resolveTypographyRoleFont helper', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/CanvasDraw.tsx': `
        import { resolveTypographyRoleFont } from '../lib/typography';
        export function draw(ctx: CanvasRenderingContext2D, el: HTMLElement) {
          ctx.font = resolveTypographyRoleFont(el, 'subheadline', { family: 'monospace' });
          ctx.fillText('hello', 0, 0);
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 0);
    assert.equal(result.passed, true);
    assert.equal(result.counts.unapprovedCanvasFonts, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects unapproved leading/line-height overrides', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/LeadingOverride.tsx': `
        export function LeadingOverride() {
          return (
            <div>
              <span className="text-role-body leading-none">Clipped line height</span>
              <span className="text-role-callout leading-[10px]">Tight leading</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.equal(result.counts.unapprovedLineHeightOverrides, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('handles exact exceptions from docs/typography.md and detects stale exceptions', async () => {
  const guideWithExceptions = `# Typography Guide

<!-- renderer-typography-exceptions:start -->
\`\`\`json
{
  "schemaVersion": 1,
  "exceptions": [
    {
      "id": "bsb-authored-label-font",
      "path": "packages/blue-app/src/shared/bsb-widget-layout.ts",
      "category": "project-authored-font",
      "expression": "const labelFontSize =",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB authored label",
      "reason": "Value is read from canonical project font.size",
      "verification": "packages/blue-app/src/renderer/tests/bsb-property-validation.test.ts",
      "reviewPolicy": "Remove if this data path is replaced"
    },
    {
      "id": "stale-exception-example",
      "path": "packages/blue-app/src/renderer/components/NonExistent.tsx",
      "category": "project-authored-font",
      "expression": "nonExistentExpr",
      "expectedOccurrences": 1,
      "ownerSurface": "Test",
      "reason": "Test",
      "verification": "Test",
      "reviewPolicy": "Test"
    }
  ]
}
\`\`\`
<!-- renderer-typography-exceptions:end -->
`;

  const workspace = await createFixtureWorkspace({
    guide: guideWithExceptions,
    files: {
      'packages/blue-app/src/shared/bsb-widget-layout.ts': `
        export function getLabelSize(node: any) {
          const labelFontSize = typeof node.properties['font.size'] === 'number' ? node.properties['font.size'] : 12;
          return labelFontSize;
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.counts.approvedProjectAuthoredExceptions, 1);
    assert.equal(result.counts.staleExceptions, 1);
    assert.equal(result.staleExceptions[0].id, 'stale-exception-example');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('handles non-text glyph and single-line line-height exceptions and overmatching counts', async () => {
  const guide = `# Typography Guide

<!-- renderer-typography-exceptions:start -->
\`\`\`json
{
  "schemaVersion": 1,
  "exceptions": [
    {
      "id": "non-text-close-icon",
      "path": "packages/blue-app/src/renderer/components/CloseButton.tsx",
      "category": "non-text-glyph",
      "expression": "close-glyph",
      "expectedOccurrences": 1,
      "ownerSurface": "Modal Close",
      "reason": "Icon glyph",
      "verification": "close-button.test.tsx",
      "reviewPolicy": "Replace with Lucide X"
    },
    {
      "id": "single-line-tag",
      "path": "packages/blue-app/src/renderer/components/Tag.tsx",
      "category": "single-line-line-height",
      "expression": "leading-none",
      "expectedOccurrences": 1,
      "ownerSurface": "Tag badge",
      "reason": "Single line badge",
      "verification": "tag.test.tsx",
      "reviewPolicy": "Keep centered"
    },
    {
      "id": "overmatching-exception",
      "path": "packages/blue-app/src/renderer/components/Overmatch.tsx",
      "category": "single-line-line-height",
      "expression": "leading-tight",
      "expectedOccurrences": 1,
      "ownerSurface": "Overmatch",
      "reason": "Test",
      "verification": "Test",
      "reviewPolicy": "Test"
    }
  ]
}
\`\`\`
<!-- renderer-typography-exceptions:end -->
`;

  const workspace = await createFixtureWorkspace({
    guide,
    files: {
      'packages/blue-app/src/renderer/components/CloseButton.tsx': `
        export function CloseButton() {
          return <span className="close-glyph" aria-label="Close">×</span>;
        }
      `,
      'packages/blue-app/src/renderer/components/Tag.tsx': `
        export function Tag() {
          return <span className="text-role-callout leading-none">Badge</span>;
        }
      `,
      'packages/blue-app/src/renderer/components/Overmatch.tsx': `
        export function Overmatch() {
          return (
            <div>
              <span className="text-role-callout leading-tight">First</span>
              <span className="text-role-callout leading-tight">Second</span>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.counts.approvedNonTextExceptions, 1);
    assert.equal(result.counts.approvedLineHeightExceptions, 1);
    assert.equal(result.counts.staleExceptions, 1);
    assert.equal(result.staleExceptions[0].id, 'overmatching-exception');
    assert.equal(result.staleExceptions[0].observedOccurrences, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('excludes test, browser, __mocks__, and @blue/data from audit scope', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/tests/sample.test.tsx': `
        export const testHtml = '<span className="text-xs">Test only</span>';
      `,
      'packages/blue-app/src/renderer/browser/sample.browser.test.tsx': `
        export const browserHtml = '<span className="text-[8px]">Browser only</span>';
      `,
      'packages/blue-app/src/renderer/__mocks__/sample.ts': `
        export const mock = { fontSize: 8 };
      `,
      'packages/blue-data/src/sample.ts': `
        export const dataFontSize = 8;
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 0);
    assert.equal(result.passed, true);
    assert.equal(result.counts.unapprovedDefaultScaleUtilities, 0);
    assert.equal(result.counts.unapprovedArbitrarySizes, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('normalizes paths to deterministic POSIX format on all platforms', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/TestPath.tsx': `
        export function TestPath() {
          return <span className="text-nano">Nano</span>;
        }
      `,
    },
  });

  try {
    const { result } = await runAudit(workspace);
    assert.ok(result.findings.length > 0);
    for (const finding of result.findings) {
      assert.ok(!finding.path.includes('\\'), 'Finding path must use forward slashes');
      assert.ok(finding.path.startsWith('packages/blue-app/src/renderer/'));
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects a dynamic or expanded token namespace', async () => {
  const workspace = await createFixtureWorkspace({
    indexCss: VALID_INDEX_CSS
      .replace('@theme static {', '@theme {')
      .replace('  --text-*: initial;\n\n', '')
      .replace('  --text-role-body: 13px;', '  --text-role-body: 13px;\n  --text-legacy-extra: 12px;'),
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.passed, false);
    assert.ok(result.catalogErrors.some((error) => error.includes('@theme static')));
    assert.ok(result.catalogErrors.some((error) => error.includes('--text-*')));
    assert.ok(result.catalogErrors.some((error) => error.includes('--text-legacy-extra')));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects multiline SVG attributes, JSX fontSize attributes, and inline lineHeight assignments', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/MultilineTypography.tsx': `
        export function MultilineTypography() {
          return (
            <div style={{
              fontSize: 10,
              lineHeight: '1.2',
            }}>
              <svg>
                <text
                  x={0}
                  fontSize={9}
                >Small axis</text>
              </svg>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.counts.unapprovedInlineSizes, 1);
    assert.equal(result.counts.unapprovedSvgSizes, 1);
    assert.equal(result.counts.unapprovedLineHeightOverrides, 1);
    assert.equal(result.counts.applicationTextBelowFloor, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects raw CSS font shorthands, line heights, and typography custom properties', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/styles/custom.css': `
        .invalid-label {
          font: 10px sans-serif;
          line-height: 12px;
          --custom-font-size: 10px;
        }
        .valid-label {
          --component-font-size: var(--text-role-body);
          font: var(--text-role-body);
          line-height: var(--text-role-body--line-height);
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.counts.unapprovedCssSizes, 2);
    assert.equal(result.counts.unapprovedLineHeightOverrides, 1);
    assert.equal(result.counts.applicationTextBelowFloor, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('rejects implicit small, sub, and sup elements without an explicit role', async () => {
  const workspace = await createFixtureWorkspace({
    files: {
      'packages/blue-app/src/renderer/components/ImplicitElements.tsx': `
        export function ImplicitElements() {
          return (
            <div>
              <small>Small</small>
              <sub>Subscript</sub>
              <sup>Superscript</sup>
              <small className="text-role-subheadline">Approved annotation</small>
            </div>
          );
        }
      `,
    },
  });

  try {
    const { exitCode, result } = await runAudit(workspace);
    assert.equal(exitCode, 1);
    assert.equal(result.counts.unapprovedImplicitElements, 3);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('fails fast on malformed and duplicate exception registries', async () => {
  const malformedWorkspace = await createFixtureWorkspace({
    guide: `# Typography Guide\n\n<!-- renderer-typography-exceptions:start -->\n\`\`\`json\n{\"schemaVersion\": 1,\n\`\`\`\n<!-- renderer-typography-exceptions:end -->`,
  });
  const duplicateWorkspace = await createFixtureWorkspace({
    guide: `# Typography Guide\n\n<!-- renderer-typography-exceptions:start -->\n\`\`\`json\n{\"schemaVersion\": 1, \"exceptions\": [{\"id\": \"duplicate\", \"path\": \"x\", \"category\": \"project-authored-font\", \"expression\": \"x\", \"expectedOccurrences\": 1, \"ownerSurface\": \"x\", \"reason\": \"x\", \"verification\": \"x\", \"reviewPolicy\": \"x\"}, {\"id\": \"duplicate\", \"path\": \"y\", \"category\": \"project-authored-font\", \"expression\": \"y\", \"expectedOccurrences\": 1, \"ownerSurface\": \"y\", \"reason\": \"y\", \"verification\": \"y\", \"reviewPolicy\": \"y\"}]}\n\`\`\`\n<!-- renderer-typography-exceptions:end -->`,
  });

  try {
    const malformed = await runAudit(malformedWorkspace);
    assert.equal(malformed.exitCode, 2);
    const duplicate = await runAudit(duplicateWorkspace);
    assert.equal(duplicate.exitCode, 2);
  } finally {
    await rm(malformedWorkspace, { recursive: true, force: true });
    await rm(duplicateWorkspace, { recursive: true, force: true });
  }
});
