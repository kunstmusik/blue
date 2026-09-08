import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell } from 'electron';
import {
  DEFAULT_CSOUND_MANUAL_URL,
  deriveCsoundManualTargetUrl,
  validateAndNormalizeCsoundManualRoot,
  validateManualId,
  type ManualAvailability,
  type OpenCsoundManualRequest,
  type OpenCsoundManualResult,
} from '../shared/csound-manual';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';

export interface CsoundManualServiceDependencies {
  readonly getProgramSettings: () => Promise<ProgramSettingsSnapshot> | ProgramSettingsSnapshot;
  readonly openExternal?: (url: string) => Promise<void>;
  readonly openPath?: (filePath: string) => Promise<string>;
  readonly fetch?: typeof globalThis.fetch;
  readonly access?: (path: string, mode?: number) => Promise<void>;
  readonly preflightTimeoutMs?: number;
}

export interface CsoundManualService {
  openManual(request: unknown): Promise<OpenCsoundManualResult>;
}

export function createCsoundManualService(
  dependencies: CsoundManualServiceDependencies,
): CsoundManualService {
  const preflightTimeoutMs = dependencies.preflightTimeoutMs ?? 3000;
  const openExternalFn =
    dependencies.openExternal ??
    (async (url: string) => {
      await shell.openExternal(url);
    });
  const openPathFn =
    dependencies.openPath ??
    (async (filePath: string) => {
      return await shell.openPath(filePath);
    });
  const fetchFn = dependencies.fetch ?? globalThis.fetch;
  const accessFn = dependencies.access ?? fs.promises.access;

  return {
    async openManual(request: unknown): Promise<OpenCsoundManualResult> {
      if (!request || typeof request !== 'object' || !('manualId' in request)) {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-request',
          message: 'Invalid request: manualId is required',
        };
      }

      const rawId = (request as OpenCsoundManualRequest).manualId;
      const idValidation = validateManualId(rawId);
      if (!idValidation.valid) {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-request',
          message: idValidation.error ?? 'Invalid manual ID',
        };
      }

      let settings: ProgramSettingsSnapshot;
      try {
        settings = await dependencies.getProgramSettings();
      } catch {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-setting',
          message: 'Failed to retrieve program settings',
        };
      }

      const rawRoot = settings?.general?.csoundManualUrl ?? DEFAULT_CSOUND_MANUAL_URL;
      const rootValidation = validateAndNormalizeCsoundManualRoot(rawRoot);
      if (!rootValidation.valid || !rootValidation.normalizedUrl) {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-setting',
          message: rootValidation.error ?? 'Invalid Csound manual root URL',
        };
      }

      const normalizedRoot = rootValidation.normalizedUrl;
      const derivation = deriveCsoundManualTargetUrl(normalizedRoot, rawId);
      if (!derivation.valid) {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-request',
          message: derivation.error,
        };
      }

      const targetUrl = derivation.targetUrl;
      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        return {
          disposition: 'fallback',
          availability: 'indeterminate',
          reason: 'invalid-request',
          message: 'Malformed target URL',
        };
      }

      if (parsedTarget.protocol === 'https:') {
        let availability: ManualAvailability = 'indeterminate';
        let status: number | undefined;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), preflightTimeoutMs);

        try {
          const response = await fetchFn(targetUrl, {
            method: 'HEAD',
            signal: controller.signal,
          });
          status = response.status;
        } catch {
          // Transport error, timeout, abort, etc. remain indeterminate
        } finally {
          clearTimeout(timer);
        }

        if (status === 404 || status === 410) {
          return {
            disposition: 'fallback',
            availability: 'missing',
            reason: 'missing',
            targetUrl,
            message: `Csound manual entry not found (${status})`,
          };
        }

        if (status !== undefined && status >= 200 && status < 400) {
          availability = 'available';
        } else {
          availability = 'indeterminate';
        }

        try {
          await openExternalFn(targetUrl);
          return {
            disposition: 'opened',
            availability,
            targetUrl,
          };
        } catch {
          return {
            disposition: 'fallback',
            availability,
            reason: 'open-failed',
            targetUrl,
            message: 'Failed to open Csound manual in external application',
          };
        }
      }

      if (parsedTarget.protocol === 'file:') {
        let targetFilePath: string;
        let rootFilePath: string;

        try {
          targetFilePath = fileURLToPath(targetUrl);
          rootFilePath = fileURLToPath(normalizedRoot);
        } catch {
          return {
            disposition: 'fallback',
            availability: 'indeterminate',
            reason: 'invalid-setting',
            message: 'Failed to convert Csound manual file URL to a native path',
          };
        }

        const resolvedRoot = path.resolve(rootFilePath);
        const resolvedTarget = path.resolve(targetFilePath);
        const relative = path.relative(resolvedRoot, resolvedTarget);

        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          return {
            disposition: 'fallback',
            availability: 'indeterminate',
            reason: 'invalid-request',
            message: 'Target path escapes root directory',
          };
        }

        const entryHtmlPath = path.join(resolvedTarget, 'index.html');

        try {
          await accessFn(entryHtmlPath, fs.constants.R_OK);
        } catch (error) {
          const errCode = (error as NodeJS.ErrnoException)?.code;
          const isMissing =
            errCode === 'ENOENT' || (error instanceof Error && error.message.includes('ENOENT'));
          if (isMissing) {
            return {
              disposition: 'fallback',
              availability: 'missing',
              reason: 'missing',
              targetUrl,
              message: `Local manual entry not found: ${rawId}`,
            };
          }
          return {
            disposition: 'fallback',
            availability: 'indeterminate',
            reason: 'probe-failed',
            targetUrl,
            message:
              'Unable to access local Csound manual entry due to filesystem permissions or I/O error',
          };
        }

        try {
          const openError = await openPathFn(entryHtmlPath);
          if (openError) {
            return {
              disposition: 'fallback',
              availability: 'available',
              reason: 'open-failed',
              targetUrl,
              message: 'Failed to open local Csound manual in external application',
            };
          }

          return {
            disposition: 'opened',
            availability: 'available',
            targetUrl,
          };
        } catch {
          return {
            disposition: 'fallback',
            availability: 'available',
            reason: 'open-failed',
            targetUrl,
            message: 'Failed to open local Csound manual in external application',
          };
        }
      }

      return {
        disposition: 'fallback',
        availability: 'indeterminate',
        reason: 'invalid-setting',
        message: `Unsupported protocol: ${parsedTarget.protocol}`,
      };
    },
  };
}
