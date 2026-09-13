/**
 * Parse the permissive flag syntax used by repository verification scripts.
 *
 * @param {string[]} argv
 * @param {{ acceptEmptyValues?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function parseFlags(argv, { acceptEmptyValues = true } = {}) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--') && (acceptEmptyValues || next.length > 0)) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = 'true';
    }
  }
  return flags;
}
