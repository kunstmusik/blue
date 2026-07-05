import { useState, useCallback, useRef } from 'react';
import type { ScoreObjectLocationRef } from './types';

export interface ScorePathSegment {
  groupId: string | null;
  label: string;
  location?: ScoreObjectLocationRef;
}

interface ScorePathSession {
  activeGroupId: string | null;
  segments: ScorePathSegment[];
  scrollByGroupId: Record<string, { x: number; y: number }>;
}

function createInitialSession(): ScorePathSession {
  return {
    activeGroupId: null,
    segments: [{ groupId: null, label: 'Root' }],
    scrollByGroupId: {},
  };
}

export function useScorePathState() {
  const [session, setSession] = useState<ScorePathSession>(createInitialSession);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const saveCurrentScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const key = session.activeGroupId ?? '__root__';
    setSession((prev) => ({
      ...prev,
      scrollByGroupId: {
        ...prev.scrollByGroupId,
        [key]: { x: container.scrollLeft, y: container.scrollTop },
      },
    }));
  }, [session.activeGroupId]);

  const restoreScroll = useCallback((groupId: string | null) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const key = groupId ?? '__root__';
    requestAnimationFrame(() => {
      const pos = session.scrollByGroupId[key];
      if (pos) {
        container.scrollLeft = pos.x;
        container.scrollTop = pos.y;
      } else {
        container.scrollLeft = 0;
        container.scrollTop = 0;
      }
    });
  }, [session.scrollByGroupId]);

  const navigateToGroup = useCallback((groupId: string, label: string, location?: ScoreObjectLocationRef) => {
    setSession((prev) => {
      // No-op when the target group is already active: avoids stacking
      // duplicate breadcrumb segments on repeated double-clicks and keeps the
      // navigation state stable.
      if (prev.activeGroupId === groupId) {
        return prev;
      }
      return {
        ...prev,
        activeGroupId: groupId,
        segments: [...prev.segments, { groupId, label, location }],
      };
    });
    saveCurrentScroll();
    restoreScroll(groupId);
  }, [saveCurrentScroll, restoreScroll]);

  const navigateToRoot = useCallback(() => {
    saveCurrentScroll();
    setSession((prev) => ({
      ...prev,
      activeGroupId: null,
      segments: [{ groupId: null, label: 'Root' }],
    }));
    restoreScroll(null);
  }, [saveCurrentScroll, restoreScroll]);

  const navigateToSegment = useCallback((segmentIndex: number) => {
    const segment = session.segments[segmentIndex];
    if (!segment) return;
    saveCurrentScroll();
    setSession((prev) => ({
      ...prev,
      activeGroupId: segment.groupId,
      segments: prev.segments.slice(0, segmentIndex + 1),
    }));
    restoreScroll(segment.groupId);
  }, [session.segments, saveCurrentScroll, restoreScroll]);

  const resetSession = useCallback(() => {
    setSession(createInitialSession());
  }, []);

  return {
    session,
    scrollContainerRef,
    navigateToGroup,
    navigateToRoot,
    navigateToSegment,
    resetSession,
  };
}
