/**
 * UDOStyle — enum for Csound User Defined Opcode declaration style.
 * Mirrors the Java UDOStyle enum.
 *
 * CLASSIC: traditional `opcode name,outTypes,inTypes` syntax
 * MODERN: newer `opcode name(args):outTypes` syntax
 */
export enum UDOStyle {
  /** Csound's positional user-defined opcode declaration syntax. */
  CLASSIC = 'CLASSIC',
  /** Csound's named-argument user-defined opcode declaration syntax. */
  MODERN = 'MODERN',
}
