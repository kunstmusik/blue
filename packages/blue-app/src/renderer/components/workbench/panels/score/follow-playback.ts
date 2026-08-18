export interface FollowScrollInput {
  isPlaybackActive: boolean;
  isFollowEnabled: boolean;
  pointerPixel: number | null;
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export function getFollowScrollTarget(input: FollowScrollInput): number | null {
  const {
    isPlaybackActive,
    isFollowEnabled,
    pointerPixel,
    scrollLeft,
    clientWidth,
    scrollWidth,
  } = input;

  if (!isPlaybackActive || !isFollowEnabled) {
    return null;
  }

  if (
    pointerPixel === null ||
    Number.isNaN(pointerPixel) ||
    !Number.isFinite(pointerPixel) ||
    pointerPixel < 0
  ) {
    return null;
  }

  if (
    !Number.isFinite(scrollLeft) ||
    scrollLeft < 0 ||
    !Number.isFinite(clientWidth) ||
    clientWidth <= 0 ||
    !Number.isFinite(scrollWidth) ||
    scrollWidth <= 0
  ) {
    return null;
  }

  const rightEdge = scrollLeft + clientWidth;
  if (pointerPixel >= scrollLeft && pointerPixel < rightEdge) {
    return null;
  }

  const maxScroll = Math.max(0, scrollWidth - clientWidth);
  return Math.max(0, Math.min(pointerPixel, maxScroll));
}
