import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blueShareKey, BlueShareQueryError, callBlueShare, readBlueShare } from './blueshare-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isResourceKind,
  type AccountSessionSnapshot,
  type PublishSourceSeed,
  type ResourceKey,
  type ResourceKind,
  type ResourceSummary,
} from '../../../shared/blueshare';
import type { XmlDiagnostic } from '@blue/data';
import type {
  BrowseLibraryResult,
  LibraryResult,
  LibraryBrowseNode,
  LibraryItemKey,
} from '../../../shared/unified-library';

export type BlueShareTab = 'import' | 'export' | 'manage';

export interface ResourceDetailError {
  readonly message: string;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly diagnostics?: readonly XmlDiagnostic[];
  readonly fields?: Readonly<Record<string, string>>;
}

function formatError(error: { message: string; retryAfterSeconds?: number | null }): string {
  if (error.retryAfterSeconds != null && error.retryAfterSeconds > 0) {
    return `${error.message} (Retry after ${error.retryAfterSeconds}s)`;
  }
  return error.message;
}

async function localReadDeadline<T>(
  read: () => Promise<T>,
  deadline = Date.now() + 30_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new BlueShareQueryError({
                code: 'timeout',
                message: 'BlueShare request timed out. Try again.',
                outcome: 'rejected',
              }),
            ),
          Math.max(0, deadline - Date.now()),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function collectUserLibraryNodes(
  libraryType: ResourceKind,
  isCurrent?: () => boolean,
): Promise<LibraryBrowseNode[]> {
  if (!window.blueAPI?.browseLibraries) return [];
  const nodes = new Map<string, LibraryBrowseNode>();
  const queue: (string | undefined)[] = [undefined];
  const visited = new Set<string>();
  let expectedContentRevision: number | undefined = undefined;

  while (queue.length > 0) {
    if (isCurrent && !isCurrent()) return [];
    const nodeId = queue.shift();
    let cursor: string | undefined = undefined;

    do {
      if (isCurrent && !isCurrent()) return [];
      const res: LibraryResult<BrowseLibraryResult> = await window.blueAPI
        .browseLibraries({
          parent: { scope: 'user', libraryType, nodeId },
          limit: 500,
          ...(cursor ? { cursor } : {}),
          ...(expectedContentRevision !== undefined ? { expectedContentRevision } : {}),
        })
        .catch(() => {
          throw new BlueShareQueryError({
            code: 'library_error',
            message: 'Failed to browse user library',
            outcome: 'rejected',
          });
        });

      if (isCurrent && !isCurrent()) return [];

      if (!res || !res.ok) {
        throw new BlueShareQueryError({
          code: 'library_error',
          message: res && !res.ok ? formatError(res.error) : 'Failed to browse user library',
          outcome: 'rejected',
        });
      }

      if (expectedContentRevision === undefined && typeof res.value?.contentRevision === 'number') {
        expectedContentRevision = res.value.contentRevision;
      }

      if (res.value.parent?.nodeKind === 'root') {
        nodes.set(res.value.parent.nodeId, res.value.parent);
      }
      for (const child of res.value.children) {
        nodes.set(child.nodeId, child);
        if (child.nodeKind === 'folder' && !visited.has(child.nodeId)) {
          visited.add(child.nodeId);
          queue.push(child.nodeId);
        }
      }

      cursor = res.value.nextCursor ?? undefined;
    } while (cursor);
  }
  return [...nodes.values()];
}

const SIGNED_OUT: AccountSessionSnapshot = {
  state: 'signedOut',
  user: null,
  expiresAt: null,
  accountEpoch: 0,
};
interface ExportDraft {
  key: LibraryItemKey | null;
  revision: number | null;
  reviewedName: string | null;
  seed: PublishSourceSeed | null;
  categoryId: number | null;
  description: string;
  edited: boolean;
  generation: number;
}
const EMPTY_DRAFT: ExportDraft = {
  key: null,
  revision: null,
  reviewedName: null,
  seed: null,
  categoryId: null,
  description: '',
  edited: false,
  generation: 0,
};
interface UncertainWrite {
  context: string;
  epoch: number;
  kind: ResourceKind;
  request: string;
  key?: ResourceKey;
  reconciled: boolean;
  refreshStarted?: boolean;
  draft?: ExportDraft;
}
function queryFailure(error: unknown) {
  return error instanceof BlueShareQueryError
    ? error.failure
    : { code: 'ipc_failure', message: 'BlueShare request failed', outcome: 'unknown' as const };
}
function errorText(error: unknown): string | null {
  return error ? formatError(queryFailure(error)) : null;
}

export function useBlueShare() {
  const client = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<{ id: string; scope: string } | null>(null);
  const [group, setGroupState] = useState<ResourceKind>('instrument');
  const groupRef = useRef(group);
  const [tab, setTab] = useState<BlueShareTab>('import');
  const [selectedCategory, setSelectedCategory] = useState<number | 'latest'>('latest');
  const [selectedResourceKey, setSelectedResourceKey] = useState<ResourceKey | null>(null);
  const [selectedOwnedKey, setSelectedOwnedKey] = useState<ResourceKey | null>(null);
  const ownedSelections = useRef<Partial<Record<ResourceKind, ResourceKey | null>>>({});
  const [account, setAccount] = useState(SIGNED_OUT);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraftState] = useState(EMPTY_DRAFT);
  const draftRef = useRef(draft);
  const drafts = useRef<Partial<Record<ResourceKind, ExportDraft>>>({});
  const prepareGeneration = useRef(0);
  const submittedDraft = useRef<{ request: string; draft: ExportDraft } | null>(null);
  const [uncertainPublish, setUncertainPublish] = useState<UncertainWrite | null>(null);
  const [uncertainRemove, setUncertainRemove] = useState<UncertainWrite | null>(null);
  const uncertainRef = useRef({ publish: uncertainPublish, remove: uncertainRemove });
  uncertainRef.current = { publish: uncertainPublish, remove: uncertainRemove };
  const [absenceReceipt, setAbsenceReceipt] = useState<null | {
    kind: ResourceKind;
    id: number;
    removed: boolean;
    alreadyRemoved: boolean;
  }>(null);
  const [remoteRevocationConfirmed, setRemoteRevocationConfirmed] = useState<boolean | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const lifetime = useRef({ generation: 0, open: false, context: null as string | null });
  const accountRef = useRef(account);
  const serial = useRef(0);
  const authAttempt = useRef(0);
  const requestId = () => `blue-${++serial.current}`;
  const updateDraft = (update: (prev: ExportDraft) => ExportDraft, kind = groupRef.current) => {
    const next = update(
      kind === groupRef.current ? draftRef.current : (drafts.current[kind] ?? EMPTY_DRAFT),
    );
    drafts.current[kind] = next;
    if (kind === groupRef.current) {
      draftRef.current = next;
      setDraftState(next);
    }
  };
  const key = (operation: string, selection?: string | number | null, privateRead = false) =>
    blueShareKey(
      context?.scope ?? null,
      context?.id ?? null,
      operation,
      group,
      selection,
      privateRead ? { id: account.user?.id ?? '', epoch: account.accountEpoch } : undefined,
    );
  const ready = isOpen && !!context;
  const ctx = context?.id ?? '';
  const signedIn = account.state === 'signedIn' && !!account.user;
  const active = (origin: { context: string; epoch?: number }) =>
    lifetime.current.open &&
    lifetime.current.context === origin.context &&
    (origin.epoch === undefined || accountRef.current.accountEpoch === origin.epoch);

  const applyAccount = useCallback(
    (snapshot: AccountSessionSnapshot) => {
      if (!lifetime.current.open || snapshot.accountEpoch < accountRef.current.accountEpoch) return;
      const previous = accountRef.current;
      accountRef.current = snapshot;
      setAccount(snapshot);
      if (
        previous.accountEpoch !== snapshot.accountEpoch ||
        previous.user?.id !== snapshot.user?.id ||
        snapshot.state !== 'signedIn'
      ) {
        prepareGeneration.current++;
        submittedDraft.current = null;
        for (const kind of Object.keys(drafts.current) as ResourceKind[])
          drafts.current[kind] = { ...drafts.current[kind]!, seed: null };
        const next = { ...draftRef.current, seed: null };
        draftRef.current = next;
        setDraftState(next);
        ownedSelections.current = {};
        setSelectedOwnedKey(null);
        setUncertainRemove(null);
        setUncertainPublish(null);
        // Remove obsolete private entries, including their pending renderer observation.
        const filters = {
          predicate: (q: { queryKey: readonly unknown[] }) =>
            q.queryKey[0] === 'blueshare' &&
            q.queryKey[3] === 'mine' &&
            (q.queryKey[6] !== snapshot.user?.id || q.queryKey[7] !== snapshot.accountEpoch),
        };
        void client.cancelQueries(filters);
        client.removeQueries(filters);
        for (const mutation of client.getMutationCache().getAll()) {
          const variables = mutation.state.variables as { epoch?: number } | undefined;
          if (variables?.epoch !== undefined && variables.epoch !== snapshot.accountEpoch)
            client.getMutationCache().remove(mutation);
        }
      }
    },
    [client],
  );

  const categoriesQuery = useQuery({
    queryKey: key('categories'),
    enabled: ready,
    queryFn: ({ signal }) =>
      readBlueShare(signal, () => window.blueAPI.getBlueShareCategories(ctx, requestId(), group)),
  });
  const latestQuery = useQuery({
    queryKey: key('latest'),
    enabled: ready && tab === 'import' && selectedCategory === 'latest',
    queryFn: ({ signal }) =>
      readBlueShare(signal, () => window.blueAPI.getBlueShareLatest(ctx, requestId(), group)),
  });
  const categoryQuery = useInfiniteQuery({
    queryKey: key('category', selectedCategory),
    enabled: ready && tab === 'import' && selectedCategory !== 'latest',
    initialPageParam: null as number | null,
    queryFn: ({ signal, pageParam }) =>
      readBlueShare(signal, () =>
        window.blueAPI.listBlueShareResources(
          ctx,
          requestId(),
          group,
          selectedCategory === 'latest' ? null : selectedCategory,
          pageParam,
        ),
      ),
    getNextPageParam: (page) => page.nextBeforeId ?? undefined,
  });
  const detailQuery = useQuery({
    queryKey: blueShareKey(
      context?.scope ?? null,
      context?.id ?? null,
      'detail',
      selectedResourceKey?.kind ?? group,
      selectedResourceKey?.id,
    ),
    enabled: ready && tab === 'import' && !!selectedResourceKey,
    queryFn: ({ signal }) =>
      readBlueShare(signal, () =>
        window.blueAPI.getBlueShareResource(ctx, requestId(), selectedResourceKey!),
      ),
  });
  const libraryQuery = useQuery({
    queryKey: key('library'),
    enabled: ready && tab === 'export',
    queryFn: async ({ signal }) => {
      signal.throwIfAborted();
      let observing = true;
      try {
        return await localReadDeadline(() =>
          collectUserLibraryNodes(group, () => observing && !signal.aborted),
        );
      } finally {
        observing = false;
        signal.throwIfAborted();
      }
    },
  });
  const mineQuery = useInfiniteQuery({
    queryKey: key('mine', null, true),
    enabled: ready && signedIn && tab === 'manage',
    initialPageParam: null as number | null,
    queryFn: ({ signal, pageParam }) =>
      readBlueShare(signal, () =>
        window.blueAPI.listBlueShareMine(ctx, requestId(), group, pageParam),
      ),
    getNextPageParam: (page) => page.nextBeforeId ?? undefined,
  });

  // Only a confirmed write refreshes the affected public/private kind. Imports refresh
  // local library views through the canonical library event and this local query.
  const invalidateKind = (
    origin: { context: string; kind: ResourceKind; key?: ResourceKey },
    includeOwned = true,
  ) => {
    if (!active(origin)) return;
    void client.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === 'blueshare' &&
        q.queryKey[2] === origin.context &&
        q.queryKey[4] === origin.kind &&
        (['latest', 'category'].includes(q.queryKey[3] as string) ||
          (includeOwned && q.queryKey[3] === 'mine') ||
          (q.queryKey[3] === 'detail' && origin.key?.id === q.queryKey[5])),
    });
  };
  const importMutation = useMutation({
    mutationFn: async (intent: { context: string; key: ResourceKey }) =>
      callBlueShare(() =>
        window.blueAPI.importBlueShareResource(intent.context, requestId(), intent.key),
      ),
    onSuccess: (_receipt, intent) => {
      if (active(intent))
        void client.invalidateQueries({
          queryKey: blueShareKey(
            context?.scope ?? null,
            intent.context,
            'library',
            intent.key.kind,
          ),
        });
    },
  });
  const prepareMutation = useMutation({
    mutationFn: async (intent: {
      context: string;
      epoch: number;
      generation: number;
      key: { scope: 'user'; libraryType: ResourceKind; nodeId: string };
      revision: number;
    }) =>
      localReadDeadline(() =>
        callBlueShare(() =>
          window.blueAPI.prepareBlueSharePublish(
            intent.context,
            requestId(),
            intent.key,
            intent.revision,
          ),
        ),
      ),
    onSuccess: (seed, intent) => {
      if (!active(intent) || prepareGeneration.current !== intent.generation) return;
      updateDraft((prev) => ({
        ...prev,
        seed: structuredClone(seed),
        description: prev.edited ? prev.description : seed.descriptionSeed,
      }));
    },
    onError: (error, intent) => {
      if (
        queryFailure(error).code === 'timeout' &&
        active(intent) &&
        prepareGeneration.current === intent.generation
      )
        void window.blueAPI.resetBlueSharePublish?.(intent.context, requestId());
    },
  });
  const publishMutation = useMutation({
    mutationFn: async (intent: {
      context: string;
      epoch: number;
      kind: ResourceKind;
      request: string;
      token: string;
      categoryId: number;
      description: string;
      generation: number;
    }) =>
      callBlueShare(() =>
        window.blueAPI.publishBlueShareResource(
          intent.context,
          intent.request,
          intent.token,
          intent.categoryId,
          intent.description,
        ),
      ),
    onSuccess: (_receipt, intent) => {
      if (!active(intent)) return;
      invalidateKind(intent);
      setUncertainPublish(null);
      // An old completion may invalidate its own token, never a newer review/draft.
      updateDraft(
        (prev) =>
          prev.seed?.sourceToken === intent.token || prev.generation === intent.generation
            ? prev.generation === intent.generation
              ? { ...EMPTY_DRAFT, generation: prev.generation + 1 }
              : { ...prev, seed: null }
            : prev,
        intent.kind,
      );
    },
    onError: (err, intent) => {
      if (!active(intent)) return;
      const failure = queryFailure(err);
      if (failure.outcome === 'unknown')
        setUncertainPublish({
          ...intent,
          reconciled: false,
          draft:
            submittedDraft.current?.request === intent.request
              ? submittedDraft.current.draft
              : undefined,
        });
      if (failure.status === 401 || failure.code === 'stale_source') {
        updateDraft(
          (prev) => (prev.seed?.sourceToken === intent.token ? { ...prev, seed: null } : prev),
          intent.kind,
        );
        void refreshAccount(intent.context);
      }
    },
  });
  const removeMutation = useMutation({
    mutationFn: async (intent: {
      context: string;
      epoch: number;
      kind: ResourceKind;
      key: ResourceKey;
      request: string;
    }) =>
      callBlueShare(() =>
        window.blueAPI.removeBlueShareResource(intent.context, intent.request, intent.key),
      ),
    onSuccess: (_receipt, intent) => {
      if (active(intent)) {
        invalidateKind(intent);
        setUncertainRemove(null);
        const selected = ownedSelections.current[intent.kind];
        if (selected?.id === intent.key.id) ownedSelections.current[intent.kind] = null;
        setSelectedOwnedKey((selected) =>
          selected?.kind === intent.key.kind && selected.id === intent.key.id ? null : selected,
        );
      }
    },
    onError: (err, intent) => {
      if (active(intent) && queryFailure(err).outcome === 'unknown')
        setUncertainRemove({ ...intent, reconciled: false });
    },
  });
  const currentPublish = !!publishMutation.variables && active(publishMutation.variables);
  const currentRemove = !!removeMutation.variables && active(removeMutation.variables);
  const currentPrepare =
    !!prepareMutation.variables &&
    active(prepareMutation.variables) &&
    prepareMutation.variables.generation === prepareGeneration.current;
  const busy =
    importMutation.isPending ||
    (currentPublish && publishMutation.isPending) ||
    (currentRemove && removeMutation.isPending);

  async function refreshAccount(origin = lifetime.current.context, deadline?: number) {
    if (!origin) return;
    try {
      const snapshot = await localReadDeadline(
        () => callBlueShare(() => window.blueAPI.getBlueShareAccount(origin)),
        deadline,
      );
      if (active({ context: origin })) applyAccount(snapshot);
    } catch {
      /* Keep the last checked snapshot; a failed read is not signed-out proof. */
    }
  }
  const clearMutations = () => {
    importMutation.reset();
    prepareMutation.reset();
    publishMutation.reset();
    removeMutation.reset();
    client.getMutationCache().clear();
  };
  const close = useCallback(() => {
    const old = lifetime.current.context;
    lifetime.current = { generation: lifetime.current.generation + 1, open: false, context: null };
    prepareGeneration.current++;
    authAttempt.current++;
    if (old) void window.blueAPI.closeBlueShare(old);
    client.clear();
    setContext(null);
    setIsOpen(false);
    setError(null);
    drafts.current = {};
    submittedDraft.current = null;
    draftRef.current = EMPTY_DRAFT;
    setDraftState(EMPTY_DRAFT);
    setSelectedResourceKey(null);
    ownedSelections.current = {};
    setSelectedOwnedKey(null);
    setUncertainPublish(null);
    setUncertainRemove(null);
    setAbsenceReceipt(null);
    setIsSigningIn(false);
    setIsSigningOut(false);
    setRemoteRevocationConfirmed(null);
  }, [client]);
  const open = useCallback(async () => {
    if (lifetime.current.open) return;
    const generation = ++lifetime.current.generation;
    lifetime.current.open = true;
    setIsOpen(true);
    setError(null);
    clearMutations();
    let accepting = true;
    const openingAccount = accountRef.current;
    try {
      const result = await localReadDeadline(() =>
        callBlueShare(() => window.blueAPI.openBlueShare()).then((result) => {
          if (!accepting) void window.blueAPI.closeBlueShare(result.contextId);
          return result;
        }),
      );
      if (!lifetime.current.open || lifetime.current.generation !== generation) {
        void window.blueAPI.closeBlueShare(result.contextId);
        return;
      }
      lifetime.current.context = result.contextId;
      setContext({ id: result.contextId, scope: result.serviceScope });
      // A checked event can arrive before OPEN crosses IPC. Do not regress it.
      if (
        accountRef.current === openingAccount ||
        result.account.accountEpoch > accountRef.current.accountEpoch
      )
        applyAccount(result.account);
    } catch (err) {
      if (lifetime.current.open && lifetime.current.generation === generation)
        setError(errorText(err));
    } finally {
      accepting = false;
    }
  }, [client]);
  useEffect(
    () => () => {
      const old = lifetime.current.context;
      lifetime.current = {
        generation: lifetime.current.generation + 1,
        open: false,
        context: null,
      };
      prepareGeneration.current++;
      authAttempt.current++;
      submittedDraft.current = null;
      drafts.current = {};
      draftRef.current = EMPTY_DRAFT;
      if (old) void window.blueAPI.closeBlueShare(old);
      client.clear();
    },
    [client],
  );
  useEffect(() => window.blueAPI.onBlueShareAccountChanged?.(applyAccount), [applyAccount]);
  // Mounted disabled observers can be rebuilt by a late mutation notification.
  // Closed dialogs retain no cache entries, including those empty observers.
  useEffect(() => {
    if (!isOpen) client.clear();
  });

  async function signIn(email: string, password: string, rememberMe = false): Promise<boolean> {
    if (!ctx || isSigningIn) return false;
    const attempt = ++authAttempt.current;
    const deadline = Date.now() + 30_000;
    setIsSigningOut(false);
    setIsSigningIn(true);
    setError(null);
    try {
      // Credentials deliberately bypass Query and Mutation caches.
      const args = [ctx, requestId(), email, password] as const;
      const result = await localReadDeadline(
        () =>
          rememberMe
            ? window.blueAPI.signInBlueShare(...args, true)
            : window.blueAPI.signInBlueShare(...args),
        deadline,
      );
      if (!active({ context: ctx }) || authAttempt.current !== attempt) return false;
      if (result.ok) applyAccount(result.value);
      else setError(formatError(result.error));
      await refreshAccount(ctx, deadline);
      return result.ok;
    } catch {
      if (active({ context: ctx }) && authAttempt.current === attempt)
        setError('Sign-in could not complete. Try again.');
      return false;
    } finally {
      if (active({ context: ctx }) && authAttempt.current === attempt) setIsSigningIn(false);
    }
  }
  async function signOut(): Promise<boolean> {
    if (!ctx || isSigningOut) return false;
    const attempt = ++authAttempt.current;
    const deadline = Date.now() + 30_000;
    setIsSigningOut(true);
    setIsSigningIn(false);
    setError(null);
    try {
      const result = await localReadDeadline(
        () => callBlueShare(() => window.blueAPI.signOutBlueShare(ctx, requestId())),
        deadline,
      );
      if (!active({ context: ctx }) || authAttempt.current !== attempt) return false;
      await refreshAccount(ctx, deadline);
      if (authAttempt.current !== attempt || accountRef.current.state !== 'signedOut') return false;
      setRemoteRevocationConfirmed(result.remoteRevocationConfirmed);
      if (!result.remoteRevocationConfirmed)
        setError(
          'Signed out locally, but remote session revocation could not be confirmed with the server.',
        );
      return true;
    } catch {
      if (active({ context: ctx }) && authAttempt.current === attempt)
        setError('Sign-out could not be confirmed.');
      return false;
    } finally {
      if (active({ context: ctx }) && authAttempt.current === attempt) setIsSigningOut(false);
    }
  }
  function reconcilePages(
    pages: readonly { items: readonly ResourceSummary[]; nextBeforeId: number | null }[],
    pub: UncertainWrite | null,
    rem: UncertainWrite | null,
  ) {
    if (!active({ context: ctx, epoch: account.accountEpoch })) return;
    const complete = pages.at(-1)?.nextBeforeId === null;
    if (pub?.kind === group && uncertainRef.current.publish?.request === pub.request)
      setUncertainPublish((prev) =>
        prev?.request === pub.request
          ? { ...prev, refreshStarted: true, reconciled: complete }
          : prev,
      );
    if (rem?.kind === group && uncertainRef.current.remove?.request === rem.request) {
      const present = pages.some((p) =>
        p.items.some((i) => i.kind === rem.key?.kind && i.id === rem.key?.id),
      );
      if (complete && !present && rem.key) {
        setAbsenceReceipt({ ...rem.key, removed: true, alreadyRemoved: true });
        invalidateKind(rem, false);
        setUncertainRemove((prev) => (prev?.request === rem.request ? null : prev));
      } else
        setUncertainRemove((prev) =>
          prev?.request === rem.request
            ? { ...prev, refreshStarted: true, reconciled: present }
            : prev,
        );
    }
  }
  async function fetchMine() {
    if (!ready || !signedIn || mineQuery.isFetching) return;
    const pub = uncertainPublish,
      rem = uncertainRemove;
    const result = await mineQuery.refetch();
    if (result.isSuccess) reconcilePages(result.data.pages, pub, rem);
  }
  async function loadMoreMine() {
    if (!mineQuery.hasNextPage || mineQuery.isFetching) return;
    const pub = uncertainPublish?.refreshStarted ? uncertainPublish : null;
    const rem = uncertainRemove?.refreshStarted ? uncertainRemove : null;
    const result = await mineQuery.fetchNextPage();
    if (result.isSuccess) reconcilePages(result.data.pages, pub, rem);
  }
  function resetExport() {
    prepareGeneration.current++;
    updateDraft((prev) => ({ ...EMPTY_DRAFT, generation: prev.generation + 1 }));
    if (ctx)
      void callBlueShare(() => window.blueAPI.resetBlueSharePublish(ctx, requestId())).catch(
        (err) => {
          if (active({ context: ctx })) setError(errorText(err));
        },
      );
    if (!prepareMutation.isPending) prepareMutation.reset();
    if (!publishMutation.isPending) publishMutation.reset();
  }
  async function selectLibraryItemForExport(node: LibraryBrowseNode) {
    if (
      !ctx ||
      node.key?.scope !== 'user' ||
      node.nodeKind !== 'item' ||
      !isResourceKind(node.libraryType) ||
      (uncertainPublish && (uncertainPublish.kind !== group || !uncertainPublish.reconciled))
    )
      return;
    const revision = Number(node.revision);
    if (!Number.isSafeInteger(revision) || revision < 0) return;
    const generation = ++prepareGeneration.current;
    updateDraft((prev) => ({
      ...prev,
      key: { ...node.key! },
      revision,
      reviewedName: node.displayName,
      seed: null,
      generation: prev.generation + 1,
    }));
    if (!publishMutation.isPending) publishMutation.reset();
    setUncertainPublish(null);
    try {
      await prepareMutation.mutateAsync({
        context: ctx,
        epoch: account.accountEpoch,
        generation,
        key: { scope: 'user', libraryType: node.libraryType, nodeId: node.nodeId },
        revision,
      });
    } catch {
      /* Mutation owns failure. */
    }
  }
  async function publishExport(): Promise<boolean> {
    const snapshot = draftRef.current;
    if (
      !ctx ||
      !snapshot.seed ||
      snapshot.categoryId === null ||
      busy ||
      !signedIn ||
      (uncertainPublish && (uncertainPublish.kind !== group || !uncertainPublish.reconciled))
    )
      return false;
    const request = requestId();
    submittedDraft.current = { request, draft: structuredClone(snapshot) };
    try {
      await publishMutation.mutateAsync({
        context: ctx,
        epoch: account.accountEpoch,
        kind: snapshot.seed.kind,
        request,
        token: snapshot.seed.sourceToken,
        categoryId: snapshot.categoryId,
        description: snapshot.description,
        generation: snapshot.generation,
      });
      return true;
    } catch {
      return false;
    } finally {
      if (submittedDraft.current?.request === request) submittedDraft.current = null;
    }
  }
  async function removeOwnedResource(resource: ResourceKey): Promise<boolean> {
    if (
      !ctx ||
      busy ||
      !signedIn ||
      (uncertainRemove && (uncertainRemove.kind !== group || !uncertainRemove.reconciled))
    )
      return false;
    try {
      await removeMutation.mutateAsync({
        context: ctx,
        epoch: account.accountEpoch,
        kind: resource.kind,
        key: { ...resource },
        request: requestId(),
      });
      return true;
    } catch {
      return false;
    }
  }
  async function importCurrentResource() {
    if (!ctx || !selectedResourceKey || !detailQuery.data || detailQuery.isError || busy) return;
    try {
      await importMutation.mutateAsync({ context: ctx, key: { ...selectedResourceKey } });
    } catch {
      /* Mutation owns failure. */
    }
  }
  function selectResource(resource: ResourceKey | null) {
    setSelectedResourceKey(resource);
    if (!importMutation.isPending) importMutation.reset();
  }
  function selectCategory(category: number | 'latest') {
    if (category === selectedCategory)
      void (category === 'latest' ? latestQuery.refetch() : categoryQuery.refetch());
    setSelectedCategory(category);
    selectResource(null);
  }
  function setGroup(kind: ResourceKind) {
    if (kind === group) return;
    prepareGeneration.current++;
    if (ctx) void window.blueAPI.resetBlueSharePublish?.(ctx, requestId());
    // Drafts are disposable domain state, kept outside Query. A switched-away
    // source must be reviewed again; the originating write/draft remains recoverable.
    drafts.current[group] = { ...draftRef.current, seed: null };
    groupRef.current = kind;
    const next = drafts.current[kind] ?? EMPTY_DRAFT;
    draftRef.current = next;
    setDraftState(next);
    setGroupState(kind);
    setSelectedCategory('latest');
    selectResource(null);
    ownedSelections.current[group] = selectedOwnedKey;
    setSelectedOwnedKey(
      uncertainRemove?.kind === kind
        ? (uncertainRemove.key ?? null)
        : (ownedSelections.current[kind] ?? null),
    );
    if (!prepareMutation.isPending) prepareMutation.reset();
  }
  const ownedResources = mineQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const resources =
    selectedCategory === 'latest'
      ? (latestQuery.data?.items ?? [])
      : (categoryQuery.data?.pages.flatMap((p) => p.items) ?? []);
  const currentList = selectedCategory === 'latest' ? latestQuery : categoryQuery;
  const importMatches =
    importMutation.variables?.key.id === selectedResourceKey?.id &&
    importMutation.variables?.key.kind === selectedResourceKey?.kind;
  return {
    isOpen,
    retryAccount: () => refreshAccount(),
    contextId: context?.id ?? null,
    group,
    tab,
    categories: categoriesQuery.data ?? [],
    selectedCategory,
    resources,
    nextBeforeId:
      selectedCategory === 'latest'
        ? null
        : (categoryQuery.data?.pages.at(-1)?.nextBeforeId ?? null),
    selectedResourceKey,
    selectedDetail: selectedResourceKey ? (detailQuery.data ?? null) : null,
    isOpening: isOpen && !context && !error,
    initializationFailed: isOpen && !context && !!error,
    hasLoadedCategories: categoriesQuery.isSuccess,
    hasLoadedResources: currentList.isSuccess,
    hasLoadedOwned: mineQuery.isSuccess,
    hasLoadedLibraryItems: libraryQuery.isSuccess,
    loadingCategories: categoriesQuery.isFetching,
    loadingResources:
      currentList.isFetching &&
      !('isFetchingNextPage' in currentList && currentList.isFetchingNextPage),
    loadingMore: categoryQuery.isFetchingNextPage,
    loadingDetail: !!selectedResourceKey && detailQuery.isFetching,
    isImporting: importMutation.isPending,
    importReceipt: importMatches ? (importMutation.data ?? null) : null,
    error,
    categoriesError: errorText(categoriesQuery.error),
    resourcesError: errorText(currentList.error),
    detailError: selectedResourceKey && detailQuery.error ? queryFailure(detailQuery.error) : null,
    importError: importMatches && importMutation.error ? queryFailure(importMutation.error) : null,
    ownedError: errorText(mineQuery.error),
    userLibraryError: errorText(libraryQuery.error),
    account,
    isSigningIn,
    isSigningOut,
    ownedResources,
    ownedNextBeforeId: mineQuery.data?.pages.at(-1)?.nextBeforeId ?? null,
    loadingOwned: mineQuery.isFetching && !mineQuery.isFetchingNextPage,
    loadingMoreOwned: mineQuery.isFetchingNextPage,
    selectedOwnedKey,
    isWritePending: busy,
    pendingWriteKind:
      currentPublish && publishMutation.isPending
        ? publishMutation.variables!.kind
        : currentRemove && removeMutation.isPending
          ? removeMutation.variables!.kind
          : null,
    recoveryKind: uncertainPublish?.kind ?? uncertainRemove?.kind ?? null,
    isRemoving:
      currentRemove && removeMutation.variables?.kind === group && removeMutation.isPending,
    removeReceipt:
      (absenceReceipt?.kind === group ? absenceReceipt : null) ??
      (currentRemove &&
      removeMutation.variables?.kind === group &&
      (!selectedOwnedKey || selectedOwnedKey.id === removeMutation.variables.key.id)
        ? (removeMutation.data ?? null)
        : null),
    removeUncertain: uncertainRemove?.kind === group,
    removeError:
      currentRemove &&
      removeMutation.variables?.key.kind === selectedOwnedKey?.kind &&
      removeMutation.variables?.key.id === selectedOwnedKey?.id
        ? errorText(removeMutation.error)
        : null,
    canRetryRemove: uncertainRemove?.kind === group && uncertainRemove.reconciled,
    userLibraryNodes: libraryQuery.data ?? [],
    userLibraryItems: (libraryQuery.data ?? []).filter((node) => node.nodeKind === 'item'),
    loadingLibraryItems: libraryQuery.isFetching,
    exportReviewedName: draft.reviewedName,
    exportSourceSeed: draft.seed,
    exportSelectedKey: draft.key,
    exportCategoryId: draft.categoryId,
    exportDescription: draft.description,
    isPreparingPublish: currentPrepare && prepareMutation.isPending,
    isPublishing:
      currentPublish && publishMutation.variables?.kind === group && publishMutation.isPending,
    publishReceipt:
      currentPublish && publishMutation.variables?.kind === group && !draft.key
        ? (publishMutation.data ?? null)
        : null,
    publishUncertain: uncertainPublish?.kind === group,
    publishError: errorText(
      (currentPublish && publishMutation.variables?.kind === group
        ? publishMutation.error
        : null) ?? (currentPrepare ? prepareMutation.error : null),
    ),
    canRetryPublish: uncertainPublish?.kind === group && uncertainPublish.reconciled,
    uncertainPublishName:
      uncertainPublish?.kind === group ? uncertainPublish.draft?.reviewedName : null,
    restoreUncertainPublishDraft: () => {
      if (
        uncertainPublish?.kind !== group ||
        !uncertainPublish.reconciled ||
        !uncertainPublish.draft
      )
        return;
      const saved = uncertainPublish.draft;
      updateDraft((prev) => ({
        ...structuredClone(saved),
        seed: null,
        generation: prev.generation + 1,
      }));
    },
    remoteRevocationConfirmed,
    open,
    retryOpen: () => {
      close();
      void open();
    },
    close,
    setGroup,
    setTab,
    selectCategory,
    selectResource,
    importCurrentResource,
    loadMore: async () => {
      if (categoryQuery.hasNextPage && !categoryQuery.isFetching)
        await categoryQuery.fetchNextPage();
    },
    retryCategories: () => categoriesQuery.refetch(),
    retryResources: () => currentList.refetch(),
    retryDetail: () => detailQuery.refetch(),
    retryUserLibraryItems: () => libraryQuery.refetch(),
    fetchUserLibraryItems: () => libraryQuery.refetch(),
    signIn,
    signOut,
    fetchMine,
    loadMoreMine,
    resetExport,
    selectOwnedResource: (resource: ResourceKey | null) => {
      if (!uncertainRemove || uncertainRemove.kind !== group || uncertainRemove.reconciled) {
        ownedSelections.current[group] = resource;
        setSelectedOwnedKey(resource);
        setAbsenceReceipt(null);
        if (!removeMutation.isPending) removeMutation.reset();
        if (uncertainRemove?.kind === group) setUncertainRemove(null);
      }
    },
    removeOwnedResource,
    clearRemoveReceipt: () => {
      if (!removeMutation.isPending) removeMutation.reset();
      setAbsenceReceipt(null);
    },
    openWebsite: async (purpose: 'register' | 'recover') => {
      try {
        await callBlueShare(() => window.blueAPI.openBlueShareWebsite(ctx, purpose));
      } catch (err) {
        if (active({ context: ctx })) setError(errorText(err));
      }
    },
    selectLibraryItemForExport,
    setExportCategoryId: (categoryId: number | null) =>
      updateDraft((prev) => ({ ...prev, categoryId, generation: prev.generation + 1 })),
    setExportDescription: (value: string | ((prev: string) => string)) =>
      updateDraft((prev) => ({
        ...prev,
        description: typeof value === 'string' ? value : value(prev.description),
        edited: true,
        generation: prev.generation + 1,
      })),
    publishExport,
    clearPublishReceipt: () => publishMutation.reset(),
  };
}
