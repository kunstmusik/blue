/**
 * Test-only reader for the canonical Java Blue automation parity corpus.
 *
 * Node APIs are allowed here because this file lives under test-support and
 * is never part of the production `@blue/data` bundle. All consumers read the
 * committed corpus at `fixtures/java-blue-automation-parity/v1/`; none may
 * maintain a separate expected-result table.
 */

import fs from "node:fs";
import path from "node:path";

export interface JavaParityManifest {
  schemaVersion: number;
  generator: { id: string; version: string };
  java: { release: number };
  javaBlue: {
    repository: string;
    commit: string;
    sourceFiles: Array<{ path: string; sha256: string }>;
  };
  referenceMethods: string[];
  seed: { algorithm: string; value: string };
  generationCommand: string;
  counts: {
    total: number;
    bySection: Record<string, number>;
    byOrigin: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export type FixtureOrigin = "curated" | "seeded";

export type ExpectedKind = "bits" | "exception";

export interface RealtimeFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  resolutionText: string;
  curve: string;
  points: Array<{ time: number; value: number }>;
  evaluationTime: number;
  expectedKind: ExpectedKind;
  expectedBits: string;
  expectedCategory: string;
  sampleRate: number | null;
  sampleNumber: number | null;
}

export type ResolutionOperation =
  | "parse"
  | "legacy-normalize"
  | "parameter-load-save"
  | "snap";

export interface ResolutionFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  operation: ResolutionOperation;
  parameterBdText: string;
  parameterLegacyText: string;
  lineBdText: string;
  lineLegacyText: string;
  snapValue: number | null;
  snapMin: number | null;
  snapMax: number | null;
  expectedCoefficient: string;
  expectedScale: number | null;
  expectedCanonicalText: string;
  expectedDouble: number | null;
  expectedActivation: boolean | null;
  expectedParameterSave: string | null;
  expectedLineSave: string | null;
  expectedSnap: number | null;
  expectedLinePoints: Array<{ time: number; value: number }> | null;
  expectedKind: ExpectedKind;
  expectedCategory: string;
}

export interface OfflineFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  resolutionText: string;
  points: Array<{ time: number; value: number }>;
  renderStart: number;
  renderEnd: number;
  instrumentId: number;
  expectedInitialBits: string;
  expectedInitialization: string;
  expectedScore: string;
  expectedKind: ExpectedKind;
  expectedCategory: string;
}

function resolveCorpusDirectory(): string {
  const relativeCorpusPath = path.join("fixtures", "java-blue-automation-parity", "v1");
  const candidates = [
    path.resolve(process.cwd(), relativeCorpusPath),
    path.resolve(process.cwd(), "..", "..", relativeCorpusPath),
    ...(typeof __dirname === "string"
      ? [
          path.resolve(__dirname, "..", "..", "..", "..", relativeCorpusPath),
          path.resolve(__dirname, "..", "..", "..", "..", "..", relativeCorpusPath),
        ]
      : []),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "manifest.json"))) {
      return candidate;
    }
  }

  throw new Error(`Java automation parity corpus not found; searched: ${candidates.join(", ")}`);
}

const CORPUS_DIR = resolveCorpusDirectory();

const bitsView = new DataView(new ArrayBuffer(8));

/** Decodes 16 lowercase hexadecimal raw IEEE 754 bits into a double. */
export function bitsToDouble(hex: string): number {
  if (!/^[0-9a-f]{16}$/.test(hex)) {
    throw new Error(`invalid raw binary64 bits: ${JSON.stringify(hex)}`);
  }
  bitsView.setBigUint64(0, BigInt(`0x${hex}`));
  return bitsView.getFloat64(0);
}

/** Encodes a double as 16 lowercase hexadecimal raw bits. */
export function doubleToBits(value: number): string {
  bitsView.setFloat64(0, value);
  return bitsView.getBigUint64(0).toString(16).padStart(16, "0");
}

function readTsv(name: string): string[][] {
  const filePath = path.join(CORPUS_DIR, name);
  const text = fs.readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error(`${name} must not contain a BOM`);
  }
  const lines = text.split("\n");
  if (lines[lines.length - 1] !== "") {
    throw new Error(`${name} must end with a newline`);
  }
  const header = lines[0].split("\t");
  const rows: string[][] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const fields = lines[i].split("\t");
    if (fields.length !== header.length) {
      throw new Error(`${name} line ${i + 1}: expected ${header.length} fields, found ${fields.length}`);
    }
    rows.push(fields);
  }
  return rows;
}

function indexMap(header: string[]): Map<string, number> {
  return new Map(header.map((name, index) => [name, index]));
}

function parsePointsBits(pointsBits: string): Array<{ time: number; value: number }> {
  if (pointsBits === "") return [];
  return pointsBits.split(";").map((entry) => {
    const [timeBits, valueBits] = entry.split(":");
    return { time: bitsToDouble(timeBits), value: bitsToDouble(valueBits) };
  });
}

function decodeBase64(text: string): string {
  return Buffer.from(text, "base64").toString("utf8");
}

export function loadJavaParityManifest(): JavaParityManifest {
  const manifestPath = path.join(CORPUS_DIR, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as JavaParityManifest;
}

export function loadRealtimeFixtureCases(): RealtimeFixtureCase[] {
  const rows = readTsv("realtime.tsv");
  const columns = indexMap(
    "caseId,origin,category,resolutionText,curve,pointsBits,evaluationTimeBits,expectedKind,expectedBits,expectedCategory,sampleRateBits,sampleNumberBits".split(
      ",",
    ),
  );
  return rows.map((fields) => ({
    caseId: fields[columns.get("caseId")!],
    origin: fields[columns.get("origin")!] as FixtureOrigin,
    category: fields[columns.get("category")!],
    resolutionText: fields[columns.get("resolutionText")!],
    curve: fields[columns.get("curve")!],
    points: parsePointsBits(fields[columns.get("pointsBits")!]),
    evaluationTime: bitsToDouble(fields[columns.get("evaluationTimeBits")!]),
    expectedKind: fields[columns.get("expectedKind")!] as ExpectedKind,
    expectedBits: fields[columns.get("expectedBits")!],
    expectedCategory: fields[columns.get("expectedCategory")!],
    sampleRate: fields[columns.get("sampleRateBits")!] === "" ? null : bitsToDouble(fields[columns.get("sampleRateBits")!]),
    sampleNumber: fields[columns.get("sampleNumberBits")!] === "" ? null : bitsToDouble(fields[columns.get("sampleNumberBits")!]),
  }));
}

export function loadResolutionFixtureCases(): ResolutionFixtureCase[] {
  const rows = readTsv("resolution.tsv");
  const header =
    "caseId,origin,category,operation,parameterBdText,parameterLegacyText,lineBdText,lineLegacyText,snapValueBits,snapMinBits,snapMaxBits,expectedCoefficient,expectedScale,expectedCanonicalText,expectedDoubleBits,expectedActivation,expectedParameterSaveBase64,expectedLineSaveBase64,expectedSnapBits,expectedLinePointsBits,expectedKind,expectedCategory".split(
      ",",
    );
  const columns = indexMap(header);
  return rows.map((row) => {
    const get = (name: string): string => {
      const index = columns.get(name);
      if (index === undefined) throw new Error(`missing column ${name}`);
      return row[index];
    };
    const optBits = (name: string): number | null => {
      const text = get(name);
      return text === "" ? null : bitsToDouble(text);
    };
    return {
      caseId: get("caseId"),
      origin: get("origin") as FixtureOrigin,
      category: get("category"),
      operation: get("operation") as ResolutionOperation,
      parameterBdText: get("parameterBdText"),
      parameterLegacyText: get("parameterLegacyText"),
      lineBdText: get("lineBdText"),
      lineLegacyText: get("lineLegacyText"),
      snapValue: optBits("snapValueBits"),
      snapMin: optBits("snapMinBits"),
      snapMax: optBits("snapMaxBits"),
      expectedCoefficient: get("expectedCoefficient"),
      expectedScale: get("expectedScale") === "" ? null : Number(get("expectedScale")),
      expectedCanonicalText: get("expectedCanonicalText"),
      expectedDouble: optBits("expectedDoubleBits"),
      expectedActivation: get("expectedActivation") === "" ? null : get("expectedActivation") === "1",
      expectedParameterSave: get("expectedParameterSaveBase64") === "" ? null : decodeBase64(get("expectedParameterSaveBase64")),
      expectedLineSave: get("expectedLineSaveBase64") === "" ? null : decodeBase64(get("expectedLineSaveBase64")),
      expectedSnap: optBits("expectedSnapBits"),
      expectedLinePoints: get("expectedLinePointsBits") === "" ? null : parsePointsBits(get("expectedLinePointsBits")),
      expectedKind: get("expectedKind") as ExpectedKind,
      expectedCategory: get("expectedCategory"),
    };
  });
}

export function loadOfflineFixtureCases(): OfflineFixtureCase[] {
  const rows = readTsv("offline.tsv");
  const header =
    "caseId,origin,category,resolutionText,pointsBits,renderStartBits,renderEndBits,instrumentId,expectedInitialBits,expectedInitializationBase64,expectedScoreBase64,expectedKind,expectedCategory".split(
      ",",
    );
  const columns = indexMap(header);
  return rows.map((row) => {
    const get = (name: string): string => {
      const index = columns.get(name);
      if (index === undefined) throw new Error(`missing column ${name}`);
      return row[index];
    };
    return {
      caseId: get("caseId"),
      origin: get("origin") as FixtureOrigin,
      category: get("category"),
      resolutionText: get("resolutionText"),
      points: parsePointsBits(get("pointsBits")),
      renderStart: bitsToDouble(get("renderStartBits")),
      renderEnd: bitsToDouble(get("renderEndBits")),
      instrumentId: Number(get("instrumentId")),
      expectedInitialBits: get("expectedInitialBits"),
      expectedInitialization: decodeBase64(get("expectedInitializationBase64")),
      expectedScore: decodeBase64(get("expectedScoreBase64")),
      expectedKind: get("expectedKind") as ExpectedKind,
      expectedCategory: get("expectedCategory"),
    };
  });
}

/**
 * Validates the manifest against the sections being loaded: schema version,
 * per-section counts, origin counts, and category counts. Every consumer must
 * run this before testing cases.
 */
export function assertManifestInvariants(
  manifest: JavaParityManifest,
  sections: {
    realtime?: RealtimeFixtureCase[];
    resolution?: ResolutionFixtureCase[];
    offline?: OfflineFixtureCase[];
  },
): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`unsupported fixture schema version: ${manifest.schemaVersion}`);
  }
  if (manifest.seed.algorithm !== "SplitMix64") {
    throw new Error(`unexpected seed algorithm: ${manifest.seed.algorithm}`);
  }
  const categoryCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  let total = 0;
  const tally = (cases: Array<{ caseId: string; origin: string; category: string }>, section: string) => {
    if (manifest.counts.bySection[section] !== cases.length) {
      throw new Error(
        `section count mismatch for ${section}: manifest ${manifest.counts.bySection[section]}, actual ${cases.length}`,
      );
    }
    for (const fixtureCase of cases) {
      total += 1;
      categoryCounts.set(fixtureCase.category, (categoryCounts.get(fixtureCase.category) ?? 0) + 1);
      originCounts.set(fixtureCase.origin, (originCounts.get(fixtureCase.origin) ?? 0) + 1);
    }
  };
  if (sections.realtime) tally(sections.realtime, "realtime");
  if (sections.resolution) tally(sections.resolution, "resolution");
  if (sections.offline) tally(sections.offline, "offline");
  if (total !== manifest.counts.total) {
    throw new Error(`total count mismatch: manifest ${manifest.counts.total}, actual ${total}`);
  }
  for (const [category, count] of Object.entries(manifest.counts.byCategory)) {
    if (categoryCounts.get(category) !== count) {
      throw new Error(
        `category count mismatch for ${category}: manifest ${count}, actual ${categoryCounts.get(category) ?? 0}`,
      );
    }
  }
  for (const [origin, count] of Object.entries(manifest.counts.byOrigin)) {
    if (originCounts.get(origin) !== count) {
      throw new Error(
        `origin count mismatch for ${origin}: manifest ${count}, actual ${originCounts.get(origin) ?? 0}`,
      );
    }
  }
}
