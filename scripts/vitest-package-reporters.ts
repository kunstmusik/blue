import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  InlineConfig,
  Reporter,
  SerializedError,
  TestCase,
  TestModule,
  TestRunEndReason,
  Vitest,
} from 'vitest/node';
import type { TestAnnotation } from 'vitest';

const DEFAULT_SUMMARY_HEADING = '## Vitest Test Report';

interface GithubActionsReporterConstructor {
  new (options?: {
    jobSummary?: {
      outputPath?: string;
    };
  }): Reporter;
}

class PackageGithubActionsReporter implements Reporter {
  private context: Vitest | undefined;

  constructor(
    private readonly packageName: string,
    private readonly summaryPath: string | undefined,
    private readonly temporaryDirectory: string | undefined,
    private readonly temporarySummaryPath: string | undefined,
    private readonly reporter: Reporter,
  ) {}

  onInit(context: Vitest): void {
    this.context = context;
    this.reporter.onInit?.(context);
  }

  onTestCaseAnnotate(testCase: TestCase, annotation: TestAnnotation) {
    return this.reporter.onTestCaseAnnotate?.(testCase, annotation);
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ): Promise<void> {
    await this.reporter.onTestRunEnd?.(testModules, unhandledErrors, reason);

    if (
      this.summaryPath === undefined ||
      this.temporaryDirectory === undefined ||
      this.temporarySummaryPath === undefined
    ) {
      return;
    }

    try {
      const summary = readFileSync(this.temporarySummaryPath, 'utf8');
      const packageHeading = `${DEFAULT_SUMMARY_HEADING} — \`${this.packageName}\``;
      const labeledSummary = summary.includes(DEFAULT_SUMMARY_HEADING)
        ? summary.replace(DEFAULT_SUMMARY_HEADING, packageHeading)
        : `${packageHeading}\n\n${summary}`;

      appendFileSync(this.summaryPath, labeledSummary);
    } catch (error) {
      this.context?.logger.warn(
        `Could not write the Vitest job summary for ${this.packageName}`,
        error,
      );
    } finally {
      rmSync(this.temporaryDirectory, { recursive: true, force: true });
    }
  }
}

export function createPackageReporterConfig(
  packageName: string,
  GithubActionsReporter: GithubActionsReporterConstructor,
): Pick<InlineConfig, 'reporters'> {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return {};
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  // Vitest's built-in summary heading is fixed, so relabel an isolated copy.
  const temporaryDirectory =
    summaryPath === undefined ? undefined : mkdtempSync(join(tmpdir(), 'blue-vitest-summary-'));
  const temporarySummaryPath =
    temporaryDirectory === undefined ? undefined : join(temporaryDirectory, 'summary.md');
  const reporter = new GithubActionsReporter({
    jobSummary: {
      outputPath: temporarySummaryPath,
    },
  });

  return {
    reporters: [
      'default',
      new PackageGithubActionsReporter(
        packageName,
        summaryPath,
        temporaryDirectory,
        temporarySummaryPath,
        reporter,
      ),
    ],
  };
}
