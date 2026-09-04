/**
 * ScoreObject — interface for objects that can be placed in a score layer.
 * Mirrors the Java ScoreObject interface.
 *
 * ScoreObjects have temporal positioning (start time, duration) and visual
 * properties (background color). They are the building blocks of score layers.
 */
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeContext } from '../time/time-context';

export interface ScoreObject {
  /** Get the name of this score object. */
  getName(): string;
  /** Set the name of this score object. */
  setName(value: string): void;

  /** Get the start time position. */
  getStartTime(): TimePosition;
  /** Set the start time position. */
  setStartTime(value: TimePosition): void;

  /** Get the subjective duration (how long it appears in the score view). */
  getSubjectiveDuration(): TimeDuration;
  /** Set the subjective duration. */
  setSubjectiveDuration(value: TimeDuration): void;

  /** Get the background color for UI display (RGB integer). */
  getBackgroundColor(): number;
  /** Set the background color for UI display (RGB integer). */
  setBackgroundColor(color: number): void;

  /**
   * Get the resize limits for this object.
   * Returns [leftLimit, rightLimit] in beats.
   */
  getResizeLeftLimits(context: TimeContext): number[];
  getResizeRightLimits(context: TimeContext): number[];

  /** Resize the left edge to the new start time. */
  resizeLeft(context: TimeContext, newStartTime: number): void;
  /** Resize the right edge to the new end time. */
  resizeRight(context: TimeContext, newEndTime: number): void;

  /** Get the clone source hash code (for copy tracking). */
  getCloneSourceHashCode(): number;
}
