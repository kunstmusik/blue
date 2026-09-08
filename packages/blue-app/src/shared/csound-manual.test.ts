import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CSOUND_MANUAL_URL,
  deriveCsoundManualTargetUrl,
  normalizeCsoundManualRoot,
  validateAndNormalizeCsoundManualRoot,
  validateManualId,
} from './csound-manual';

describe('csound-manual contracts and validation', () => {
  describe('DEFAULT_CSOUND_MANUAL_URL', () => {
    it('defaults to https://csound.com/manual', () => {
      expect(DEFAULT_CSOUND_MANUAL_URL).toBe('https://csound.com/manual');
    });
  });

  describe('validateAndNormalizeCsoundManualRoot', () => {
    it('accepts valid https: URLs', () => {
      const result = validateAndNormalizeCsoundManualRoot('https://csound.com/manual');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://csound.com/manual');
    });

    it('accepts valid file: URLs', () => {
      const result = validateAndNormalizeCsoundManualRoot('file:///Users/stevenyi/csound-manual');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('file:///Users/stevenyi/csound-manual');
    });

    it('trims surrounding whitespace', () => {
      const result = validateAndNormalizeCsoundManualRoot('  https://csound.com/manual   ');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://csound.com/manual');
    });

    it('strips trailing slashes from the pathname', () => {
      const httpsResult = validateAndNormalizeCsoundManualRoot('https://csound.com/manual/');
      expect(httpsResult.valid).toBe(true);
      expect(httpsResult.normalizedUrl).toBe('https://csound.com/manual');

      const multipleSlashes = validateAndNormalizeCsoundManualRoot('https://csound.com/manual///');
      expect(multipleSlashes.valid).toBe(true);
      expect(multipleSlashes.normalizedUrl).toBe('https://csound.com/manual');

      const fileResult = validateAndNormalizeCsoundManualRoot('file:///path/to/manual/');
      expect(fileResult.valid).toBe(true);
      expect(fileResult.normalizedUrl).toBe('file:///path/to/manual');
    });

    it('accepts synthetic Windows drive-letter file URLs', () => {
      const result = validateAndNormalizeCsoundManualRoot('file:///C:/Users/name/manual/');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('file:///C:/Users/name/manual');
    });

    it('accepts synthetic Windows UNC-shaped file URLs', () => {
      const result = validateAndNormalizeCsoundManualRoot('file://server/share/manual/');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('file://server/share/manual');
    });

    it('rejects empty or non-string inputs', () => {
      expect(validateAndNormalizeCsoundManualRoot('')).toMatchObject({ valid: false });
      expect(validateAndNormalizeCsoundManualRoot('   ')).toMatchObject({ valid: false });
      expect(validateAndNormalizeCsoundManualRoot(null)).toMatchObject({ valid: false });
      expect(validateAndNormalizeCsoundManualRoot(undefined)).toMatchObject({ valid: false });
      expect(validateAndNormalizeCsoundManualRoot(123)).toMatchObject({ valid: false });
    });

    it('rejects relative URLs or unparseable inputs', () => {
      expect(validateAndNormalizeCsoundManualRoot('/relative/path')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('manual/docs')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('not a url')).toMatchObject({
        valid: false,
      });
    });

    it('rejects unsupported protocols including http:', () => {
      expect(validateAndNormalizeCsoundManualRoot('http://csound.com/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('ftp://example.com/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('javascript:alert(1)')).toMatchObject({
        valid: false,
      });
    });

    it('rejects URLs containing credentials', () => {
      expect(
        validateAndNormalizeCsoundManualRoot('https://user:pass@csound.com/manual'),
      ).toMatchObject({ valid: false });
      expect(validateAndNormalizeCsoundManualRoot('https://user@csound.com/manual')).toMatchObject({
        valid: false,
      });
    });

    it('rejects URLs containing query parameters or fragments', () => {
      expect(validateAndNormalizeCsoundManualRoot('https://csound.com/manual?tab=1')).toMatchObject(
        { valid: false },
      );
      expect(
        validateAndNormalizeCsoundManualRoot('https://csound.com/manual#section'),
      ).toMatchObject({ valid: false });
    });

    it('rejects URLs missing authority slashes', () => {
      expect(validateAndNormalizeCsoundManualRoot('file:relative/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('https:example.com/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('FILE:relative/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('HTTPS:example.com/manual')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('FILE:///C:/Csound/manual')).toMatchObject({
        valid: true,
      });
    });

    it('rejects URLs with malformed percent-encoding or lone surrogates', () => {
      expect(validateAndNormalizeCsoundManualRoot('https://csound.com/manual%ZZ')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('https://csound.com/manual%')).toMatchObject({
        valid: false,
      });
      expect(validateAndNormalizeCsoundManualRoot('https://csound.com/\uD800')).toMatchObject({
        valid: false,
      });
    });
  });

  describe('normalizeCsoundManualRoot', () => {
    it('returns normalized URL if valid, or trimmed string if invalid', () => {
      expect(normalizeCsoundManualRoot('  https://csound.com/manual/  ')).toBe(
        'https://csound.com/manual',
      );
      expect(normalizeCsoundManualRoot('  invalid  ')).toBe('invalid');
    });
  });

  describe('validateManualId', () => {
    it('accepts standard single-segment identifiers', () => {
      expect(validateManualId('oscili')).toEqual({ valid: true });
      expect(validateManualId('poscil3')).toEqual({ valid: true });
      expect(validateManualId('table_read')).toEqual({ valid: true });
      expect(validateManualId('fl-slider')).toEqual({ valid: true });
    });

    it('rejects non-strings and empty values', () => {
      expect(validateManualId('')).toMatchObject({ valid: false });
      expect(validateManualId('   ')).toMatchObject({ valid: false });
      expect(validateManualId(null)).toMatchObject({ valid: false });
      expect(validateManualId(undefined)).toMatchObject({ valid: false });
    });

    it('rejects forward and backward slashes', () => {
      expect(validateManualId('foo/bar')).toMatchObject({ valid: false });
      expect(validateManualId('/oscili')).toMatchObject({ valid: false });
      expect(validateManualId('oscili/')).toMatchObject({ valid: false });
      expect(validateManualId('foo\\bar')).toMatchObject({ valid: false });
      expect(validateManualId('\\oscili')).toMatchObject({ valid: false });
    });

    it('rejects control characters and lone surrogates', () => {
      expect(validateManualId('oscili\x00')).toMatchObject({ valid: false });
      expect(validateManualId('oscili\n')).toMatchObject({ valid: false });
      expect(validateManualId('oscili\t')).toMatchObject({ valid: false });
      expect(validateManualId('oscili\uD800')).toMatchObject({ valid: false });
      expect(validateManualId('\uDFFF')).toMatchObject({ valid: false });
    });

    it('rejects dot segments and traversal attempts', () => {
      expect(validateManualId('.')).toMatchObject({ valid: false });
      expect(validateManualId('..')).toMatchObject({ valid: false });
      expect(validateManualId('../oscili')).toMatchObject({ valid: false });
      expect(validateManualId('..\\oscili')).toMatchObject({ valid: false });
      expect(validateManualId('oscili/..')).toMatchObject({ valid: false });
    });

    it('rejects percent-encoded traversal and separator attempts', () => {
      expect(validateManualId('%2e%2e')).toMatchObject({ valid: false });
      expect(validateManualId('foo%2fbar')).toMatchObject({ valid: false });
      expect(validateManualId('foo%5cbar')).toMatchObject({ valid: false });
      expect(validateManualId('foo%00bar')).toMatchObject({ valid: false });
    });
  });

  describe('deriveCsoundManualTargetUrl', () => {
    it('derives https: target URL for valid root and manual ID', () => {
      const result = deriveCsoundManualTargetUrl('https://csound.com/manual', 'oscili');
      expect(result).toEqual({
        valid: true,
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
    });

    it('normalizes trailing slash on root when deriving target', () => {
      const result = deriveCsoundManualTargetUrl('https://csound.com/manual/', 'oscili');
      expect(result).toEqual({
        valid: true,
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
    });

    it('derives file: target URL for local manual root', () => {
      const result = deriveCsoundManualTargetUrl('file:///opt/csound/manual/', 'oscili');
      expect(result).toEqual({
        valid: true,
        targetUrl: 'file:///opt/csound/manual/opcodes/oscili/',
      });
    });

    it('derives target URL for synthetic Windows drive and UNC roots', () => {
      const driveResult = deriveCsoundManualTargetUrl('file:///C:/Csound/manual', 'oscili');
      expect(driveResult).toEqual({
        valid: true,
        targetUrl: 'file:///C:/Csound/manual/opcodes/oscili/',
      });

      const uncResult = deriveCsoundManualTargetUrl('file://server/share/manual', 'oscili');
      expect(uncResult).toEqual({
        valid: true,
        targetUrl: 'file://server/share/manual/opcodes/oscili/',
      });
    });

    it('safely encodes characters in valid manual IDs', () => {
      const result = deriveCsoundManualTargetUrl('https://csound.com/manual', 'custom opcode');
      expect(result).toEqual({
        valid: true,
        targetUrl: 'https://csound.com/manual/opcodes/custom%20opcode/',
      });
    });

    it('rejects derivation when root is invalid', () => {
      const result = deriveCsoundManualTargetUrl('http://insecure.com', 'oscili');
      expect(result).toMatchObject({ valid: false });
    });

    it('rejects derivation when manual ID is invalid or attempts traversal', () => {
      expect(deriveCsoundManualTargetUrl('https://csound.com/manual', '..')).toMatchObject({
        valid: false,
      });
      expect(deriveCsoundManualTargetUrl('https://csound.com/manual', 'foo/bar')).toMatchObject({
        valid: false,
      });
      expect(deriveCsoundManualTargetUrl('https://csound.com/manual', '%2e%2e')).toMatchObject({
        valid: false,
      });
    });
  });
});
