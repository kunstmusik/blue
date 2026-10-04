import type { XmlDiagnostic } from '@blue/data';

export function formatXmlDiagnostics(diagnostics: readonly XmlDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const member = diagnostic.member ? ` ${diagnostic.member}` : '';
      const value = diagnostic.value !== undefined ? ` = ${JSON.stringify(diagnostic.value)}` : '';
      return `${diagnostic.source.label}: ${diagnostic.path} [${diagnostic.severity}: ${diagnostic.code}]${member}${value}\n${diagnostic.message}\n${diagnostic.recovery}`;
    })
    .join('\n\n');
}

export function formatLibraryError(error: {
  readonly message: string;
  readonly diagnostics?: readonly XmlDiagnostic[];
}): string {
  return error.diagnostics?.length ? formatXmlDiagnostics(error.diagnostics) : error.message;
}
