import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { parseXmlBoolean, parseXmlNumber } from '../utilities/xml';
import { isValidPanLawDb } from '../mixer/channel-pan';

/** Project-owned relocation; both persisted representations are validated before precedence. */
export function migrateProjectPanning(root: Element, context: XmlLoadContext): void {
  const score = root.getElement('score');
  let mixer = root.getElement('mixer');
  for (const member of ['panningEnabled', 'panLawDb', 'panOffCenterBoost'] as const) {
    const parse = (element: Element, text: string): boolean | number => {
      const at = context.at(element);
      if (member !== 'panLawDb') return parseXmlBoolean(text, at, `@${member}`);
      const value = parseXmlNumber(text, at, `@${member}`);
      if (!isValidPanLawDb(value))
        throw at.error({
          code: 'value',
          member: `@${member}`,
          value: text,
          message: 'Unsupported pan law.',
          recovery: 'Use 0, -3, -4.5 or -6 dB.',
        });
      return value;
    };
    const old = score?.getAttribute(member);
    const current = mixer?.getAttribute(member);
    const oldValue = old != null ? parse(score!, old) : undefined;
    const currentValue = current != null ? parse(mixer!, current) : undefined;
    if (oldValue === undefined) continue;
    if (currentValue !== undefined && currentValue !== oldValue)
      context.at(score!).diagnostic({
        code: 'P-PANNING-PRECEDENCE',
        severity: 'warning',
        member: `@${member}`,
        value: old!,
        message: 'Mixer panning overrides a differing historical Score value.',
        recovery:
          'Canonical save retains the Mixer value under the documented per-field precedence rule.',
      });
    if (currentValue === undefined) {
      if (!mixer) {
        mixer = root.addElement('mixer');
        // Preserve the omitted-Mixer legacy defaults when synthesizing its canonical owner.
        mixer.addElement('enabled').setText('false');
        mixer.addElement('enableMeters').setText('false');
        context.anchor(mixer, score!);
      }
      mixer.setAttribute(member, String(oldValue));
    }
    score!.removeAttribute(member);
  }
}
