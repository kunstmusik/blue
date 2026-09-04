/**
 * Stable recoverable diagnostic categories for exact-decimal automation.
 *
 * These categories (not Java exception text) cross package/engine boundaries
 * and mirror `native/blue-engine/src/automation/AutomationErrors.h`.
 * Control-plane diagnostics reject the requested mutation; audio-time
 * diagnostics preserve the last written channel value and increment a
 * preallocated counter without allocating, blocking, or logging.
 */

export type AutomationDiagnosticCode =
  | 'INVALID_DECIMAL_SYNTAX'
  | 'DECIMAL_SCALE_OVERFLOW'
  | 'NON_FINITE_AUTOMATION_INPUT'
  | 'AUTOMATION_PAYLOAD_INVALID'
  | 'DECIMAL_WORKSPACE_UNAVAILABLE'
  | 'DECIMAL_EVALUATION_INVALID';

export interface AutomationDiagnostic {
  readonly code: AutomationDiagnosticCode;
  readonly message: string;
}

export const AUTOMATION_DIAGNOSTIC_CODES: readonly AutomationDiagnosticCode[] = [
  'INVALID_DECIMAL_SYNTAX',
  'DECIMAL_SCALE_OVERFLOW',
  'NON_FINITE_AUTOMATION_INPUT',
  'AUTOMATION_PAYLOAD_INVALID',
  'DECIMAL_WORKSPACE_UNAVAILABLE',
  'DECIMAL_EVALUATION_INVALID',
];

export function isAutomationDiagnosticCode(value: unknown): value is AutomationDiagnosticCode {
  return (
    typeof value === 'string' && (AUTOMATION_DIAGNOSTIC_CODES as readonly string[]).includes(value)
  );
}
