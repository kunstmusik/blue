/**
 * BlueShare 3.0 shared contracts, types, channel constants, and runtime guards.
 * Platform-neutral and serializable across IPC boundaries.
 */

import type { LibraryMutationReceipt } from './unified-library';
import type { XmlDiagnostic } from '@blue/data';
import { Element } from '@blue/data';

export const RESOURCE_KINDS = ['instrument', 'effect', 'soundObject'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && (RESOURCE_KINDS as readonly string[]).includes(value);
}

export interface ResourceKey {
  readonly kind: ResourceKind;
  readonly id: number;
}

export function isResourceKey(value: unknown): value is ResourceKey {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).every((k) => ['kind', 'id'].includes(k)) &&
    isResourceKind(candidate.kind) &&
    typeof candidate.id === 'number' &&
    Number.isInteger(candidate.id) &&
    candidate.id >= 1 &&
    candidate.id <= 2147483647
  );
}

export interface Category {
  readonly id: number;
  readonly kind: ResourceKind;
  readonly parentId: number | null;
  readonly name: string;
  readonly description: string | null;
  readonly level?: number;
}

export function isCategory(value: unknown, expectedKind?: ResourceKind): value is Category {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (!isResourceKind(c.kind)) return false;
  if (expectedKind && c.kind !== expectedKind) return false;
  if (typeof c.id !== 'number' || !Number.isInteger(c.id) || c.id < 1 || c.id > 2147483647)
    return false;
  if (
    c.parentId !== null &&
    (typeof c.parentId !== 'number' ||
      !Number.isInteger(c.parentId) ||
      c.parentId < 1 ||
      c.parentId > 2147483647)
  ) {
    return false;
  }
  if (typeof c.name !== 'string' || c.name.trim().length === 0) return false;
  if (c.description !== null && typeof c.description !== 'string') return false;
  if (
    c.level !== undefined &&
    (typeof c.level !== 'number' || !Number.isInteger(c.level) || c.level < 0)
  ) {
    return false;
  }
  return true;
}

export interface CategoryTreeNode extends Category {
  readonly level: number;
  readonly children: readonly CategoryTreeNode[];
}

export interface CategoryHierarchyValidationError {
  readonly code:
    'duplicate_category_id' | 'orphan_category' | 'category_cycle' | 'invalid_category_item';
  readonly message: string;
}

export function validateCategoryHierarchy(
  categories: readonly Category[],
  expectedKind?: ResourceKind,
):
  | {
      readonly ok: true;
      readonly tree: readonly CategoryTreeNode[];
      readonly flattened: readonly (Category & { readonly level: number })[];
    }
  | {
      readonly ok: false;
      readonly error: CategoryHierarchyValidationError;
    } {
  const catMap = new Map<number, Category>();

  // 1. Check valid category items and duplicate IDs
  for (const cat of categories) {
    if (!isCategory(cat, expectedKind)) {
      return {
        ok: false,
        error: {
          code: 'invalid_category_item',
          message: `Invalid category item with id: ${(cat as any)?.id}`,
        },
      };
    }
    if (catMap.has(cat.id)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_category_id',
          message: `Duplicate category ID detected: ${cat.id}`,
        },
      };
    }
    catMap.set(cat.id, cat);
  }

  // 2. Check for orphans and self-cycles
  for (const cat of categories) {
    if (cat.parentId !== null) {
      if (cat.parentId === cat.id) {
        return {
          ok: false,
          error: {
            code: 'category_cycle',
            message: `Self-referencing cycle detected in category ID: ${cat.id}`,
          },
        };
      }
      if (!catMap.has(cat.parentId)) {
        return {
          ok: false,
          error: {
            code: 'orphan_category',
            message: `Category ${cat.id} references non-existent parent ID: ${cat.parentId}`,
          },
        };
      }
    }
  }

  // 3. Check for multi-node cycles
  for (const cat of categories) {
    const visited = new Set<number>([cat.id]);
    let curr = cat.parentId;
    while (curr !== null) {
      if (visited.has(curr)) {
        return {
          ok: false,
          error: {
            code: 'category_cycle',
            message: `Cycle detected in category hierarchy involving ID: ${curr}`,
          },
        };
      }
      visited.add(curr);
      curr = catMap.get(curr)?.parentId ?? null;
    }
  }

  // 4. Build tree preserving ID order among siblings
  const childrenMap = new Map<number | null, Category[]>();
  for (const cat of categories) {
    const list = childrenMap.get(cat.parentId) ?? [];
    list.push(cat);
    childrenMap.set(cat.parentId, list);
  }

  // Sort siblings by id ascending
  for (const list of childrenMap.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  function buildSubtree(parentId: number | null, level: number): CategoryTreeNode[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((c) => ({
      ...c,
      level,
      children: buildSubtree(c.id, level + 1),
    }));
  }

  const tree = buildSubtree(null, 0);

  // Flattened tree in pre-order traversal with level
  const flattened: (Category & { readonly level: number })[] = [];
  function traverse(nodes: readonly CategoryTreeNode[]): void {
    for (const node of nodes) {
      flattened.push({
        id: node.id,
        kind: node.kind,
        parentId: node.parentId,
        name: node.name,
        description: node.description,
        level: node.level,
      });
      traverse(node.children);
    }
  }
  traverse(tree);

  return { ok: true, tree, flattened };
}

export function buildCategoryTree(
  categories: readonly Category[],
  expectedKind?: ResourceKind,
): readonly CategoryTreeNode[] {
  const result = validateCategoryHierarchy(categories, expectedKind);
  return result.ok ? result.tree : [];
}

export function flattenCategoryHierarchy(
  categories: readonly Category[],
  expectedKind?: ResourceKind,
): readonly (Category & { readonly level: number })[] {
  const result = validateCategoryHierarchy(categories, expectedKind);
  return result.ok ? result.flattened : [];
}

export interface SyntheticNavigationNode {
  readonly isSynthetic: true;
  readonly syntheticId: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly count?: number;
}

export function isSyntheticNavigationNode(value: unknown): value is SyntheticNavigationNode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.isSynthetic === true &&
    typeof candidate.syntheticId === 'string' &&
    typeof candidate.name === 'string' &&
    isResourceKind(candidate.kind)
  );
}

export interface AccountIdentity {
  readonly id: string;
  readonly name: string;
  readonly username: string;
}

export function isAccountIdentity(value: unknown): value is AccountIdentity {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    Object.keys(c).every((k) => ['id', 'name', 'username'].includes(k)) &&
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    c.id.length <= 256 &&
    typeof c.name === 'string' &&
    c.name.length > 0 &&
    c.name.length <= 1000 &&
    typeof c.username === 'string' &&
    c.username.length > 0 &&
    c.username.length <= 256 &&
    !('email' in c) &&
    !('password' in c) &&
    !('cookie' in c) &&
    !('token' in c)
  );
}

export const ACCOUNT_STATES = [
  'signedOut',
  'signingIn',
  'signedIn',
  'signingOut',
  'unavailable',
] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

export function isAccountState(value: unknown): value is AccountState {
  return typeof value === 'string' && (ACCOUNT_STATES as readonly string[]).includes(value);
}

export interface AccountSessionSnapshot {
  readonly state: AccountState;
  readonly user: AccountIdentity | null;
  readonly expiresAt: string | null;
  readonly accountEpoch: number;
  readonly persistenceWarning?: string;
}

export const MAX_RESOURCE_ID = 2147483647;
export const MAX_PAGE_SIZE = 25;
export const MAX_LATEST_SIZE = 10;
export const MAX_RESOURCE_XML_BYTES = 2 * 1024 * 1024; // 2 MiB

export function isAccountSessionSnapshot(value: unknown): value is AccountSessionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (
    !Object.keys(c).every((k) =>
      ['state', 'user', 'expiresAt', 'accountEpoch', 'persistenceWarning'].includes(k),
    )
  )
    return false;
  if (
    c.persistenceWarning !== undefined &&
    (typeof c.persistenceWarning !== 'string' || c.persistenceWarning.length > 1000)
  )
    return false;
  if (!isAccountState(c.state)) return false;
  if (c.user !== null && !isAccountIdentity(c.user)) return false;
  if (c.expiresAt !== null && !isValidIsoUtcDate(c.expiresAt)) return false;
  if (
    typeof c.accountEpoch !== 'number' ||
    !Number.isInteger(c.accountEpoch) ||
    c.accountEpoch < 0
  ) {
    return false;
  }
  if (c.state === 'signedIn' && c.user === null) return false;
  if ('email' in c || 'password' in c || 'cookie' in c || 'token' in c) return false;
  return true;
}

/** HTTP session payloads are checked before any main-owned account state changes. */
export function isSessionResponse(
  value: unknown,
  requireExpiry = false,
): value is { user: AccountIdentity; expiresAt?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return (
    Object.keys(c).every((k) => ['user', 'expiresAt'].includes(k)) &&
    isAccountIdentity(c.user) &&
    (c.expiresAt === undefined ? !requireExpiry : isValidIsoUtcDate(c.expiresAt))
  );
}

export interface ResourceSummary {
  readonly kind: ResourceKind;
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly blueType: string | null;
  readonly createdAt: string | null;
  readonly category: {
    readonly id: number;
    readonly name: string;
  };
  readonly author: AccountIdentity;
}

export function isValidIsoUtcDate(str: unknown): str is string {
  if (typeof str !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(str);
  if (!match) return false;
  const timestamp = Date.parse(str);
  if (isNaN(timestamp)) return false;
  const d = new Date(timestamp);
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute &&
    d.getUTCSeconds() === second
  );
}

export function isResourceSummary(
  value: unknown,
  expectedKind?: ResourceKind,
  allowXml = false,
): value is ResourceSummary {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (
    !Object.keys(c).every(
      (k) =>
        [
          'kind',
          'id',
          'name',
          'description',
          'blueType',
          'createdAt',
          'category',
          'author',
        ].includes(k) ||
        (allowXml && k === 'xml'),
    )
  )
    return false;
  if (!isResourceKind(c.kind)) return false;
  if (expectedKind && c.kind !== expectedKind) return false;
  if (typeof c.id !== 'number' || !Number.isInteger(c.id) || c.id < 1 || c.id > MAX_RESOURCE_ID)
    return false;
  if (typeof c.name !== 'string' || c.name.trim().length === 0) return false;
  if (c.description !== null && typeof c.description !== 'string') return false;
  if (c.kind === 'effect') {
    if (c.blueType !== null) return false;
  } else {
    if (c.blueType !== null && (typeof c.blueType !== 'string' || c.blueType.trim().length === 0))
      return false;
  }
  if (c.createdAt !== null && !isValidIsoUtcDate(c.createdAt)) return false;

  if (!c.category || typeof c.category !== 'object') return false;
  const cat = c.category as Record<string, unknown>;
  if (
    typeof cat.id !== 'number' ||
    !Number.isInteger(cat.id) ||
    cat.id < 1 ||
    cat.id > MAX_RESOURCE_ID
  ) {
    return false;
  }
  if (!Object.keys(cat).every((k) => ['id', 'name'].includes(k))) return false;
  if (typeof cat.name !== 'string' || cat.name.trim().length === 0) return false;

  if (!isAccountIdentity(c.author)) return false;

  return true;
}

export interface ResourceDetail extends ResourceSummary {
  readonly xml: string;
}

export function isResourceDetail(
  value: unknown,
  expectedKind?: ResourceKind,
  expectedId?: number,
): value is ResourceDetail {
  if (!isResourceSummary(value, expectedKind, true)) return false;
  const c = value as unknown as Record<string, unknown>;
  if (expectedId !== undefined && c.id !== expectedId) return false;
  if (typeof c.xml !== 'string' || c.xml.trim().length === 0) return false;
  const xmlBytes = new TextEncoder().encode(c.xml).length;
  if (xmlBytes > MAX_RESOURCE_XML_BYTES) return false;
  return true;
}

export interface ResourcePage {
  readonly items: readonly ResourceSummary[];
  readonly nextBeforeId: number | null;
}

export function isResourcePage(
  value: unknown,
  expectedKind?: ResourceKind,
  expectedCategoryId?: number | null,
  beforeIdConstraint?: number | null,
): value is ResourcePage {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (!Array.isArray(c.items) || c.items.length > MAX_PAGE_SIZE) return false;
  if (
    c.nextBeforeId !== null &&
    (typeof c.nextBeforeId !== 'number' ||
      !Number.isInteger(c.nextBeforeId) ||
      c.nextBeforeId < 1 ||
      c.nextBeforeId > MAX_RESOURCE_ID)
  ) {
    return false;
  }

  // An empty page must not provide a nextBeforeId continuation
  if (c.items.length === 0 && c.nextBeforeId !== null) {
    return false;
  }

  let prevId: number | null = null;
  const seenKeys = new Set<string>();

  for (const item of c.items) {
    if (!isResourceSummary(item, expectedKind)) return false;

    if (expectedCategoryId !== null && expectedCategoryId !== undefined) {
      if (item.category.id !== expectedCategoryId) return false;
    }

    if (beforeIdConstraint !== null && beforeIdConstraint !== undefined) {
      if (item.id >= beforeIdConstraint) return false;
    }

    const key = `${item.kind}:${item.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);

    if (prevId !== null && item.id >= prevId) {
      // Must be strict descending ID order!
      return false;
    }
    prevId = item.id;
  }

  // Progressing cursor:
  // If nextBeforeId is provided, it must not exceed the lowest item id on this page.
  // Because query is exclusive (id < nextBeforeId), nextBeforeId <= lowestId guarantees no item from this page can be repeated.
  if (c.nextBeforeId !== null) {
    const lowestId = c.items[c.items.length - 1].id;
    if (c.nextBeforeId > lowestId) {
      return false;
    }
    if (beforeIdConstraint !== null && beforeIdConstraint !== undefined) {
      if (c.nextBeforeId >= beforeIdConstraint) {
        return false;
      }
    }
  }

  return true;
}

export interface LatestResult {
  readonly items: readonly ResourceSummary[];
}

export function isLatestResult(value: unknown, expectedKind?: ResourceKind): value is LatestResult {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (!Array.isArray(c.items) || c.items.length > MAX_LATEST_SIZE) return false;
  const seenKeys = new Set<string>();

  let prevCreatedAt: string | null = null;
  let prevTime: number | null = null;
  let prevId: number | null = null;

  for (const item of c.items) {
    if (!isResourceSummary(item, expectedKind)) return false;
    const key = `${item.kind}:${item.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);

    const currentTime = item.createdAt !== null ? Date.parse(item.createdAt) : null;

    if (prevId !== null) {
      // Latest ordering: creation descending, null dates last, ID descending for ties
      if (prevCreatedAt !== null && item.createdAt !== null) {
        if (prevTime! < currentTime!) {
          // Earlier item has an older creation date than later item -> not descending
          return false;
        }
        if (prevTime! === currentTime!) {
          // Date tie: ID must be strictly descending
          if (prevId <= item.id) {
            return false;
          }
        }
      } else if (prevCreatedAt === null && item.createdAt !== null) {
        // Null dates must appear last; a null date cannot precede a non-null date
        return false;
      } else if (prevCreatedAt === null && item.createdAt === null) {
        // Both dates null: ID must be strictly descending
        if (prevId <= item.id) {
          return false;
        }
      }
    }

    prevCreatedAt = item.createdAt;
    prevTime = currentTime;
    prevId = item.id;
  }
  return true;
}

export interface BlueShareError {
  readonly code: string;
  readonly message: string;
  readonly outcome?: 'rejected' | 'unknown';
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly fields?: Readonly<Record<string, string>>;
  readonly diagnostics?: readonly XmlDiagnostic[];
}

export type BlueShareResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: BlueShareError };

export function isBlueShareSuccess<T>(
  result: unknown,
  guard?: (v: unknown) => v is T,
): result is { readonly ok: true; readonly value: T } {
  if (!result || typeof result !== 'object') return false;
  const c = result as Record<string, unknown>;
  if (c.ok !== true) return false;
  if (guard && !guard(c.value)) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, limit = 1000): value is string {
  return typeof value === 'string' && value.length <= limit;
}

export function isBlueShareDiagnostic(value: unknown): value is XmlDiagnostic {
  if (!isRecord(value) || !isRecord(value.source)) return false;
  return (
    Object.keys(value).every((k) =>
      [
        'code',
        'severity',
        'source',
        'path',
        'member',
        'value',
        'message',
        'recovery',
        'line',
        'column',
      ].includes(k),
    ) &&
    Object.keys(value.source).every((k) =>
      ['kind', 'label', 'nativePath', 'libraryItemId'].includes(k),
    ) &&
    [
      'project',
      'instrument',
      'effect',
      'soundObject',
      'udo',
      'preset',
      'library',
      'primitive',
    ].includes(value.source.kind as string) &&
    boundedText(value.source.label) &&
    (value.source.nativePath === undefined || boundedText(value.source.nativePath)) &&
    (value.source.libraryItemId === undefined || boundedText(value.source.libraryItemId)) &&
    boundedText(value.code, 64) &&
    value.code.length > 0 &&
    (value.severity === 'warning' || value.severity === 'error') &&
    ['path', 'message', 'recovery'].every((k) => boundedText(value[k])) &&
    ['member', 'value'].every((k) => value[k] === undefined || boundedText(value[k])) &&
    ['line', 'column'].every(
      (k) =>
        value[k] === undefined || (Number.isSafeInteger(value[k]) && (value[k] as number) >= 1),
    )
  );
}

export function isBlueShareError(value: unknown): value is BlueShareError {
  if (!isRecord(value)) return false;
  const c = value;
  return (
    Object.keys(c).every((k) =>
      [
        'code',
        'message',
        'outcome',
        'status',
        'retryAfterSeconds',
        'fields',
        'diagnostics',
      ].includes(k),
    ) &&
    boundedText(c.code, 64) &&
    /^[a-zA-Z0-9_-]+$/.test(c.code) &&
    boundedText(c.message) &&
    (c.outcome === undefined || c.outcome === 'rejected' || c.outcome === 'unknown') &&
    (c.status === undefined ||
      (Number.isInteger(c.status) && (c.status as number) >= 100 && (c.status as number) <= 599)) &&
    (c.retryAfterSeconds === undefined ||
      (Number.isSafeInteger(c.retryAfterSeconds) &&
        (c.retryAfterSeconds as number) >= 0 &&
        (c.retryAfterSeconds as number) <= 86400)) &&
    (c.fields === undefined ||
      (isRecord(c.fields) &&
        Object.keys(c.fields).length <= 32 &&
        Object.entries(c.fields).every(
          ([k, v]) => /^[a-zA-Z0-9_.-]{1,64}$/.test(k) && boundedText(v),
        ))) &&
    (c.diagnostics === undefined ||
      (Array.isArray(c.diagnostics) &&
        c.diagnostics.length <= 100 &&
        c.diagnostics.every(isBlueShareDiagnostic)))
  );
}

// Publish source preparation and submission
export interface PublishSourceSeed {
  readonly sourceToken: string;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly blueType: string | null;
  readonly descriptionSeed: string;
  readonly byteLength: number;
}

export interface PublishResourceRequest {
  readonly categoryId: number;
  readonly name: string;
  readonly description: string | null;
  readonly blueType: string | null;
  readonly xml: string;
}

export const MAX_PUBLISH_JSON_BYTES = 16 * 1024 * 1024;
export const MAX_LOGIN_JSON_BYTES = 16 * 1024;
export const MAX_PUBLISH_XML_BYTES = 2 * 1024 * 1024;
export const MAX_PUBLISH_DESCRIPTION_BYTES = 64 * 1024;
export const MAX_XML_DEPTH = 128;
export const MAX_XML_ELEMENTS = 100000;

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly rememberMe?: boolean;
}

export function isLoginRequest(value: unknown): value is LoginRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return validateLoginRequest(c).valid;
}

const ALLOWED_LOGIN_FIELDS = new Set(['email', 'password', 'rememberMe']);

export function validateLoginRequest(
  request: unknown,
): { valid: true; request: LoginRequest } | { valid: false; errors: Record<string, string> } {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { valid: false, errors: { request: 'Invalid request object' } };
  }
  const candidate = request as Record<string, unknown>;
  const errors: Record<string, string> = {};
  if (candidate.rememberMe !== undefined && typeof candidate.rememberMe !== 'boolean')
    errors.rememberMe = 'Provide a boolean.';

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_LOGIN_FIELDS.has(key)) {
      errors[key] = `Unexpected field: ${key}`;
    }
  }

  if (
    typeof candidate.email !== 'string' ||
    candidate.email.trim().length === 0 ||
    !candidate.email.includes('@')
  ) {
    errors.email = 'Valid email is required';
  }

  if (typeof candidate.password !== 'string' || candidate.password.length === 0) {
    errors.password = 'Password is required';
  }

  try {
    const jsonStr = JSON.stringify({
      email: typeof candidate.email === 'string' ? candidate.email : '',
      password: typeof candidate.password === 'string' ? candidate.password : '',
      ...(candidate.rememberMe === undefined ? {} : { rememberMe: candidate.rememberMe }),
    });
    const jsonBytes = new TextEncoder().encode(jsonStr).length;
    if (jsonBytes > MAX_LOGIN_JSON_BYTES) {
      errors.request = 'Login payload must not exceed 16 KiB';
    }
  } catch {
    // Ignore JSON serialization error
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    request: {
      email: (candidate.email as string).trim(),
      password: candidate.password as string,
      ...(candidate.rememberMe === undefined
        ? {}
        : { rememberMe: candidate.rememberMe as boolean }),
    },
  };
}

export function checkXmlEnvelope(
  root: Element,
  maxDepth = MAX_XML_DEPTH,
  maxElements = MAX_XML_ELEMENTS,
): { valid: true; elementCount: number; maxDepth: number } | { valid: false; error: string } {
  let elementCount = 0;
  let reachedDepth = 1;

  function traverse(el: Element, depth: number): boolean {
    elementCount++;
    if (elementCount > maxElements) {
      return false;
    }
    if (depth > maxDepth) {
      return false;
    }
    if (depth > reachedDepth) {
      reachedDepth = depth;
    }
    for (const child of el.getElements()) {
      if (!traverse(child, depth + 1)) {
        return false;
      }
    }
    return true;
  }

  const ok = traverse(root, 1);
  if (!ok) {
    if (elementCount > maxElements) {
      return {
        valid: false,
        error: `XML exceeds maximum element limit of ${maxElements}`,
      };
    }
    return {
      valid: false,
      error: `XML exceeds maximum depth limit of ${maxDepth}`,
    };
  }
  return { valid: true, elementCount, maxDepth: reachedDepth };
}

const ALLOWED_PUBLISH_FIELDS = new Set(['categoryId', 'name', 'description', 'blueType', 'xml']);

export function validatePublishRequest(
  kind: ResourceKind,
  request: unknown,
):
  | { valid: true; request: PublishResourceRequest }
  | { valid: false; errors: Record<string, string> } {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { valid: false, errors: { request: 'Invalid request object' } };
  }
  const candidate = request as Record<string, unknown>;
  const errors: Record<string, string> = {};

  // Reject unexpected fields
  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_PUBLISH_FIELDS.has(key)) {
      errors[key] = `Unexpected field: ${key}`;
    }
  }

  if (
    typeof candidate.categoryId !== 'number' ||
    !Number.isInteger(candidate.categoryId) ||
    candidate.categoryId < 1 ||
    candidate.categoryId > MAX_RESOURCE_ID
  ) {
    errors.categoryId = 'A valid category ID is required';
  }

  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const codePoints = [...name].length;
  if (codePoints < 1 || codePoints > 255) {
    errors.name = 'Name must be between 1 and 255 characters';
  }

  let description: string | null = null;
  if (candidate.description !== undefined && candidate.description !== null) {
    if (typeof candidate.description !== 'string') {
      errors.description = 'Description must be a string or null';
    } else {
      const bytes = new TextEncoder().encode(candidate.description).length;
      if (bytes > MAX_PUBLISH_DESCRIPTION_BYTES) {
        errors.description = 'Description must not exceed 64 KiB';
      } else {
        description = candidate.description;
      }
    }
  }

  let blueType: string | null = null;
  if (kind === 'effect') {
    if (candidate.blueType !== null && candidate.blueType !== undefined) {
      errors.blueType = 'Effects must not have a blueType';
    }
  } else {
    if (
      typeof candidate.blueType !== 'string' ||
      candidate.blueType.length === 0 ||
      candidate.blueType.length > 255 ||
      !/^[\x20-\x7E]+$/.test(candidate.blueType)
    ) {
      errors.blueType = `Type is required for ${kind} and must be <= 255 ASCII characters`;
    } else {
      const prefix = kind === 'instrument' ? 'blue.orchestra.' : 'blue.soundObject.';
      if (!candidate.blueType.startsWith(prefix) || candidate.blueType.length <= prefix.length) {
        errors.blueType = `Type must start with ${prefix}`;
      } else {
        blueType = candidate.blueType;
      }
    }
  }

  if (typeof candidate.xml !== 'string' || candidate.xml.trim().length === 0) {
    errors.xml = 'XML content is required';
  } else {
    // Comments/CDATA are text, never declarations. Parse the original bytes below;
    // this lexical view is used only for declarations the Element wrapper omits.
    const declarations = candidate.xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    if (/<!DOCTYPE\b/i.test(declarations) || /<!ENTITY\b/i.test(declarations)) {
      errors.xml = 'XML must not contain DOCTYPE, ENTITY, or XInclude declarations';
    } else {
      const xmlBytes = new TextEncoder().encode(candidate.xml).length;
      if (xmlBytes > MAX_PUBLISH_XML_BYTES) {
        errors.xml = 'XML content must not exceed 2 MiB';
      } else {
        try {
          const root = Element.parse(candidate.xml);
          const pending = [root];
          while (pending.length) {
            const node = pending.pop()!;
            if (
              /(?:^|:)include$/i.test(node.getName()) ||
              node
                .getAttributeNames()
                .some(
                  (name) =>
                    (name === 'xmlns' || name.startsWith('xmlns:')) &&
                    node.getAttribute(name) === 'http://www.w3.org/2001/XInclude',
                )
            ) {
              errors.xml = 'XML must not contain DOCTYPE, ENTITY, or XInclude declarations';
              break;
            }
            pending.push(...node.getElements());
          }
          const rootName = root.getName();
          if (rootName !== kind) {
            errors.xml = `XML root element <${rootName}> does not match resource kind '${kind}'`;
          } else {
            if (kind === 'instrument' || kind === 'soundObject') {
              const rootType = root.getAttribute('type');
              if (!rootType || rootType.trim().length === 0) {
                errors.xml = `XML root <${rootName}> is missing required type attribute`;
              } else if (blueType && rootType !== blueType) {
                errors.blueType = `Type "${blueType}" does not match XML root type attribute "${rootType}"`;
              }
            } else if (kind === 'effect') {
              const rootType = root.getAttribute('type');
              if (rootType !== null && rootType !== undefined) {
                errors.xml = 'Effect XML root must not have a type attribute';
              }
            }

            const envelope = checkXmlEnvelope(root);
            if (!envelope.valid) {
              errors.xml = envelope.error;
            }
          }
        } catch (err: unknown) {
          if (!errors.xml) {
            errors.xml = 'XML is malformed or contains unsupported declarations';
          }
        }
      }
    }
  }

  try {
    const jsonStr = JSON.stringify({
      categoryId: candidate.categoryId,
      name,
      description,
      blueType,
      xml: typeof candidate.xml === 'string' ? candidate.xml : '',
    });
    const jsonBytes = new TextEncoder().encode(jsonStr).length;
    if (jsonBytes > MAX_PUBLISH_JSON_BYTES) {
      errors.request = 'Publish payload must not exceed 16 MiB';
    }
  } catch {
    // Ignore JSON serialization error
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    request: {
      categoryId: candidate.categoryId as number,
      name,
      description,
      blueType,
      xml: candidate.xml as string,
    },
  };
}

// IPC Channels
export const BLUESHARE_CHANNELS = {
  OPEN: 'blueshare:open',
  GET_ACCOUNT: 'blueshare:get-account',
  SIGN_IN: 'blueshare:sign-in',
  SIGN_OUT: 'blueshare:sign-out',
  GET_CATEGORIES: 'blueshare:get-categories',
  LIST_RESOURCES: 'blueshare:list-resources',
  GET_LATEST: 'blueshare:get-latest',
  GET_RESOURCE: 'blueshare:get-resource',
  IMPORT_RESOURCE: 'blueshare:import-resource',
  PREPARE_PUBLISH: 'blueshare:prepare-publish',
  RESET_PUBLISH: 'blueshare:reset-publish',
  PUBLISH_RESOURCE: 'blueshare:publish-resource',
  LIST_MINE: 'blueshare:list-mine',
  REMOVE_RESOURCE: 'blueshare:remove-resource',
  OPEN_WEBSITE: 'blueshare:open-website',
  CLOSE: 'blueshare:close',
  ACCOUNT_CHANGED: 'blueshare:account-changed',
} as const;

export function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
}

export function isContextId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
}

export function isAccountEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isUserLibraryItemKey(value: unknown): value is {
  readonly scope: 'user';
  readonly libraryType: ResourceKind;
  readonly nodeId: string;
} {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    Object.keys(c).every((k) => ['scope', 'libraryType', 'nodeId'].includes(k)) &&
    c.scope === 'user' &&
    isResourceKind(c.libraryType) &&
    typeof c.nodeId === 'string' &&
    c.nodeId.trim().length > 0
  );
}

export function isServiceScope(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

export function isOpenDialogResult(value: unknown): value is {
  readonly contextId: string;
  readonly serviceScope: string;
  readonly account: AccountSessionSnapshot;
} {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    isContextId(c.contextId) &&
    isServiceScope(c.serviceScope) &&
    isAccountSessionSnapshot(c.account)
  );
}

export function isSignOutResult(
  value: unknown,
): value is { readonly signedOut: boolean; readonly remoteRevocationConfirmed: boolean } {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return c.signedOut === true && typeof c.remoteRevocationConfirmed === 'boolean';
}

export function isPublishSourceSeed(value: unknown): value is PublishSourceSeed {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.sourceToken === 'string' &&
    c.sourceToken.trim().length > 0 &&
    isResourceKind(c.kind) &&
    typeof c.name === 'string' &&
    c.name.trim().length > 0 &&
    (c.blueType === null || (typeof c.blueType === 'string' && c.blueType.trim().length > 0)) &&
    typeof c.descriptionSeed === 'string' &&
    typeof c.byteLength === 'number' &&
    Number.isInteger(c.byteLength) &&
    c.byteLength >= 0
  );
}

export function isRemoveResourceResult(value: unknown): value is {
  readonly kind: ResourceKind;
  readonly id: number;
  readonly removed: boolean;
  readonly alreadyRemoved: boolean;
} {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    isResourceKind(c.kind) &&
    typeof c.id === 'number' &&
    Number.isInteger(c.id) &&
    c.id >= 1 &&
    c.removed === true &&
    typeof c.alreadyRemoved === 'boolean'
  );
}

export function isOpenWebsiteResult(value: unknown): value is { readonly opened: boolean } {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return typeof c.opened === 'boolean';
}

export function isLibraryMutationReceipt(value: unknown): value is LibraryMutationReceipt {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    Object.keys(c).every((k) =>
      ['contentRevision', 'affectedNodes', 'closedEditorSessionIds'].includes(k),
    ) &&
    typeof c.contentRevision === 'number' &&
    Number.isInteger(c.contentRevision) &&
    c.contentRevision >= 0 &&
    Array.isArray(c.affectedNodes) &&
    c.affectedNodes.length <= 1000 &&
    c.affectedNodes.every(
      (node) =>
        isRecord(node) &&
        Object.keys(node).every((k) =>
          [
            'key',
            'nodeId',
            'parentId',
            'libraryType',
            'scope',
            'nodeKind',
            'displayName',
            'breadcrumb',
            'supportStatus',
            'objectType',
            'revision',
            'hasChildren',
          ].includes(k),
        ) &&
        isResourceKind(node.libraryType) &&
        node.scope === 'user' &&
        ['root', 'folder', 'item'].includes(node.nodeKind as string) &&
        boundedText(node.nodeId, 256) &&
        node.nodeId.length > 0 &&
        (node.parentId === null || boundedText(node.parentId, 256)) &&
        boundedText(node.displayName) &&
        Array.isArray(node.breadcrumb) &&
        node.breadcrumb.length <= 128 &&
        node.breadcrumb.every((v) => boundedText(v)) &&
        Number.isSafeInteger(node.revision) &&
        (node.revision as number) >= 0 &&
        typeof node.hasChildren === 'boolean' &&
        (node.key === null ||
          (isUserLibraryItemKey(node.key) &&
            node.key.scope === 'user' &&
            node.key.libraryType === node.libraryType &&
            node.key.nodeId === node.nodeId)) &&
        (node.supportStatus === undefined ||
          ['supported', 'unsupported'].includes(node.supportStatus as string)) &&
        (node.objectType === undefined || boundedText(node.objectType)),
    ) &&
    (c.closedEditorSessionIds === undefined ||
      (Array.isArray(c.closedEditorSessionIds) &&
        c.closedEditorSessionIds.length <= 1000 &&
        c.closedEditorSessionIds.every((v) => boundedText(v, 256))))
  );
}

export function isCategoryList(
  value: unknown,
  expectedKind?: ResourceKind,
): value is readonly Category[] {
  if (!Array.isArray(value)) return false;
  return validateCategoryHierarchy(value as readonly Category[], expectedKind).ok;
}

export function validateBlueShareResult<T>(
  result: unknown,
  valueGuard: (v: unknown) => v is T,
  errorMessage = 'Invalid IPC response payload from BlueShare',
): BlueShareResult<T> {
  if (!result || typeof result !== 'object') {
    return {
      ok: false,
      error: { code: 'boundary_contract_violation', message: errorMessage, outcome: 'rejected' },
    };
  }
  const res = result as Record<string, unknown>;
  if (res.ok === false) {
    if (isBlueShareError(res.error)) {
      return { ok: false, error: res.error };
    }
    return {
      ok: false,
      error: { code: 'boundary_contract_violation', message: errorMessage, outcome: 'rejected' },
    };
  }
  if (res.ok === true && valueGuard(res.value)) {
    return { ok: true, value: res.value };
  }
  return {
    ok: false,
    error: { code: 'boundary_contract_violation', message: errorMessage, outcome: 'rejected' },
  };
}

export function isResetPublishResult(value: unknown): value is { readonly cleared: true } {
  return isRecord(value) && value.cleared === true && Object.keys(value).length === 1;
}
