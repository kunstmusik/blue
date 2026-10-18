import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  GenericInstrument,
  Effect,
  GenericScore,
  BlueSynthBuilder,
  PythonInstrument,
  ClojureObject,
  PianoRoll,
} from '@blue/data';
import { BlueShareTransport } from './transport';

export type TestResourceKind = 'instrument' | 'effect' | 'soundObject';

export interface TestCategory {
  readonly id: number;
  readonly kind: TestResourceKind;
  readonly parentId: number | null;
  readonly name: string;
  readonly description: string | null;
}

export interface TestAuthor {
  readonly id: string;
  readonly name: string;
  readonly username: string;
}

export interface TestResourceSummary {
  readonly kind: TestResourceKind;
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly blueType: string | null;
  readonly createdAt: string | null;
  readonly category: {
    readonly id: number;
    readonly name: string;
  };
  readonly author: TestAuthor;
}

export interface TestResourceDetail extends TestResourceSummary {
  readonly xml: string;
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly username: string;
}

export interface BlueShareTestDirectory {
  readonly directory: string;
  readonly databasePath: string;
  readonly statePath: string;
  cleanup(): void;
}

export function createBlueShareTestDirectory(
  prefix = 'blue-blueshare-test-',
): BlueShareTestDirectory {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    directory,
    databasePath: path.join(directory, 'blue_libraries.sqlite'),
    statePath: path.join(directory, 'blue-libraries-state.json'),
    cleanup(): void {
      fs.rmSync(directory, { force: true, recursive: true });
    },
  };
}

// Deterministic synthetic XML generators using @blue/data models
export function createSyntheticInstrumentXml(name = 'Test Synth'): string {
  const instr = new GenericInstrument();
  instr.setName(name);
  instr.setText('i1 0 1\n');
  return instr.saveAsXML().toXml();
}

export function createSyntheticEffectXml(name = 'Test Delay'): string {
  const effect = new Effect();
  effect.setName(name);
  effect.setCode('aout = ain\n');
  return effect.saveAsXML().toXml();
}

export function createSyntheticSoundObjectXml(name = 'Test Score'): string {
  const score = new GenericScore();
  score.setName(name);
  score.setScoreText('i1 0 2 0.5 440\n');
  return score.saveAsXML().toXml();
}

/**
 * Documented historical BlueSynthBuilder fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/resource-evidence.md lines 76-91;
 * packages/blue-data/src/resource-xml-policy.test.ts lines 29-37, 81-100.
 * Exercises:
 * - Retired helper `uniqueNameManager` with empty whitespace: produces warning `R-BSB-UNIQUE-NAME-STATE`
 *   and omits the helper on canonical write.
 * - Documented historical `bsbParameterList` alias instead of `parameterList`.
 */
export function createHistoricalInstrumentXml(name = 'Historical BSB Synth'): string {
  const bsb = new BlueSynthBuilder();
  bsb.setName(name);
  bsb.setComment('Historical BSB with retired naming helper');
  return bsb
    .saveAsXML()
    .toXml()
    .replace(
      '</graphicInterface>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="20">\n  \t</uniqueNameManager></graphicInterface>',
    )
    .replace('<parameterList/>', '<bsbParameterList/>');
}

/**
 * Documented historical conflict fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/resource-evidence.md line 56;
 * packages/blue-data/src/instruments/blue-synth-builder.ts lines 1208-1213.
 * Exercises competing aliases: co-existence of both <parameterList/> and <bsbParameterList/>
 * rejects with validation error `conflict`.
 */
export function createHistoricalConflictingInstrumentXml(name = 'Conflicting BSB Synth'): string {
  const bsb = new BlueSynthBuilder();
  bsb.setName(name);
  return bsb
    .saveAsXML()
    .toXml()
    .replace('<parameterList/>', '<parameterList/>\n  <bsbParameterList/>');
}

/**
 * Documented historical conflict fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/resource-evidence.md line 91;
 * packages/blue-data/src/resource-xml-policy.test.ts lines 102-124.
 * Exercises meaningful content in retired uniqueNameManager: rejects with error `value` on #text.
 */
export function createHistoricalMeaningfulHelperInstrumentXml(
  name = 'Meaningful Helper BSB',
): string {
  const bsb = new BlueSynthBuilder();
  bsb.setName(name);
  return bsb
    .saveAsXML()
    .toXml()
    .replace(
      '</graphicInterface>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="20">retired state</uniqueNameManager></graphicInterface>',
    );
}

/**
 * Documented historical Effect fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/resource-evidence.md line 67;
 * packages/blue-data/src/mixer/effect.ts lines 277-289.
 * Exercises historical `bsbParameterList` alias in an Effect root.
 */
export function createHistoricalEffectXml(name = 'Historical Effect'): string {
  return `<effect>
  <name>${name}</name>
  <enabled>true</enabled>
  <numIns>1</numIns>
  <numOuts>1</numOuts>
  <code>aout = ain\\n</code>
  <comments>Historical effect with bsbParameterList</comments>
  <opcodeList/>
  <graphicInterface/>
  <bsbParameterList/>
</effect>`;
}

/**
 * Documented historical Effect conflict fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/resource-evidence.md line 67;
 * packages/blue-data/src/mixer/effect.ts lines 277-284.
 * Exercises competing parameter list representations: simultaneous <parameterList/> and <bsbParameterList/>
 * rejects with error `conflict`.
 */
export function createHistoricalConflictingEffectXml(name = 'Conflicting Effect'): string {
  return `<effect>
  <name>${name}</name>
  <enabled>true</enabled>
  <numIns>1</numIns>
  <numOuts>1</numOuts>
  <code>aout = ain\\n</code>
  <comments>Conflicting effect</comments>
  <opcodeList/>
  <graphicInterface/>
  <parameterList/>
  <bsbParameterList/>
</effect>`;
}

/**
 * Documented historical PianoRoll fixture from Feature 116.
 * Provenance: specs/116-xml-compatibility-contracts/sound-library-evidence.md;
 * packages/blue-data/src/resource-xml-policy.test.ts lines 59-79.
 * Exercises historical ruler metadata `<timeUnit>6</timeUnit>`: generates warning `SL-H06`
 * and retains the interval on save.
 */
export function createHistoricalSoundObjectXml(name = 'Historical PianoRoll'): string {
  return `<soundObject type="blue.soundObject.PianoRoll">
  <name>${name}</name>
  <timeUnit>6</timeUnit>
</soundObject>`;
}

/**
 * Supported runtime-backed PythonInstrument fixture.
 * Provenance: packages/blue-data/src/instruments/python-instrument.ts; FR-005, FR-015.
 * Contains Python script code that must load and save without requiring a Python/Jython
 * runtime installed and without executing the Python code.
 */
export function createPythonInstrumentXml(name = 'Python Synth'): string {
  const py = new PythonInstrument();
  py.setName(name);
  py.setComment('Python runtime-backed instrument');
  py.setText(
    'import os, sys\\n# Arbitrary code that must never execute during import or inspection\\nraise RuntimeError("Executed!")\\n',
  );
  return py.saveAsXML().toXml();
}

/**
 * Supported runtime-backed ClojureObject fixture.
 * Provenance: packages/blue-data/src/sound-objects/clojure-object.ts; FR-005, FR-015.
 * Contains Clojure script code that must load and save without requiring a Java/Clojure
 * runtime installed and without executing the Clojure code.
 */
export function createClojureSoundObjectXml(name = 'Clojure Score'): string {
  const clj = new ClojureObject();
  clj.setName(name);
  clj.setClojureCode(
    '; Arbitrary clojure code that must never execute during import or inspection\\n(throw (Exception. "Executed!"))\\n(def score "i1 0 2 0.5 440")',
  );
  return clj.saveAsXML().toXml();
}

/**
 * Whitespace-preserving fixtures for all three kinds.
 * Provenance: FR-005; specs/117-blueshare-parity/spec.md lines 166-169.
 * Preserves significant whitespace (tabs, leading/trailing blanks, multiline indents)
 * across normalize, copy, save, and reload cycles.
 */
export const SIGNIFICANT_INSTRUMENT_CODE = `\\t\\tinstr 1\\n  \\t\\t;; Leading tabs and indentation\\n  a1 oscili 1000, 440, 1\\n  out a1\\n\\tendin\\n\\n`;

export function createWhitespacePreservingInstrumentXml(name = 'Whitespace Synth'): string {
  const instr = new GenericInstrument();
  instr.setName(name);
  instr.setComment('  Indented comment with leading space  ');
  instr.setText(SIGNIFICANT_INSTRUMENT_CODE);
  return instr.saveAsXML().toXml();
}

export const SIGNIFICANT_EFFECT_CODE = `\\t\\t;; Effect code with exact indentation\\n  aout = ain * 0.5\\n  \\t\\n`;

export function createWhitespacePreservingEffectXml(name = 'Whitespace Delay'): string {
  const effect = new Effect();
  effect.setName(name);
  effect.setComments('  Effect comment with spaces  ');
  effect.setCode(SIGNIFICANT_EFFECT_CODE);
  return effect.saveAsXML().toXml();
}

export const SIGNIFICANT_SCORE_TEXT = `\\t\\ti1 0 2 0.5 440\\n  \\ti1 2 2 0.5 880\\n\\t\\t\\n`;

export function createWhitespacePreservingSoundObjectXml(name = 'Whitespace Score'): string {
  const score = new GenericScore();
  score.setName(name);
  score.setScoreText(SIGNIFICANT_SCORE_TEXT);
  return score.saveAsXML().toXml();
}

export function createInvalidXml(): string {
  return '<invalidRoot><malformed';
}

export function createUnsupportedTypeXml(): string {
  return '<instrument type="blue.orchestra.NonExistentInstrument"><name>Unsupported</name></instrument>';
}

export const TEST_USERS: readonly TestUser[] = [
  {
    id: 'user-001',
    email: 'steven@example.com',
    password: 'correct-horse-battery',
    name: 'Steven',
    username: 'steven',
  },
  {
    id: 'user-002',
    email: 'other@example.com',
    password: 'another-secret-password',
    name: 'Other Author',
    username: 'otherauthor',
  },
];

export interface CatalogFixtureOptions {
  readonly itemsPerKind?: number;
}

export function createSyntheticCatalog(options: CatalogFixtureOptions = {}) {
  const count = options.itemsPerKind ?? 30; // default >= 25
  const kinds: readonly TestResourceKind[] = ['instrument', 'effect', 'soundObject'];

  const categories: Record<TestResourceKind, TestCategory[]> = {
    instrument: [
      {
        id: 10,
        kind: 'instrument',
        parentId: null,
        name: 'Synthesizers',
        description: 'Synths and sound generators',
      },
      {
        id: 11,
        kind: 'instrument',
        parentId: 10,
        name: 'Subtractive',
        description: 'Subtractive synths',
      },
      { id: 12, kind: 'instrument', parentId: 10, name: 'FM', description: null },
      {
        id: 13,
        kind: 'instrument',
        parentId: null,
        name: 'Empty Category',
        description: 'No items here',
      },
    ],
    effect: [
      {
        id: 20,
        kind: 'effect',
        parentId: null,
        name: 'Delays & Reverbs',
        description: 'Time-based effects',
      },
      { id: 21, kind: 'effect', parentId: 20, name: 'Echo', description: null },
      { id: 22, kind: 'effect', parentId: null, name: 'Distortion', description: 'Saturators' },
      { id: 23, kind: 'effect', parentId: null, name: 'Empty Effects', description: null },
    ],
    soundObject: [
      {
        id: 30,
        kind: 'soundObject',
        parentId: null,
        name: 'Generators',
        description: 'Score generators',
      },
      { id: 31, kind: 'soundObject', parentId: 30, name: 'Patterns', description: null },
      {
        id: 32,
        kind: 'soundObject',
        parentId: null,
        name: 'Empty SoundObjects',
        description: null,
      },
    ],
  };

  const resources: Record<TestResourceKind, Map<number, TestResourceDetail>> = {
    instrument: new Map(),
    effect: new Map(),
    soundObject: new Map(),
  };

  // Generate at least 25 items per kind with overlapping IDs between kinds (1..count)
  for (const kind of kinds) {
    const cats = categories[kind].filter((c) => !c.name.startsWith('Empty'));
    for (let i = 1; i <= count; i++) {
      const cat = cats[i % cats.length];
      const author = TEST_USERS[i % TEST_USERS.length];
      const hasNullDesc = i % 5 === 0;
      const hasNullDate = i % 7 === 0;
      const blueType =
        kind === 'instrument'
          ? 'blue.orchestra.GenericInstrument'
          : kind === 'soundObject'
            ? 'blue.soundObject.GenericScore'
            : null;

      const xml =
        kind === 'instrument'
          ? createSyntheticInstrumentXml(`Instrument ${i}`)
          : kind === 'effect'
            ? createSyntheticEffectXml(`Effect ${i}`)
            : createSyntheticSoundObjectXml(`SoundObject ${i}`);

      const summary: TestResourceDetail = {
        kind,
        id: i, // Overlapping ID across kinds: ID 1 exists in instrument, effect, and soundObject!
        name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${i}`,
        description: hasNullDesc ? null : `Description for ${kind} ${i}`,
        blueType,
        createdAt: hasNullDate ? null : new Date(Date.UTC(2026, 0, 1 + i, 12, 0, 0)).toISOString(),
        category: { id: cat.id, name: cat.name },
        author: { id: author.id, name: author.name, username: author.username },
        xml,
      };

      resources[kind].set(i, summary);
    }
  }

  return { categories, resources };
}

export interface FakeRequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface FakeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export class FakeBlueShareServer {
  constructor(private readonly catalog = createSyntheticCatalog()) {}
  private readonly sessions = new Map<string, { user: TestUser; expiresAt: string }>();
  private sessionCounter = 0;
  private readonly removedIds = new Set<string>(); // `${kind}:${id}`

  // Fault injection controls
  public delayMs = 0;
  public lostCommittedWrites = false;
  public injectedStatus: number | null = null;
  public injectedBody: string | null = null;
  public retryAfterSeconds: number | null = null;

  resetFaults(): void {
    this.delayMs = 0;
    this.lostCommittedWrites = false;
    this.injectedStatus = null;
    this.injectedBody = null;
    this.retryAfterSeconds = null;
  }

  getDetail(kind: TestResourceKind, id: number): TestResourceDetail | null {
    if (this.removedIds.has(`${kind}:${id}`)) return null;
    return this.catalog.resources[kind].get(id) ?? null;
  }

  async handleRequest(options: FakeRequestOptions): Promise<FakeResponse> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.injectedStatus !== null) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.retryAfterSeconds !== null) {
        headers['retry-after'] = String(this.retryAfterSeconds);
      }
      return {
        status: this.injectedStatus,
        headers,
        body:
          this.injectedBody ??
          JSON.stringify({ error: { code: 'injected_error', message: 'Injected fault' } }),
      };
    }

    const parsedUrl = new URL(options.url, 'https://blue3.kunstmusik.com');
    const pathname = parsedUrl.pathname;
    const method = (options.method ?? 'GET').toUpperCase();

    // Check cookie session
    const cookieHeader = options.headers?.cookie ?? options.headers?.Cookie ?? '';
    const sessionMatch = /session_id=([^;]+)/.exec(cookieHeader);
    const sessionId = sessionMatch ? sessionMatch[1] : null;
    const session = sessionId ? this.sessions.get(sessionId) : null;

    // Check origin on mutations
    if (method === 'POST' || method === 'DELETE') {
      const origin = options.headers?.origin ?? options.headers?.Origin;
      if (origin !== 'https://blue3.kunstmusik.com') {
        return {
          status: 403,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: { code: 'invalid_origin', message: 'Forbidden origin' } }),
        };
      }
    }

    // Auth endpoints
    if (pathname === '/api/blueshare/v1/session') {
      if (method === 'POST') {
        const body = (
          options.body && typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        ) as Record<string, string>;
        const user = TEST_USERS.find(
          (u) => u.email === body?.email && u.password === body?.password,
        );
        if (!user) {
          return {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'invalid_credentials', message: 'Invalid email or password' },
            }),
          };
        }
        this.sessionCounter++;
        const newSessionId = `test-sess-${this.sessionCounter}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        this.sessions.set(newSessionId, { user, expiresAt });
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': `session_id=${newSessionId}; Path=/; HttpOnly; SameSite=Lax`,
          },
          body: JSON.stringify({ user: { id: user.id, name: user.name, username: user.username } }),
        };
      }

      if (method === 'GET') {
        if (!session) {
          return {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: { code: 'unauthorized', message: 'Not signed in' } }),
          };
        }
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            user: { id: session.user.id, name: session.user.name, username: session.user.username },
            expiresAt: session.expiresAt,
          }),
        };
      }

      if (method === 'DELETE') {
        if (sessionId) {
          this.sessions.delete(sessionId);
        }
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          },
          body: JSON.stringify({ signedOut: true }),
        };
      }
    }

    // Match /{kind}/...
    const kindMatch = /^\/api\/blueshare\/v1\/(instrument|effect|soundObject)\b/.exec(pathname);
    if (!kindMatch) {
      return {
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: { code: 'not_found', message: 'Endpoint not found' } }),
      };
    }

    const kind = kindMatch[1] as TestResourceKind;
    const rest = pathname.slice(`/api/blueshare/v1/${kind}`.length);

    // GET /{kind}/categories
    if (rest === '/categories' && method === 'GET') {
      const items = this.catalog.categories[kind];
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      };
    }

    // GET /{kind}/latest
    if (rest === '/latest' && method === 'GET') {
      const all = Array.from(this.catalog.resources[kind].values()).filter(
        (r) => !this.removedIds.has(`${kind}:${r.id}`),
      );
      // Sort: creation descending, null dates last, ID descending for ties
      all.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (diff !== 0) return diff;
        } else if (a.createdAt && !b.createdAt) {
          return -1;
        } else if (!a.createdAt && b.createdAt) {
          return 1;
        }
        return b.id - a.id;
      });
      const items = all.slice(0, 10).map(({ xml: _xml, ...summary }) => summary);
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      };
    }

    // GET /{kind}/mine
    if (rest === '/mine' && method === 'GET') {
      if (!session) {
        return {
          status: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            error: { code: 'unauthorized', message: 'Authentication required' },
          }),
        };
      }
      const beforeIdStr = parsedUrl.searchParams.get('beforeId');
      const limit = Math.min(
        Math.max(parseInt(parsedUrl.searchParams.get('limit') ?? '25', 10), 1),
        100,
      );
      const beforeId = beforeIdStr ? parseInt(beforeIdStr, 10) : null;

      let all = Array.from(this.catalog.resources[kind].values())
        .filter((r) => r.author.id === session.user.id && !this.removedIds.has(`${kind}:${r.id}`))
        .sort((a, b) => b.id - a.id);

      if (beforeId !== null) {
        all = all.filter((r) => r.id < beforeId);
      }

      const slice = all.slice(0, limit);
      const nextBeforeId = all.length > limit ? slice[slice.length - 1].id : null;
      const items = slice.map(({ xml: _xml, ...summary }) => summary);

      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items, nextBeforeId }),
      };
    }

    // GET or POST /{kind}/resources
    if (rest === '/resources' || rest === '') {
      if (method === 'GET') {
        const categoryIdStr = parsedUrl.searchParams.get('categoryId');
        const beforeIdStr = parsedUrl.searchParams.get('beforeId');
        const limit = Math.min(
          Math.max(parseInt(parsedUrl.searchParams.get('limit') ?? '25', 10), 1),
          100,
        );
        const beforeId = beforeIdStr ? parseInt(beforeIdStr, 10) : null;
        const categoryId = categoryIdStr ? parseInt(categoryIdStr, 10) : null;

        let all = Array.from(this.catalog.resources[kind].values()).filter(
          (r) => !this.removedIds.has(`${kind}:${r.id}`),
        );

        if (categoryId !== null) {
          all = all.filter((r) => r.category.id === categoryId);
        }

        all.sort((a, b) => b.id - a.id);

        if (beforeId !== null) {
          all = all.filter((r) => r.id < beforeId);
        }

        const slice = all.slice(0, limit);
        const nextBeforeId = all.length > limit ? slice[slice.length - 1].id : null;
        const items = slice.map(({ xml: _xml, ...summary }) => summary);

        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items, nextBeforeId }),
        };
      }

      if (method === 'POST') {
        if (!session) {
          return {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'unauthorized', message: 'Authentication required' },
            }),
          };
        }

        const body = (
          options.body && typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        ) as Record<string, unknown>;
        const categoryId = body?.categoryId as number;
        const name = (body?.name as string)?.trim();
        const description = (body?.description as string | null) ?? null;
        const blueType = (body?.blueType as string | null) ?? null;
        const xml = body?.xml as string;

        const cat = this.catalog.categories[kind].find((c) => c.id === categoryId);
        if (!cat) {
          return {
            status: 400,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'invalid_category', message: 'Category not found' },
            }),
          };
        }

        const newId = (Math.max(0, ...Array.from(this.catalog.resources[kind].keys())) || 0) + 1;
        const newSummary: TestResourceDetail = {
          kind,
          id: newId,
          name,
          description,
          blueType,
          createdAt: new Date().toISOString(),
          category: { id: cat.id, name: cat.name },
          author: { id: session.user.id, name: session.user.name, username: session.user.username },
          xml,
        };

        this.catalog.resources[kind].set(newId, newSummary);

        if (this.lostCommittedWrites) {
          // Write succeeded on server, but response is lost/errored!
          return {
            status: 504,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'gateway_timeout', message: 'Gateway timeout after write commit' },
            }),
          };
        }

        return {
          status: 201,
          headers: {
            'content-type': 'application/json',
            location: `/api/blueshare/v1/${kind}/resources/${newId}`,
          },
          body: JSON.stringify(newSummary),
        };
      }
    }

    // /{kind}/resources/{id}
    const idMatch = /^\/resources\/(\d+)$/.exec(rest);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      if (this.removedIds.has(`${kind}:${id}`)) {
        return {
          status: 410,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            error: { code: 'removed', message: 'Resource has been removed' },
          }),
        };
      }

      const res = this.catalog.resources[kind].get(id);
      if (!res) {
        return {
          status: 404,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: { code: 'not_found', message: 'Resource not found' } }),
        };
      }

      if (method === 'GET') {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(res),
        };
      }

      if (method === 'DELETE') {
        if (!session) {
          return {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'unauthorized', message: 'Authentication required' },
            }),
          };
        }
        if (res.author.id !== session.user.id) {
          return {
            status: 403,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'forbidden', message: 'You do not own this resource' },
            }),
          };
        }

        const alreadyRemoved = this.removedIds.has(`${kind}:${id}`);
        this.removedIds.add(`${kind}:${id}`);

        if (this.lostCommittedWrites) {
          return {
            status: 504,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              error: { code: 'gateway_timeout', message: 'Gateway timeout after remove' },
            }),
          };
        }

        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind, id, removed: true, alreadyRemoved }),
        };
      }
    }

    return {
      status: 404,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: { code: 'not_found', message: 'Endpoint not found' } }),
    };
  }
}

export function createConnectedTransport(
  fakeServer: FakeBlueShareServer,
  options: { origin?: string } = {},
): BlueShareTransport {
  const cookieStores = new Map<string, Record<string, string>>();

  const transport = new BlueShareTransport({
    origin: options.origin,
    requestAdapter: async (opts) => {
      const partition = opts.partitionName ?? transport.getPartitionName();
      let cookies = cookieStores.get(partition);
      if (!cookies) {
        cookies = {};
        cookieStores.set(partition, cookies);
      }

      const headers = { ...opts.headers };
      const cookieHeader = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      if (cookieHeader) {
        headers.cookie = cookieHeader;
      }

      const res = await fakeServer.handleRequest({ ...opts, headers });
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const parts = setCookie.split(';');
        const [k, v] = parts[0].split('=');
        if (setCookie.includes('1970') || setCookie.includes('Max-Age=0')) {
          delete cookies[k.trim()];
        } else {
          cookies[k.trim()] = v ? v.trim() : '';
        }
      }
      return res;
    },
  });

  return transport;
}

export function createMockSender(id = 1) {
  return {
    id,
    isDestroyed: () => false,
  };
}
