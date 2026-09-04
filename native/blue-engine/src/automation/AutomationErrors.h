#pragma once

#include <cstdint>

namespace blue {

/**
 * Stable recoverable diagnostic categories for exact-decimal automation.
 *
 * These categories (not Java exception text) cross the engine boundary. Control-plane
 * diagnostics reject the requested mutation; audio-time diagnostics preserve
 * the last written channel value and increment a preallocated counter without
 * allocating, blocking, throwing, or logging.
 */
enum class AutomationDiagnostic : uint8_t {
    None = 0,
    /** Decimal text rejected by the Java BigDecimal(String) grammar. */
    InvalidDecimalSyntax = 1,
    /** Parsed decimal scale outside the signed 32-bit range. */
    DecimalScaleOverflow = 2,
    /** A non-finite double reached a path that requires an exact decimal. */
    NonFiniteAutomationInput = 3,
    /** An automation command payload failed structural validation. */
    AutomationPayloadInvalid = 4,
    /** The prepared exact-decimal workspace could not be established. */
    DecimalWorkspaceUnavailable = 5,
    /** An audio-time evaluation produced an invalid exact-decimal result. */
    DecimalEvaluationInvalid = 6,
};

inline const char* automationDiagnosticName(AutomationDiagnostic diagnostic) {
    switch (diagnostic) {
        case AutomationDiagnostic::None:
            return "NONE";
        case AutomationDiagnostic::InvalidDecimalSyntax:
            return "INVALID_DECIMAL_SYNTAX";
        case AutomationDiagnostic::DecimalScaleOverflow:
            return "DECIMAL_SCALE_OVERFLOW";
        case AutomationDiagnostic::NonFiniteAutomationInput:
            return "NON_FINITE_AUTOMATION_INPUT";
        case AutomationDiagnostic::AutomationPayloadInvalid:
            return "AUTOMATION_PAYLOAD_INVALID";
        case AutomationDiagnostic::DecimalWorkspaceUnavailable:
            return "DECIMAL_WORKSPACE_UNAVAILABLE";
        case AutomationDiagnostic::DecimalEvaluationInvalid:
            return "DECIMAL_EVALUATION_INVALID";
    }
    return "UNKNOWN";
}

}  // namespace blue
