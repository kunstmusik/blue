import { QueryClient } from '@tanstack/react-query';
import {
  isBlueShareError,
  type BlueShareError,
  type BlueShareResult,
  type ResourceKind,
} from '../../../shared/blueshare';

export function createBlueShareQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        networkMode: 'always',
        gcTime: 0,
        staleTime: 30000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
      },
      mutations: { retry: false, networkMode: 'always', gcTime: 0 },
    },
  });
}

export function blueShareKey(
  scope: string | null,
  context: string | null,
  operation: string,
  kind?: ResourceKind,
  selection?: number | string | null,
  account?: { id: string; epoch: number },
) {
  return [
    'blueshare',
    scope,
    context,
    operation,
    kind ?? null,
    selection ?? null,
    account?.id ?? null,
    account?.epoch ?? null,
  ] as const;
}

export class BlueShareQueryError extends Error {
  readonly failure: BlueShareError;
  constructor(failure: BlueShareError) {
    super(failure.message);
    this.name = 'BlueShareQueryError';
    // Never retain the original IPC object or an exception/body in either cache.
    this.failure = structuredClone(failure);
  }
}

export function unwrapBlueShare<T>(result: BlueShareResult<T> | undefined): T {
  if (result?.ok === true) return result.value;
  throw new BlueShareQueryError(
    result?.ok === false && isBlueShareError(result.error)
      ? result.error
      : {
          code: 'boundary_contract_violation',
          message: 'Invalid BlueShare response',
          outcome: 'rejected',
        },
  );
}

export async function readBlueShare<T>(
  signal: AbortSignal,
  read: () => Promise<BlueShareResult<T>>,
): Promise<T> {
  signal.throwIfAborted();
  const result = await callBlueShare(read);
  signal.throwIfAborted(); // Suppress observation; IPC itself has already been dispatched.
  return result;
}

export async function callBlueShare<T>(invoke: () => Promise<BlueShareResult<T>>): Promise<T> {
  try {
    return unwrapBlueShare(await invoke());
  } catch (error) {
    if (error instanceof BlueShareQueryError) throw error;
    throw new BlueShareQueryError({
      code: 'ipc_failure',
      message: 'BlueShare request failed',
      outcome: 'unknown',
    });
  }
}
