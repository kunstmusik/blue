import { parse } from 'parse5';

export function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

// Use source offsets to retain the renderer's HTML and inline scripts verbatim.
export function decorateEditionHtml(
  html,
  { filename, sourceSha, label, banner, footer = '', stylesheet },
) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const root = document.childNodes.find((node) => node.tagName === 'html');
  const head = root?.childNodes.find((node) => node.tagName === 'head');
  const body = root?.childNodes.find((node) => node.tagName === 'body');
  const headEnd = head?.sourceCodeLocation?.endTag?.startOffset;
  const bodyStart = body?.sourceCodeLocation?.startTag?.endOffset;
  const bodyEnd = body?.sourceCodeLocation?.endTag?.startOffset;
  if (headEnd === undefined || bodyStart === undefined || bodyEnd === undefined) {
    throw new Error(`Rendered page is missing explicit head or body tags: ${filename}`);
  }
  if (
    head.childNodes.some(
      (node) =>
        node.tagName === 'meta' &&
        node.attrs.some(
          ({ name, value }) => name === 'name' && value.toLowerCase() === 'blue-source-sha',
        ),
    )
  ) {
    throw new Error(`Rendered page already contains source metadata: ${filename}`);
  }

  return [
    html.slice(0, headEnd),
    `\n<meta name="blue-source-sha" content="${escapeHtml(sourceSha)}">\n`,
    `<meta name="blue-edition-label" content="${escapeHtml(label)}">\n`,
    stylesheet && `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">\n`,
    html.slice(headEnd, bodyStart),
    `\n${banner}\n`,
    html.slice(bodyStart, bodyEnd),
    footer && `\n${footer}\n`,
    html.slice(bodyEnd),
  ].join('');
}
