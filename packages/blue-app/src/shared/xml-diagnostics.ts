import type { XmlDiagnostic } from '@blue/data';

export const PROJECT_MESSAGES_TAB = 'Project Messages';

/** Group repeated explanations while keeping every source location and value. */
export function formatProjectMessages(diagnostics: readonly XmlDiagnostic[]): string {
  const groups = new Map<string, XmlDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.source.label,
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.recovery,
    ]);
    const group = groups.get(key);
    if (group) group.push(diagnostic);
    else groups.set(key, [diagnostic]);
  }
  return (
    [...groups.values()]
      .map((group, index) => {
        const first = group[0];
        return [
          `${index + 1}. ${first.message}`,
          first.recovery,
          `Source: ${first.source.label}`,
          `${first.severity}: ${first.code} (${group.length} location${group.length === 1 ? '' : 's'})`,
          ...group.map((diagnostic) => {
            const member = diagnostic.member ? ` — ${diagnostic.member}` : '';
            const value =
              diagnostic.value !== undefined ? ` = ${JSON.stringify(diagnostic.value)}` : '';
            return `  ${diagnostic.path}${member}${value}`;
          }),
        ].join('\n');
      })
      .join('\n\n') + '\n\n'
  );
}

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
