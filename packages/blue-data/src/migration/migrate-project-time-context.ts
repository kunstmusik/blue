import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { TimeContext } from '../time/time-context';
import {
  checkShape,
  readBoolean,
  readInt,
  parseXmlInteger,
  parseXmlBoolean,
} from '../utilities/xml';
import { readLineXml } from '../automation/line-xml';
import { TempoMap } from '../time/tempo-map';
import { TempoPoint } from '../time/tempo-point';
import { CurveType } from '../time/curve-type';

/** Shape-selected project graph changes, independent of root sibling ordering. */
export function migrateProjectTimeContext(root: Element, context: XmlLoadContext): void {
  const oldContext = root.getElement('timeContext');
  const rootTempo = root.getElement('tempo');
  let score = root.getElement('score');
  if (!score && (oldContext || rootTempo)) {
    score = root.addElement('score');
    context.anchor(score, oldContext ?? rootTempo!);
  }
  // Validate equality with the rate field temporarily excluded; its cross-owner
  // reconciliation follows audio graph conversion.
  const comparableContext = (node: Element) => {
    const copy = node.clone();
    context.anchor(copy, node);
    copy.removeElements('sampleRate');
    return TimeContext.loadFromXML(copy, context).saveAsXML().toXml();
  };
  if (score && oldContext) {
    const current = score.getElement('timeContext');
    if (current && comparableContext(current) !== comparableContext(oldContext)) {
      throw context.at(oldContext).error({
        code: 'conflict',
        message: 'Root and Score TimeContexts disagree.',
        recovery: 'Choose one consistent timing context in a compatible editor.',
      });
    }
    if (current && oldContext.hasElement('sampleRate'))
      reconcileSampleRate(root, oldContext, context);
    root.removeElement('timeContext');
    if (!current) score.addElement(oldContext);
  }
  if (score && rootTempo) {
    if (score.hasElement('tempo'))
      throw context.at(rootTempo).error({
        code: 'conflict',
        message: 'Root and Score both declare legacy tempo.',
        recovery: 'Keep one consistent tempo source.',
      });
    score.addElement(root.removeElement('tempo')!);
  }
  if (score) migrateScoreTempo(score, context);
}

export function migrateProjectReferences(root: Element, context: XmlLoadContext): void {
  const timing = root.getElement('score')?.getElement('timeContext');
  if (timing) reconcileSampleRate(root, timing, context);
  migrateInstrumentReferences(root, context);
}

function reconcileSampleRate(root: Element, timing: Element, context: XmlLoadContext): void {
  const old = timing.getElement('sampleRate');
  if (!old) return;
  if (timing.getElements('sampleRate').size > 1)
    throw context.at(old).error({
      code: 'cardinality',
      member: 'sampleRate',
      message: 'Duplicate historical sample rate.',
      recovery: 'Keep one sample rate.',
    });
  const rate = readInt(old, context, 1);
  const props = root.getElement('projectProperties') ?? root.addElement('projectProperties');
  const current = props.getElement('sampleRate');
  if (current) {
    if (readInt(current, context, 1) !== rate)
      throw context.at(old).error({
        code: 'conflict',
        value: old.getTextString(),
        message: 'Historical sample rate conflicts with ProjectProperties.',
        recovery: 'Reconcile both sample rates in a compatible editor.',
      });
    context.at(old).diagnostic({
      code: 'P-CONTEXT-RATE',
      severity: 'warning',
      value: old.getTextString(),
      message: 'Historical sample rate duplicates the authoritative project value.',
      recovery: 'Canonical save safely omits the redundant context rate.',
    });
  } else {
    const transferred = props.addElement('sampleRate');
    transferred.setText(String(rate));
    context.anchor(transferred, old);
  }
  timing.removeElement('sampleRate');
}

function migrateScoreTempo(score: Element, context: XmlLoadContext): void {
  const tempo = score.getElement('tempo');
  if (!tempo) return;
  if (score.getElements('tempo').size > 1)
    throw context.at(tempo).error({
      code: 'cardinality',
      message: 'Duplicate legacy tempo.',
      recovery: 'Keep one tempo source.',
    });
  checkShape(tempo, [], ['enabled', 'visible', 'line'], context);
  const map = new TempoMap();
  const enabled = tempo.getElement('enabled');
  const visible = tempo.getElement('visible');
  if (enabled) map.setEnabled(readBoolean(enabled, context));
  if (visible) map.setVisible(readBoolean(visible, context));
  const line = tempo.getElement('line');
  if (line) {
    const points = readLineXml(line, context).points;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point.x < 0 || point.y <= 0 || (i > 0 && point.x === points[i - 1].x))
        throw context.at(line).error({
          code: 'value',
          message: 'Legacy tempo needs distinct nonnegative positions and positive BPM.',
          recovery: 'Correct the tempo Line before conversion.',
        });
      if (i === 0) map.setTempoPoint(0, point.x, point.y, CurveType.LINEAR);
      else map.addTempoPoint(new TempoPoint(point.x, point.y, CurveType.LINEAR));
    }
  }
  const timing = score.getElement('timeContext') ?? score.addElement('timeContext');
  const existing = timing.getElement('tempoMap');
  if (
    existing &&
    TempoMap.loadFromXML(existing, context).saveAsXML().toXml() !== map.saveAsXML().toXml()
  )
    throw context.at(tempo).error({
      code: 'conflict',
      message: 'Historical tempo conflicts with the current tempo map.',
      recovery: 'Keep one consistent tempo representation.',
    });
  if (timing.hasElement('tempo'))
    throw context.at(tempo).error({
      code: 'conflict',
      message: 'Historical tempo competes with scalar context tempo.',
      recovery: 'Keep one tempo representation.',
    });
  if (!existing) {
    const generated = map.saveAsXML();
    context.anchor(generated, line ?? tempo);
    timing.addElement(generated);
  }
  score.removeElement('tempo');
}

function migrateInstrumentReferences(root: Element, context: XmlLoadContext): void {
  const library = root.getElement('instrumentLibrary');
  const arrangement = root.getElement('arrangement');
  const assignments = arrangement?.getElements('instrumentAssignment').toArray() ?? [];
  if (!library) {
    const unresolved = assignments.find((assignment) => assignment.hasAttribute('instrumentId'));
    if (unresolved)
      throw context.at(unresolved).error({
        code: 'reference',
        member: '@instrumentId',
        value: unresolved.getAttribute('instrumentId')!,
        message: 'Historical instrument reference has no project library.',
        recovery: 'Restore the referenced instrument library or embed the instrument.',
      });
    return;
  }
  checkShape(library, [], ['instrumentCategory'], context);
  const category = library.getElement('instrumentCategory');
  if (!category)
    throw context.at(library).error({
      code: 'cardinality',
      message: 'Historical library needs a root category.',
      recovery: 'Restore the complete historical library.',
    });
  const instruments = new Set<Element>();
  const used = new Set<Element>();
  const categories = new Set<Element>();
  const usedCategories = new Set<Element>([category]);
  const validateCategory = (node: Element): void => {
    categories.add(node);
    checkShape(node, ['categoryName', 'isRoot'], ['instrumentCategory', 'instrument'], context, [
      'instrumentCategory',
      'instrument',
    ]);
    const rootFlag = node.getAttribute('isRoot');
    if (
      rootFlag !== null &&
      parseXmlBoolean(rootFlag, context.at(node), '@isRoot') !== (node === category)
    )
      throw context.at(node).error({
        code: 'value',
        member: '@isRoot',
        value: rootFlag,
        message: 'Category root flag conflicts with its structural position.',
        recovery: 'Correct the category root flag.',
      });
    for (const instrument of node.getElements('instrument')) instruments.add(instrument);
    for (const child of node.getElements('instrumentCategory')) validateCategory(child);
  };
  validateCategory(category);
  for (const assignment of assignments) {
    const reference = assignment.getAttribute('instrumentId');
    if (reference === null) continue;
    if (assignment.hasElement('instrument'))
      throw context.at(assignment).error({
        code: 'conflict',
        member: '@instrumentId',
        value: reference,
        message: 'Assignment contains both an inline instrument and a historical reference.',
        recovery: 'Choose one instrument representation.',
      });
    const tokens = reference.split(':');
    let node = category;
    for (let i = 0; i < tokens.length; i++) {
      const index = parseXmlInteger(
        tokens[i],
        context.at(assignment),
        0,
        Number.MAX_SAFE_INTEGER,
        '@instrumentId',
      );
      const candidates = node
        .getElements(i === tokens.length - 1 ? 'instrument' : 'instrumentCategory')
        .toArray();
      const next = candidates[index];
      if (!next)
        throw context.at(assignment).error({
          code: 'reference',
          member: '@instrumentId',
          value: reference,
          message: 'Historical instrument path is out of range.',
          recovery: 'Repair the category-index reference in a compatible historical editor.',
        });
      if (i < tokens.length - 1) usedCategories.add(next);
      node = next;
    }
    used.add(node);
    const copy = node.clone();
    context.anchor(copy, node);
    assignment.addElement(copy);
    assignment.removeAttribute('instrumentId');
  }
  if ([...instruments].some((instrument) => !used.has(instrument))) {
    throw context.at(library).error({
      code: 'reference',
      message: 'Historical library contains unaccounted instrument content.',
      recovery: 'Export unused instruments to a standalone library before converting this project.',
    });
  }
  // Empty named categories also carry content; do not silently discard them.
  if ([...categories].some((node) => !usedCategories.has(node))) {
    throw context.at(library).error({
      code: 'reference',
      message: 'Historical library contains unaccounted categories.',
      recovery: 'Export the library before converting this project.',
    });
  }
  root.removeElement('instrumentLibrary');
}
