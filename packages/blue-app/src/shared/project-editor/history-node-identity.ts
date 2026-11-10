// App-only identities for model graph nodes; never serialized in project XML or IPC.
const NODE_IDS = new WeakMap<object, number>();
let nextNodeId = 1;

/** Immutable value objects (not mutable native containers) may be shared by model copies. */
export function isHistoryImmutableAtom(value: object): boolean {
  if (
    !Object.isFrozen(value) ||
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  )
    return false;
  return (
    !['_uniqueId', 'uniqueId', 'id'].some((key) => Object.hasOwn(value, key)) &&
    Reflect.ownKeys(value).every((key) => {
      const field = Object.getOwnPropertyDescriptor(value, key);
      return (
        field &&
        'value' in field &&
        (field.value === null ||
          (typeof field.value !== 'object' && typeof field.value !== 'function'))
      );
    })
  );
}

export function getHistoryNodeId(value: object): number {
  let id = NODE_IDS.get(value);
  if (id === undefined) {
    id = nextNodeId++;
    NODE_IDS.set(value, id);
  }
  return id;
}

export function assignHistoryNodeId(value: object, id: number): void {
  NODE_IDS.set(value, id);
}

export function transferHistoryNodeIds(
  source: object,
  target: object,
  onPair: (source: object, target: object) => void,
): void {
  const seen = new Set<object>();
  const sourceNodes = new Set<object>();
  const targets = new Map<object, object>();
  const collect = (value: unknown): void => {
    if (
      value === null ||
      typeof value !== 'object' ||
      isHistoryImmutableAtom(value) ||
      sourceNodes.has(value)
    )
      return;
    sourceNodes.add(value);
    getHistoryNodeId(value);
    if (ArrayBuffer.isView(value)) collect(value.buffer);
    if (value instanceof Map)
      for (const [key, item] of value) {
        collect(key);
        collect(item);
      }
    else if (value instanceof Set) for (const item of value) collect(item);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor) collect(descriptor.value);
    }
  };
  collect(source);
  const identity = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return undefined;
    for (const key of ['_uniqueId', 'uniqueId', 'id']) {
      const member = Reflect.get(value, key);
      if (typeof member === 'string' && member) return member;
    }
    return undefined;
  };
  const pair = (a: unknown, b: unknown): void => {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || seen.has(a))
      return;
    if (
      Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) ||
      isHistoryImmutableAtom(a) ||
      isHistoryImmutableAtom(b)
    )
      return;
    const leftId = identity(a),
      rightId = identity(b);
    if (leftId !== undefined && rightId !== undefined && leftId !== rightId) return;
    seen.add(a);
    // Some model copies share/intern immutable decimal values. Never relabel a source
    // object or give two detached objects the same ID when a copy splits an alias.
    if ((!sourceNodes.has(b) || a === b) && !targets.has(b)) {
      assignHistoryNodeId(b, getHistoryNodeId(a));
      targets.set(b, a);
    }
    onPair(a, b);
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) pair(a.buffer, b.buffer);
    if (a instanceof Map && b instanceof Map) {
      const left = [...a.entries()],
        right = [...b.entries()];
      left.forEach(([key, value], i) => {
        if (key === null || typeof key !== 'object') {
          if (b.has(key)) pair(value, b.get(key));
        } else if (right[i]) {
          pair(key, right[i]![0]);
          pair(value, right[i]![1]);
        }
      });
    } else if (a instanceof Set && b instanceof Set) {
      const right = [...b];
      [...a].forEach((value, i) => pair(value, right[i]));
    }
    if (Array.isArray(a) && Array.isArray(b))
      for (let i = 0; i < a.length; i++) {
        const id = identity(a[i]);
        pair(a[i], id === undefined ? b[i] : b.find((item) => identity(item) === id));
      }
    for (const key of Reflect.ownKeys(a)) {
      if (Array.isArray(a) && typeof key === 'string' && /^\d+$/.test(key)) continue;
      const left = Object.getOwnPropertyDescriptor(a, key),
        right = Object.getOwnPropertyDescriptor(b, key);
      if (left && right && 'value' in left && 'value' in right) pair(left.value, right.value);
    }
  };
  pair(source, target);
}
