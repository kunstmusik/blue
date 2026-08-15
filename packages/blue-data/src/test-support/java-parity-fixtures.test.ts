import { describe, expect, it } from "vitest";

import {
  assertManifestInvariants,
  bitsToDouble,
  doubleToBits,
  loadJavaParityManifest,
  loadOfflineFixtureCases,
  parseTsvText,
  loadRealtimeFixtureCases,
  loadResolutionFixtureCases,
  type RealtimeFixtureCase,
} from "./java-parity-fixtures";

describe("Java parity fixture corpus (no JVM required)", () => {
  it("validates the manifest against every section", () => {
    const manifest = loadJavaParityManifest();
    const realtime = loadRealtimeFixtureCases();
    const resolution = loadResolutionFixtureCases();
    const offline = loadOfflineFixtureCases();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.javaBlue.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.javaBlue.sourceFiles.length).toBeGreaterThan(0);
    expect(manifest.referenceMethods.length).toBeGreaterThan(0);
    expect(manifest.seed.algorithm).toBe("SplitMix64");

    assertManifestInvariants(manifest, { realtime, resolution, offline });

    // exactly 2,048 deterministic seeded realtime linear cases
    const seeded = realtime.filter((c) => c.origin === "seeded");
    expect(seeded.length).toBe(2048);
    expect(seeded.every((c) => c.category === "seeded-linear" && c.curve === "LINEAR")).toBe(true);

    // every curated boundary category present
    const categories = new Set(realtime.map((c) => c.category));
    for (const required of [
      "empty-line",
      "single-point",
      "time-zero",
      "direct-point",
      "duplicate-time",
      "after-last",
      "before-first",
      "ascending",
      "descending",
      "flat",
      "zero-crossing",
      "exact-grid",
      "adjacent-grid",
      "special-values",
      "non-finite",
      "resolution-variant",
      "manager-boundary",
    ]) {
      expect(categories.has(required), `missing realtime category ${required}`).toBe(true);
    }

    const operations = new Set(resolution.map((c) => c.operation));
    expect(operations).toEqual(
      new Set(["parse", "legacy-normalize", "parameter-load-save", "snap"]),
    );

    const offlineCategories = new Set(offline.map((c) => c.category));
    expect(offlineCategories.has("stepped-ascending")).toBe(true);
    expect(offlineCategories.has("line-path")).toBe(true);
    expect(offlineCategories.has("zero-step")).toBe(true);
  });

  it("encodes and decodes raw binary64 bits exactly", () => {
    expect(bitsToDouble("3fb999999999999a")).toBe(0.1);
    expect(doubleToBits(0.1)).toBe("3fb999999999999a");
    expect(bitsToDouble("8000000000000000")).toBe(-0.0);
    expect(doubleToBits(-0.0)).toBe("8000000000000000");
    expect(bitsToDouble("7ff8000000000000")).toBeNaN();
  });

  it("parses CRLF TSV text without leaking carriage returns into fields", () => {
    const rows = parseTsvText(
      "synthetic.tsv",
      ["name\toptionalBits", "empty-sample-number\t", ""].join("\r\n"),
    );

    expect(rows).toEqual([["empty-sample-number", ""]]);
  });

  it("carries manager-level sample rate/number metadata", () => {
    const mgr = loadRealtimeFixtureCases().find((c) => c.caseId === "c-rt-mgr-48000");
    expect(mgr).toBeDefined();
    expect(mgr!.sampleRate).toBe(48000.0);
    expect(mgr!.sampleNumber).toBe(16000.0);
    expect(mgr!.evaluationTime).toBe(16000.0 / 48000.0);
  });

  it("detects a deliberate one-bit mutation and reports the case id", () => {
    const cases = loadRealtimeFixtureCases();
    const bitsCase = cases.find((c) => c.expectedKind === "bits" && c.expectedBits !== "");
    expect(bitsCase).toBeDefined();

    // flip the last bit of the expected value
    const mutated: RealtimeFixtureCase = {
      ...bitsCase!,
      expectedBits: bitsCase!.expectedBits.slice(0, 15)
        + (bitsCase!.expectedBits[15] === "0" ? "1" : "0"),
    };
    const mutatedCases = cases.map((c) => (c.caseId === mutated.caseId ? mutated : c));

    // the "implementation" returns each case's original Java value; only the
    // mutated expectation differs, so exactly that case must be reported
    const originalById = new Map(cases.map((c) => [c.caseId, c.expectedBits]));
    const failures = collectRealtimeFailures(mutatedCases, (fixtureCase) =>
      bitsToDouble(originalById.get(fixtureCase.caseId)!),
    );
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain(mutated.caseId);
  });
});

/**
 * Shared comparison helper used by the parity suites: compares exact output
 * bits per case and reports the failing case ids with full input context.
 */
export function collectRealtimeFailures(
  cases: RealtimeFixtureCase[],
  evaluate: (fixtureCase: RealtimeFixtureCase) => number,
): string[] {
  const failures: string[] = [];
  for (const fixtureCase of cases) {
    if (fixtureCase.expectedKind !== "bits") continue;
    const actual = doubleToBits(evaluate(fixtureCase));
    if (actual !== fixtureCase.expectedBits) {
      failures.push(
        `${fixtureCase.caseId} (category=${fixtureCase.category}, resolution=${fixtureCase.resolutionText}, ` +
          `points=${JSON.stringify(fixtureCase.points)}, time=${fixtureCase.evaluationTime}, ` +
          `expected=${fixtureCase.expectedBits}, actual=${actual})`,
      );
    }
  }
  return failures;
}
