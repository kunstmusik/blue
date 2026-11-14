import { createHash } from 'node:crypto';
import {
  readGraphEditorMetadata,
  restoreGraphEditorMetadata,
  type GraphEditorMetadata,
} from '../shared/project-editor/identity';
import {
  getHistoryNodeId,
  assignHistoryNodeId,
  isHistoryImmutableAtom,
} from '../shared/project-editor/history-node-identity';

type Atom =
  undefined | null | boolean | number | string | bigint | symbol | ((...args: never[]) => unknown);
type Value = Atom | { ref: number } | { immutable: object };
interface Field {
  value?: Value;
  writable?: boolean;
  enumerable?: boolean;
  configurable?: boolean;
  get?: () => unknown;
  set?: (value: unknown) => void;
}
const ARRAY_HOLE = Symbol('history-array-hole');
type Kind = 'object' | 'array' | 'map' | 'set' | 'date' | 'binary' | 'view' | 'regexp';
interface Node {
  id: number;
  prototype: object | null;
  kind: Kind;
  fields: Array<[PropertyKey, Field]>;
  content?: Value[];
  metadata: GraphEditorMetadata;
  frozen: boolean;
}
export interface TextSpan {
  start: number;
  before: string;
  after: string;
}
export interface TextChange {
  edits: TextSpan[];
  beforeHash: string;
  afterHash: string;
}
interface FieldChange {
  id: number;
  key: PropertyKey;
  before?: Field;
  after?: Field;
  text?: TextChange;
}
interface ValueSpan {
  start: number;
  before: Value[];
  after: Value[];
}
interface ArraySpan {
  edits: ValueSpan[];
  beforeLength: number;
  afterLength: number;
}
interface ContentChange {
  id: number;
  before?: Value[];
  after?: Value[];
  span?: ArraySpan;
}
interface MetadataChange {
  id: number;
  before: GraphEditorMetadata;
  after: GraphEditorMetadata;
}
export interface ProjectGraphDelta {
  rootId: number;
  fields: FieldChange[];
  contents: ContentChange[];
  metadata: MetadataChange[];
  beforeNodes: Node[];
  afterNodes: Node[];
}

function isReference(value: Value): value is { ref: number } {
  return value !== null && typeof value === 'object' && 'ref' in value;
}
function sameValue(a: Value, b: Value): boolean {
  if (isReference(a) && isReference(b)) return a.ref === b.ref;
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    'immutable' in a &&
    'immutable' in b
  ) {
    if (Object.getPrototypeOf(a.immutable) !== Object.getPrototypeOf(b.immutable)) return false;
    const keys = Reflect.ownKeys(a.immutable);
    return (
      keys.length === Reflect.ownKeys(b.immutable).length &&
      keys.every((key) => Object.is(Reflect.get(a.immutable, key), Reflect.get(b.immutable, key)))
    );
  }
  return Object.is(a, b);
}
function sameContent(a: Value[] | undefined, b: Value[] | undefined): boolean {
  return (
    a === b ||
    (!!a && !!b && a.length === b.length && a.every((value, i) => sameValue(value, b[i])))
  );
}
function sameField(a: Field | undefined, b: Field | undefined): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      sameValue(a.value, b.value) &&
      a.writable === b.writable &&
      a.enumerable === b.enumerable &&
      a.configurable === b.configurable &&
      a.get === b.get &&
      a.set === b.set)
  );
}
function sameMetadata(a: GraphEditorMetadata, b: GraphEditorMetadata): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function textHash(value: string): string {
  return createHash('sha256').update(value, 'utf16le').digest('hex');
}
function textSpans(before: string, after: string): TextSpan[] {
  const edits: TextSpan[] = [];
  // Copied spans must not keep a large V8 sliced-string parent alive.
  const owned = (value: string): string => Buffer.from(value, 'utf16le').toString('utf16le');
  const diff = (a: string, b: string, offset: number, depth: number): void => {
    let start = 0,
      end = 0;
    while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
    while (
      end < Math.min(a.length, b.length) - start &&
      a[a.length - end - 1] === b[b.length - end - 1]
    )
      end++;
    a = a.slice(start, a.length - end);
    b = b.slice(start, b.length - end);
    offset += start;
    if (!a.length && !b.length) return;
    if (a.length > 256 && b.length > 256 && depth < 32) {
      const middle = Math.floor(a.length / 2) - 32,
        anchor = a.slice(middle, middle + 64);
      let match = b.slice(middle, middle + 64) === anchor ? middle : -1;
      if (match < 0) {
        const expected = Math.floor((middle * b.length) / a.length);
        const local = b.slice(Math.max(0, expected - 256), expected + 320).indexOf(anchor);
        if (local >= 0) match = Math.max(0, expected - 256) + local;
      }
      if (match >= 0) {
        diff(a.slice(0, middle), b.slice(0, match), offset, depth + 1);
        diff(a.slice(middle + 64), b.slice(match + 64), offset + middle + 64, depth + 1);
        return;
      }
    }
    edits.push({ start: offset, before: owned(a), after: owned(b) });
  };
  diff(before, after, 0, 0);
  return edits;
}
export function createTextChange(before: string, after: string): TextChange | null {
  if (before.length + after.length <= 1024) return null;
  const edits = textSpans(before, after);
  if (
    edits.reduce((size, edit) => size + edit.before.length + edit.after.length + 64, 0) >=
    before.length + after.length - 256
  ) {
    return null;
  }
  return { edits, beforeHash: textHash(before), afterHash: textHash(after) };
}

export function estimateTextChangeBytes(change: TextChange): number {
  let bytes = 64 + (change.beforeHash.length + change.afterHash.length) * 2;
  for (const edit of change.edits) {
    bytes += 64 + (edit.before.length + edit.after.length) * 2;
  }
  return bytes;
}

function fieldChange(
  id: number,
  key: PropertyKey,
  before: Field | undefined,
  after: Field | undefined,
): FieldChange {
  const a = before?.value,
    b = after?.value;
  if (typeof a === 'string' && typeof b === 'string') {
    const text = createTextChange(a, b);
    if (text) {
      return {
        id,
        key,
        before: { ...before, value: undefined },
        after: { ...after, value: undefined },
        text,
      };
    }
  }
  return { id, key, before, after };
}
export function applyTextChange(
  value: unknown,
  change: TextChange,
  direction: 'before' | 'after',
): string {
  if (typeof value !== 'string') throw new Error('History text field changed type');
  const opposite = direction === 'before' ? 'after' : 'before';
  if (textHash(value) !== change[opposite === 'before' ? 'beforeHash' : 'afterHash'])
    throw new Error('History text preimage no longer matches');
  const parts: string[] = [];
  let cursor = 0,
    shift = 0;
  for (const edit of change.edits) {
    const start = edit.start + (direction === 'before' ? shift : 0);
    parts.push(value.slice(cursor, start), edit[direction]);
    cursor = start + edit[opposite].length;
    shift += edit.after.length - edit.before.length;
  }
  parts.push(value.slice(cursor));
  return parts.join('');
}

function snapshot(root: object): { nodes: Map<number, Node>; objects: Map<number, object> } {
  const nodes = new Map<number, Node>(),
    objects = new Map<number, object>();
  const encode = (value: unknown): Value => {
    if (value === null || typeof value !== 'object') return value as Atom;
    if (isHistoryImmutableAtom(value)) return { immutable: value };
    const id = getHistoryNodeId(value);
    if (objects.has(id)) {
      if (objects.get(id) !== value) throw new Error('Duplicate history graph identity');
      return { ref: id };
    }
    objects.set(id, value);
    const metadata = readGraphEditorMetadata(value);
    if (value instanceof WeakMap || value instanceof WeakSet || value instanceof Promise)
      throw new Error(`Unsupported runtime object in project history: ${value.constructor.name}`);
    let kind: Kind = Array.isArray(value) ? 'array' : 'object';
    let content: Value[] | undefined;
    if (Array.isArray(value)) {
      content = Array.from({ length: value.length }, (_, i) =>
        i in value ? encode(value[i]) : ARRAY_HOLE,
      );
    } else if (value instanceof Map) {
      kind = 'map';
      content = [...value].flatMap(([key, item]) => [encode(key), encode(item)]);
    } else if (value instanceof Set) {
      kind = 'set';
      content = [...value].map(encode);
    } else if (value instanceof Date) {
      kind = 'date';
      content = [value.getTime()];
    } else if (value instanceof RegExp) {
      kind = 'regexp';
      content = [value.source, value.flags];
    } else if (ArrayBuffer.isView(value)) {
      kind = 'view';
      content = [encode(value.buffer), value.byteOffset, value.byteLength];
    } else if (value instanceof ArrayBuffer) {
      kind = 'binary';
      content = [...new Uint8Array(value)];
    }
    const fields: Array<[PropertyKey, Field]> = [];
    for (const key of Reflect.ownKeys(value)) {
      if (kind === 'array' && (key === 'length' || (typeof key === 'string' && /^\d+$/.test(key))))
        continue;
      if ((kind === 'binary' || kind === 'view') && typeof key === 'string' && /^\d+$/.test(key))
        continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      fields.push([
        key,
        'value' in descriptor
          ? { ...descriptor, value: encode(descriptor.value) }
          : { ...descriptor },
      ]);
    }
    nodes.set(id, {
      id,
      prototype: Object.getPrototypeOf(value),
      kind,
      fields,
      content,
      metadata,
      frozen: Object.isFrozen(value),
    });
    return { ref: id };
  };
  encode(root);
  return { nodes, objects };
}

function contentChange(
  id: number,
  before: Value[] | undefined,
  after: Value[] | undefined,
  sequence: boolean,
): ContentChange {
  if (!sequence || !before || !after) return { id, before, after };
  const edits: ValueSpan[] = [];
  const diff = (a: Value[], b: Value[], offset: number, depth: number): void => {
    let start = 0,
      end = 0;
    while (start < Math.min(a.length, b.length) && sameValue(a[start], b[start])) start++;
    while (
      end < Math.min(a.length, b.length) - start &&
      sameValue(a[a.length - end - 1], b[b.length - end - 1])
    )
      end++;
    a = a.slice(start, a.length - end);
    b = b.slice(start, b.length - end);
    offset += start;
    if (!a.length && !b.length) return;
    if (a.length && b.length && depth < 32) {
      for (const middle of [...new Set([Math.floor(a.length / 2), 0, a.length - 1])]) {
        const expected = Math.min(b.length - 1, Math.floor((middle * b.length) / a.length));
        let match = sameValue(a[middle], b[expected])
          ? expected
          : b.findIndex((value) => sameValue(value, a[middle]));
        if (match >= 0) {
          diff(a.slice(0, middle), b.slice(0, match), offset, depth + 1);
          diff(a.slice(middle + 1), b.slice(match + 1), offset + middle + 1, depth + 1);
          return;
        }
      }
    }
    edits.push({ start: offset, before: a, after: b });
  };
  diff(before, after, 0, 0);
  return { id, span: { edits, beforeLength: before.length, afterLength: after.length } };
}
function applyArraySpan(
  values: Value[] | undefined,
  span: ArraySpan,
  direction: 'before' | 'after',
): Value[] {
  const opposite = direction === 'before' ? 'after' : 'before';
  if (!values || values.length !== span[opposite === 'before' ? 'beforeLength' : 'afterLength'])
    throw new Error('History collection preimage no longer matches');
  const result: Value[] = [];
  let cursor = 0,
    shift = 0;
  for (const edit of span.edits) {
    const start = edit.start + (direction === 'before' ? shift : 0);
    if (!sameContent(values.slice(start, start + edit[opposite].length), edit[opposite]))
      throw new Error('History collection preimage no longer matches');
    for (let i = cursor; i < start; i++) result.push(values[i]);
    for (const value of edit[direction]) result.push(value);
    cursor = start + edit[opposite].length;
    shift += edit.after.length - edit.before.length;
  }
  for (let i = cursor; i < values.length; i++) result.push(values[i]);
  return result;
}

/** Match replacement implementation containers, without conflating authored/editor identities. */
function alignReplacementNodes(
  before: ReturnType<typeof snapshot>,
  after: ReturnType<typeof snapshot>,
): void {
  const paired = new Set<number>(),
    claimed = new Set<number>(),
    claimedTargets = new Set<object>();
  const remapped = new Map<number, number>();
  const plain = (node: Node): boolean =>
    !node.frozen &&
    node.metadata.ids.every((id) => id === undefined) &&
    !node.metadata.markers &&
    !node.metadata.clojureEntries &&
    !node.fields.some(([key]) => key === 'id' || key === 'uniqueId' || key === '_uniqueId');
  const match = (left: Value, right: Value): boolean => {
    if (sameValue(left, right)) return true;
    if (!isReference(left) || !isReference(right)) return false;
    const a = before.nodes.get(left.ref),
      b = after.nodes.get(right.ref);
    if (
      !a ||
      !b ||
      !plain(a) ||
      !plain(b) ||
      a.prototype !== b.prototype ||
      a.fields.length !== b.fields.length ||
      a.content ||
      b.content
    )
      return false;
    const fields = new Map(b.fields);
    return a.fields.every(([key, field]) => sameField(field, fields.get(key)));
  };
  const pair = (left: Value, right: Value): void => {
    if (!isReference(left) || !isReference(right) || paired.has(left.ref)) return;
    const a = before.nodes.get(left.ref),
      b = after.nodes.get(right.ref);
    if (!a || !b || a.prototype !== b.prototype) return;
    if (left.ref !== right.ref) {
      if (
        after.nodes.has(left.ref) ||
        before.nodes.has(right.ref) ||
        claimed.has(left.ref) ||
        claimedTargets.has(after.objects.get(right.ref)!) ||
        !plain(a) ||
        !plain(b)
      )
        return;
      assignHistoryNodeId(after.objects.get(right.ref)!, left.ref);
      remapped.set(right.ref, left.ref);
      claimed.add(left.ref);
      claimedTargets.add(after.objects.get(right.ref)!);
    }
    paired.add(left.ref);
    const fields = new Map(b.fields);
    for (const [key, field] of a.fields) {
      const other = fields.get(key);
      if (other) pair(field.value, other.value);
    }
    if (a.kind === 'array' && a.content && b.content) {
      const old = a.content,
        next = b.content;
      let start = 0,
        end = 0;
      while (start < Math.min(old.length, next.length) && match(old[start], next[start])) {
        pair(old[start], next[start]);
        start++;
      }
      while (
        end < Math.min(old.length, next.length) - start &&
        match(old[old.length - end - 1], next[next.length - end - 1])
      ) {
        pair(old[old.length - end - 1], next[next.length - end - 1]);
        end++;
      }
      if (old.length === next.length)
        for (let i = start; i < old.length - end; i++) pair(old[i], next[i]);
    } else if (a.content && b.content && a.content.length === b.content.length)
      for (let i = 0; i < a.content.length; i++) pair(a.content[i], b.content[i]);
  };
  // Roots are captured last in a postorder walk; use the shared root identity supplied by the caller instead.
  for (const [id] of before.nodes) if (after.nodes.has(id)) pair({ ref: id }, { ref: id });
  if (remapped.size === 0) return;
  const remap = (value: Value): Value =>
    isReference(value) && remapped.has(value.ref) ? { ref: remapped.get(value.ref)! } : value;
  // Rewrite captured references after pairing; revisiting the live graph is unnecessary.
  after.nodes = new Map(
    [...after.nodes.values()].map((node) => {
      node.id = remapped.get(node.id) ?? node.id;
      node.fields = node.fields.map(([key, field]) =>
        isReference(field.value) ? [key, { ...field, value: remap(field.value) }] : [key, field],
      );
      if (node.content) node.content = node.content.map(remap);
      return [node.id, node];
    }),
  );
  after.objects = new Map([...after.objects].map(([id, value]) => [remapped.get(id) ?? id, value]));
}

/** Isolated deltas contain no live model instances or complete root snapshots. */
export function captureProjectGraphDelta(before: object, after: object): ProjectGraphDelta {
  const oldSnapshot = snapshot(before),
    afterSnapshot = snapshot(after);
  alignReplacementNodes(oldSnapshot, afterSnapshot);
  const old = oldSnapshot.nodes,
    next = afterSnapshot.nodes;
  const rootId = getHistoryNodeId(before);
  if (rootId !== getHistoryNodeId(after))
    throw new Error('History graph copies must transfer identities before mutation');
  const delta: ProjectGraphDelta = {
    rootId,
    fields: [],
    contents: [],
    metadata: [],
    beforeNodes: [],
    afterNodes: [],
  };
  for (const [id, node] of old) {
    const other = next.get(id);
    if (!other) {
      delta.beforeNodes.push(node);
      continue;
    }
    if (node.prototype !== other.prototype || node.kind !== other.kind)
      throw new Error('History node prototype changed in place');
    const left = new Map(node.fields),
      right = new Map(other.fields);
    for (const key of new Set([...left.keys(), ...right.keys()]))
      if (!sameField(left.get(key), right.get(key)))
        delta.fields.push(fieldChange(id, key, left.get(key), right.get(key)));
    if (!sameContent(node.content, other.content))
      delta.contents.push(
        contentChange(
          id,
          node.content,
          other.content,
          node.kind === 'array' ||
            node.kind === 'map' ||
            node.kind === 'set' ||
            node.kind === 'binary',
        ),
      );
    if (!sameMetadata(node.metadata, other.metadata))
      delta.metadata.push({ id, before: node.metadata, after: other.metadata });
  }
  for (const [id, node] of next) if (!old.has(id)) delta.afterNodes.push(node);
  return pruneProjectGraphDelta(delta);
}

function fieldRefs(field: Field | undefined): number[] {
  return field && isReference(field.value) ? [field.value.ref] : [];
}
function nodeRefs(node: Node): number[] {
  return [
    ...node.fields.flatMap(([, field]) => fieldRefs(field)),
    ...(node.content ?? []).flatMap((v) => (isReference(v) ? [v.ref] : [])),
  ];
}
function pruneProjectGraphDelta(delta: ProjectGraphDelta): ProjectGraphDelta {
  const fields = delta.fields.filter((change) =>
    change.text
      ? change.text.beforeHash !== change.text.afterHash
      : !sameField(change.before, change.after),
  );
  const contents = delta.contents.filter((change) =>
    change.span
      ? change.span.edits.some((edit) => !sameContent(edit.before, edit.after))
      : !sameContent(change.before, change.after),
  );
  const metadata = delta.metadata.filter((change) => !sameMetadata(change.before, change.after));
  const nodes = new Map([...delta.beforeNodes, ...delta.afterNodes].map((node) => [node.id, node]));
  const required = new Set<number>();
  const visit = (id: number): void => {
    if (required.has(id)) return;
    required.add(id);
    const node = nodes.get(id);
    if (node) nodeRefs(node).forEach(visit);
  };
  fields.forEach((c) => [...fieldRefs(c.before), ...fieldRefs(c.after), c.id].forEach(visit));
  contents.forEach((c) => {
    visit(c.id);
    [
      ...(c.span?.edits.flatMap((edit) => edit.before) ?? c.before ?? []),
      ...(c.span?.edits.flatMap((edit) => edit.after) ?? c.after ?? []),
    ].forEach((v) => {
      if (isReference(v)) visit(v.ref);
    });
  });
  metadata.forEach((c) => visit(c.id));
  return {
    ...delta,
    fields,
    contents,
    metadata,
    beforeNodes: delta.beforeNodes.filter((n) => required.has(n.id)),
    afterNodes: delta.afterNodes.filter((n) => required.has(n.id)),
  };
}

export function mergeProjectGraphDeltas(
  before: ProjectGraphDelta,
  after: ProjectGraphDelta,
  finalRoot?: object | (() => object),
): ProjectGraphDelta {
  if (before.rootId !== after.rootId) throw new Error('Cannot group different history graphs');
  const fieldMap = new Map<number, Map<PropertyKey, FieldChange>>();
  let finalObjects: Map<number, object> | undefined;
  let finalSnapshot: ReturnType<typeof snapshot> | undefined;
  const endpoint = (): ReturnType<typeof snapshot> => {
    if (!finalRoot) throw new Error('Grouped container edits require their detached endpoint');
    return (finalSnapshot ??= snapshot(typeof finalRoot === 'function' ? finalRoot() : finalRoot));
  };
  for (const change of [...before.fields, ...after.fields]) {
    let fields = fieldMap.get(change.id);
    if (!fields) {
      fields = new Map();
      fieldMap.set(change.id, fields);
    }
    const prior = fields.get(change.key);
    if (prior && (prior.text || change.text)) {
      if (!finalRoot) throw new Error('Grouped text edits require the final detached endpoint');
      finalObjects ??= endpoint().objects;
      const value = Object.getOwnPropertyDescriptor(
        finalObjects.get(change.id)!,
        change.key,
      )?.value;
      const intermediate = change.text
        ? applyTextChange(value, change.text, 'before')
        : change.before?.value;
      const original = prior.text
        ? applyTextChange(intermediate, prior.text, 'before')
        : prior.before?.value;
      fields.set(
        change.key,
        fieldChange(
          change.id,
          change.key,
          { ...prior.before, value: original as Value },
          { ...change.after, value: value as Value },
        ),
      );
    } else fields.set(change.key, prior ? { ...change, before: prior.before } : change);
  }
  const merge = <T extends { id: number; before?: unknown; after?: unknown }>(
    a: T[],
    b: T[],
  ): T[] => {
    const items = new Map(a.map((c) => [c.id, c]));
    for (const c of b) {
      const prior = items.get(c.id);
      items.set(c.id, { ...c, before: prior ? prior.before : c.before });
    }
    return [...items.values()];
  };
  const contentMap = new Map(before.contents.map((change) => [change.id, change]));
  for (const change of after.contents) {
    const prior = contentMap.get(change.id);
    if (prior && (prior.span || change.span)) {
      if (!finalRoot) throw new Error('Grouped array edits require the final detached endpoint');
      const final = endpoint().nodes.get(change.id)?.content;
      const intermediate = change.span
        ? applyArraySpan(final, change.span, 'before')
        : change.before;
      const original = prior.span
        ? applyArraySpan(intermediate, prior.span, 'before')
        : prior.before;
      contentMap.set(change.id, contentChange(change.id, original, final, true));
    } else contentMap.set(change.id, prior ? { ...change, before: prior.before } : change);
  }
  const oldNodes = new Map(before.beforeNodes.map((n) => [n.id, n])),
    newNodes = new Map(before.afterNodes.map((n) => [n.id, n]));
  // Fold edits to nodes created within the group into their isolated blueprints.
  const editBlueprints = (
    nodes: Map<number, Node>,
    delta: ProjectGraphDelta,
    direction: 'before' | 'after',
  ): void => {
    for (const c of delta.fields) {
      const n = nodes.get(c.id);
      if (!n) continue;
      const fields = new Map(n.fields);
      let field = c[direction];
      if (field && c.text)
        field = { ...field, value: applyTextChange(fields.get(c.key)?.value, c.text, direction) };
      if (field) fields.set(c.key, field);
      else fields.delete(c.key);
      nodes.set(c.id, { ...n, fields: [...fields] });
    }
    for (const c of delta.contents) {
      const n = nodes.get(c.id);
      if (n)
        nodes.set(c.id, {
          ...n,
          content: c.span ? applyArraySpan(n.content, c.span, direction) : c[direction],
        });
    }
    for (const c of delta.metadata) {
      const n = nodes.get(c.id);
      if (n) nodes.set(c.id, { ...n, metadata: c[direction] });
    }
  };
  editBlueprints(newNodes, after, 'after');
  for (const node of after.beforeNodes)
    if (newNodes.has(node.id)) newNodes.delete(node.id);
    else if (!oldNodes.has(node.id)) oldNodes.set(node.id, node);
  for (const node of after.afterNodes) {
    if (oldNodes.has(node.id)) oldNodes.delete(node.id);
    else newNodes.set(node.id, node);
  }
  // A node removed later may already have changed earlier in the group.
  editBlueprints(oldNodes, before, 'before');
  const introduced = new Set(before.afterNodes.map((n) => n.id)),
    removed = new Set(after.beforeNodes.map((n) => n.id));
  return pruneProjectGraphDelta({
    rootId: before.rootId,
    fields: [...fieldMap.values()]
      .flatMap((m) => [...m.values()])
      .filter((c) => !introduced.has(c.id) && !removed.has(c.id)),
    contents: [...contentMap.values()].filter((c) => !introduced.has(c.id) && !removed.has(c.id)),
    metadata: merge(before.metadata, after.metadata).filter(
      (c) => !introduced.has(c.id) && !removed.has(c.id),
    ),
    beforeNodes: [...oldNodes.values()],
    afterNodes: [...newNodes.values()],
  });
}

function allocate(node: Node, objects: Map<number, object>): object {
  let value: object;
  if (node.kind === 'array') value = [];
  else if (node.kind === 'map') value = new Map();
  else if (node.kind === 'set') value = new Set();
  else if (node.kind === 'date') value = new Date(node.content?.[0] as number);
  else if (node.kind === 'regexp')
    value = new RegExp(node.content?.[0] as string, node.content?.[1] as string);
  else if (node.kind === 'view') {
    const reference = node.content?.[0];
    if (!reference || !isReference(reference)) throw new Error('Invalid history view buffer');
    const buffer = objects.get(reference.ref);
    if (!(buffer instanceof ArrayBuffer)) throw new Error('History view buffer no longer exists');
    const offset = node.content?.[1] as number,
      length = node.content?.[2] as number;
    const ctor = node.prototype?.constructor as unknown as {
      new (buffer: ArrayBuffer, offset: number, length: number): object;
      BYTES_PER_ELEMENT?: number;
    };
    value =
      ctor === DataView
        ? new DataView(buffer, offset, length)
        : new ctor(buffer, offset, length / (ctor.BYTES_PER_ELEMENT ?? 1));
  } else if (node.kind === 'binary') {
    const buffer = new Uint8Array(node.content as number[]).buffer;
    const ctor = node.prototype?.constructor;
    value =
      ctor === ArrayBuffer
        ? buffer
        : ctor === DataView
          ? new DataView(buffer)
          : new (ctor as unknown as { new (buffer: ArrayBuffer): object })(buffer);
  } else value = Object.create(node.prototype) as object;
  if (Object.getPrototypeOf(value) !== node.prototype) Object.setPrototypeOf(value, node.prototype);
  assignHistoryNodeId(value, node.id);
  return value;
}

/** Validate and materialize everything before the first canonical write; rollback on unexpected failure. */
export function applyProjectGraphDelta(
  root: object,
  delta: ProjectGraphDelta,
  direction: 'before' | 'after',
): void {
  if (getHistoryNodeId(root) !== delta.rootId) throw new Error('History graph owner changed');
  const { objects, nodes: liveNodes } = snapshot(root);
  const nodes = direction === 'before' ? delta.beforeNodes : delta.afterNodes;
  const fresh = new Set<number>();
  for (const kind of ['ordinary', 'view'])
    for (const node of nodes)
      if ((node.kind === 'view') === (kind === 'view') && !objects.has(node.id)) {
        objects.set(node.id, allocate(node, objects));
        fresh.add(node.id);
      }
  const decode = (value: Value): unknown => {
    if (!isReference(value))
      return value && typeof value === 'object' && 'immutable' in value ? value.immutable : value;
    const target = objects.get(value.ref);
    if (!target) throw new Error(`History reference ${value.ref} no longer exists`);
    return target;
  };
  const descriptor = (field: Field): PropertyDescriptor =>
    'value' in field ? { ...field, value: decode(field.value) } : field;
  const writeContent = (target: object, values: Value[] | undefined): void => {
    if (Array.isArray(target)) {
      target.length = values?.length ?? 0;
      values?.forEach((value, index) => {
        if (value === ARRAY_HOLE) Reflect.deleteProperty(target, String(index));
        else target[index] = decode(value);
      });
    } else if (target instanceof Map) {
      target.clear();
      for (let i = 0; i < (values?.length ?? 0); i += 2)
        target.set(decode(values![i]), decode(values![i + 1]));
    } else if (target instanceof Set) {
      target.clear();
      values?.forEach((value) => target.add(decode(value)));
    } else if (target instanceof Date) target.setTime(values?.[0] as number);
    else if (target instanceof ArrayBuffer) new Uint8Array(target).set(values as number[]);
    else if (ArrayBuffer.isView(target))
      new Uint8Array(target.buffer, target.byteOffset, target.byteLength).set(values as number[]);
    else throw new Error('History collection kind changed');
  };
  for (const node of nodes)
    if (fresh.has(node.id)) {
      const target = objects.get(node.id)!;
      for (const [key, field] of node.fields) Object.defineProperty(target, key, descriptor(field));
      if (node.kind === 'array' || node.kind === 'map' || node.kind === 'set')
        writeContent(target, node.content);
      restoreGraphEditorMetadata(target, node.metadata);
      if (node.frozen) Object.freeze(target);
    }
  const edits = delta.fields.map((change) => {
    const target = objects.get(change.id);
    if (!target) throw new Error(`History field owner ${change.id} no longer exists`);
    const desired = change[direction];
    const current = Object.getOwnPropertyDescriptor(target, change.key);
    const currentField = new Map(liveNodes.get(change.id)?.fields).get(change.key);
    if (
      !change.text &&
      !sameField(currentField, change[direction === 'before' ? 'after' : 'before'])
    )
      throw new Error('History field preimage no longer matches');
    if (!current && !Object.isExtensible(target))
      throw new Error('History target is no longer extensible');
    if (current?.configurable === false && !(current.writable && desired && 'value' in desired))
      throw new Error('History field is no longer writable');
    return {
      target,
      key: change.key,
      desired: desired
        ? descriptor(
            change.text
              ? { ...desired, value: applyTextChange(current?.value, change.text, direction) }
              : desired,
          )
        : undefined,
      current,
    };
  });
  const collections = delta.contents.map((change) => {
    const target = objects.get(change.id);
    if (!target) throw new Error('History collection no longer exists');
    const previous = liveNodes.get(change.id)?.content;
    const values = change.span
      ? applyArraySpan(previous, change.span, direction)
      : change[direction];
    for (const value of values ?? []) decode(value);
    if (Array.isArray(target)) {
      if (Object.isFrozen(target)) throw new Error('History collection is no longer writable');
      if (
        values?.length !== target.length &&
        !Object.getOwnPropertyDescriptor(target, 'length')?.writable
      )
        throw new Error('History array length is no longer writable');
      for (let index = 0; index < Math.max(target.length, values?.length ?? 0); index++) {
        const current = Object.getOwnPropertyDescriptor(target, String(index));
        const next = values?.[index];
        if (index >= (values?.length ?? 0) || next === ARRAY_HOLE) {
          if (current?.configurable === false)
            throw new Error('History array element is no longer removable');
        } else if (
          (!current && !Object.isExtensible(target)) ||
          (current &&
            (!('value' in current) ||
              (!current.writable && !Object.is(current.value, decode(next)))))
        )
          throw new Error('History array element is no longer writable');
      }
    } else if (!(
      target instanceof Map ||
      target instanceof Set ||
      target instanceof Date ||
      target instanceof ArrayBuffer ||
      ArrayBuffer.isView(target)
    ))
      throw new Error('History collection kind changed');
    if (
      (target instanceof ArrayBuffer || ArrayBuffer.isView(target)) &&
      values?.length !== target.byteLength
    )
      throw new Error('History binary length changed');
    return { target, values, previous };
  });
  const meta = delta.metadata.map((change) => {
    const target = objects.get(change.id);
    if (!target) throw new Error('History metadata owner no longer exists');
    return { target, desired: change[direction], previous: readGraphEditorMetadata(target) };
  });
  // Length changes are applied last so shrinking arrays cannot erase an earlier field preimage.
  edits.sort((a, b) => Number(a.key === 'length') - Number(b.key === 'length'));
  const applied: typeof edits = [];
  try {
    for (const edit of edits) {
      applied.push(edit);
      if (edit.desired) Object.defineProperty(edit.target, edit.key, edit.desired);
      else if (!Reflect.deleteProperty(edit.target, edit.key))
        throw new Error('History field deletion failed');
    }
    for (const collection of collections) writeContent(collection.target, collection.values);
    for (const entry of meta) restoreGraphEditorMetadata(entry.target, entry.desired);
  } catch (error) {
    for (const collection of collections) writeContent(collection.target, collection.previous);
    for (const entry of meta) restoreGraphEditorMetadata(entry.target, entry.previous);
    for (const edit of applied.reverse()) {
      if (edit.current) Object.defineProperty(edit.target, edit.key, edit.current);
      else Reflect.deleteProperty(edit.target, edit.key);
    }
    throw error;
  }
}

export function isNetZeroProjectGraphDelta(delta: ProjectGraphDelta): boolean {
  if (delta.metadata.some((change) => !sameMetadata(change.before, change.after))) return false;
  const beforeNodes = new Map(delta.beforeNodes.map((node) => [node.id, node])),
    afterNodes = new Map(delta.afterNodes.map((node) => [node.id, node]));
  const forward = new Map<number, number>(),
    reverse = new Map<number, number>();
  const equivalent = (left: Value, right: Value): boolean => {
    if (!isReference(left) || !isReference(right)) return sameValue(left, right);
    const known = forward.get(left.ref),
      back = reverse.get(right.ref);
    if (known !== undefined || back !== undefined) return known === right.ref && back === left.ref;
    forward.set(left.ref, right.ref);
    reverse.set(right.ref, left.ref);
    if (left.ref === right.ref) return true;
    const a = beforeNodes.get(left.ref),
      b = afterNodes.get(right.ref);
    if (
      !a ||
      !b ||
      a.prototype !== b.prototype ||
      a.kind !== b.kind ||
      !sameMetadata(a.metadata, b.metadata) ||
      a.fields.length !== b.fields.length
    )
      return false;
    const fields = new Map(b.fields);
    return (
      a.fields.every(([key, field]) => equivalentField(field, fields.get(key))) &&
      equivalentContent(a.content, b.content)
    );
  };
  const equivalentField = (a: Field | undefined, b: Field | undefined): boolean =>
    a === b ||
    (!!a &&
      !!b &&
      a.writable === b.writable &&
      a.enumerable === b.enumerable &&
      a.configurable === b.configurable &&
      a.get === b.get &&
      a.set === b.set &&
      equivalent(a.value, b.value));
  const equivalentContent = (a: Value[] | undefined, b: Value[] | undefined): boolean =>
    a === b ||
    (!!a && !!b && a.length === b.length && a.every((value, index) => equivalent(value, b[index])));
  return (
    delta.fields.every((change) =>
      change.text
        ? change.text.beforeHash === change.text.afterHash
        : equivalentField(change.before, change.after),
    ) &&
    delta.contents.every((change) =>
      change.span
        ? change.span.edits.every((edit) => equivalentContent(edit.before, edit.after))
        : equivalentContent(change.before, change.after),
    )
  );
}
export function estimateProjectGraphDeltaBytes(delta: ProjectGraphDelta): number {
  const seen = new Set<object>();
  const bytes = (value: unknown): number => {
    if (typeof value === 'string') return 16 + value.length * 2;
    if (typeof value === 'bigint') return 16 + value.toString().length * 2;
    if (value === null || typeof value !== 'object') return 16;
    if (seen.has(value)) return 0;
    seen.add(value);
    if (Array.isArray(value)) return 32 + value.reduce((total, item) => total + bytes(item), 0);
    return (
      48 +
      Object.entries(value).reduce(
        (total, [key, item]) => total + key.length * 2 + (key === 'prototype' ? 64 : bytes(item)),
        0,
      )
    );
  };
  return 256 + bytes(delta);
}
