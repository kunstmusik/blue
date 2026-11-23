/**
 * FieldType — determines how field values are stored.
 */
export enum FieldType {
  /** Numeric field whose values are represented as integers. */
  DISCRETE = 'DISCRETE',
  /** Numeric field that retains fractional values. */
  CONTINUOUS = 'CONTINUOUS',
}
