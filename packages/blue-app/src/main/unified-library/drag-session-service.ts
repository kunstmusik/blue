import { randomUUID } from 'node:crypto';
import type { LibraryDragDescriptor, LibraryItemKey } from '../../shared/unified-library';

export interface LibraryDragSessionSource {
  readonly key: LibraryItemKey;
  readonly revision: number | string;
}

interface LibraryDragSession extends LibraryDragSessionSource {
  readonly expiresAt: number;
  readonly onCancel?: () => void;
  claimed: boolean;
}

export class LibraryDragSessionService {
  private readonly sessions = new Map<string, LibraryDragSession>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 60_000,
  ) {}

  begin(
    key: LibraryItemKey,
    revision: number | string,
    dragSessionId: string = randomUUID(),
    onCancel?: () => void,
  ): LibraryDragDescriptor {
    this.sessions.set(dragSessionId, {
      key,
      revision,
      expiresAt: this.now() + this.ttlMs,
      onCancel,
      claimed: false,
    });
    return { dragSessionId, libraryType: key.libraryType };
  }

  resolve(dragSessionId: string, currentRevision: number | string): LibraryDragSessionSource {
    const session = this.sessions.get(dragSessionId);
    if (!session || session.expiresAt <= this.now()) {
      this.sessions.delete(dragSessionId);
      throw new Error('Drag session expired');
    }
    if (String(session.revision) !== String(currentRevision)) {
      throw new Error('Library source changed during the drag');
    }
    return { key: session.key, revision: session.revision };
  }

  peek(dragSessionId: string): LibraryDragSessionSource | null {
    const session = this.sessions.get(dragSessionId);
    if (!session || session.expiresAt <= this.now()) {
      this.sessions.delete(dragSessionId);
      return null;
    }
    return { key: session.key, revision: session.revision };
  }

  claim(dragSessionId: string): LibraryDragSessionSource {
    const session = this.sessions.get(dragSessionId);
    if (!session || session.expiresAt <= this.now()) {
      this.sessions.delete(dragSessionId);
      throw new Error('Drag session expired');
    }
    session.claimed = true;
    return { key: session.key, revision: session.revision };
  }

  consume(dragSessionId: string, currentRevision: number | string): LibraryDragSessionSource {
    const source = this.resolve(dragSessionId, currentRevision);
    this.sessions.delete(dragSessionId);
    return source;
  }

  cancel(dragSessionId: string): void {
    const session = this.sessions.get(dragSessionId);
    if (session?.claimed) return;
    this.discard(dragSessionId);
  }

  discard(dragSessionId: string): void {
    const session = this.sessions.get(dragSessionId);
    this.sessions.delete(dragSessionId);
    session?.onCancel?.();
  }
}
