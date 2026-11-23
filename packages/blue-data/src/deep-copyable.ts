/**
 * Copy mode used during cloning / deep-copy traversals.
 * - 'duplication': creates a new distinct model entity (e.g. duplicating a track or widget),
 *   generating new unique IDs and remapping dependent IDs where appropriate.
 * - 'history': creates an isolated canonical clone for project transaction history / mementos,
 *   preserving all original unique IDs, widget IDs, parameter IDs, and references without remapping.
 */
export type CopyMode = 'duplication' | 'history';

/**
 * DeepCopyable interface — any type that can produce a deep copy of itself.
 * Mirrors the Java DeepCopyable<T> interface.
 */
export interface DeepCopyable<T> {
  /** Copies the object. Duplication creates new identities where applicable, and history copies preserve them. */
  deepCopy(mode?: CopyMode): T;
}

/**
 * HistoryCopyable interface — any type that can produce an identity-preserving
 * canonical copy of itself for transaction history.
 */
export interface HistoryCopyable<T> {
  /** Creates a copy for history that retains the identities used to match existing objects. */
  historyCopy(): T;
}
