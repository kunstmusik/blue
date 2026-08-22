/**
 * Converts Csound f-statement text into gi_ ftgen statements.
 * Ported verbatim from Java Blue FTableConverterDialog.java.
 */
export function convertFTableToFtgen(text: string): string {
  const lines = text.split('\n');
  const buffer: string[] = [];

  for (const s of lines) {
    const fIndex = s.indexOf('f');
    if (fIndex < 0) {
      buffer.push('');
      continue;
    }

    let line = s.substring(fIndex + 1);

    const commentIndex = line.indexOf(';');
    let comment = '';
    if (commentIndex >= 0) {
      comment = '\t' + line.substring(commentIndex);
      line = line.substring(0, commentIndex);
    }

    line = line.trim();

    const pfields = line.split(/\s+/);
    const startLine = 'gi_\tftgen 0';
    let newLine = startLine;

    for (let j = 1; j < pfields.length; j += 1) {
      if (pfields[j]) {
        newLine += ', ' + pfields[j];
      }
    }

    if (newLine === startLine) {
      newLine = '';
    }

    buffer.push(newLine + comment);
  }

  return buffer.join('\n');
}
