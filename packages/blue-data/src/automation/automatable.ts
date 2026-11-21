/**
 * Automatable — interface for objects that support automation.
 * Mirrors the Java Automatable interface.
 */
import { ParameterIdList } from './parameter-id-list';

/** Model exposing the parameter identifiers available for automation. */
export interface Automatable {
  /** Returns the collection of associated automation parameter IDs. */
  getAutomationParameters(): ParameterIdList;
}
