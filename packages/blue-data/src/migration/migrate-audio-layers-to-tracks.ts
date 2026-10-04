import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkShape } from '../utilities/xml';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { moveChildElements } from './xml-migration-utils';

interface MigrationState {
  readonly usedIds: Set<string>;
  nextGroupId: number;
  nextTrackId: number;
}

/**
 * Convert historical Audio Layer XML before normal model deserialization.
 *
 * Java and older TypeScript projects disagree slightly about whether the
 * layer container is called `audioLayers`, whether the children are named
 * `audioLayer` or `layer`, and whether an empty layer is self-closing. Keep
 * this conversion structural so all of those shapes become the one
 * canonical Track tree and a second load is a no-op.
 */
export function migrateAudioLayersToTracks(
  root: Element,
  context = new XmlLoadContext(root),
): boolean {
  const score = root.getName() === 'score' ? root : root.getElement('score');
  return score ? migrateWithinScore(score, context) : false;
}

export function migrateAudioLayersToTracksInScore(
  score: Element,
  context = new XmlLoadContext(score),
): boolean {
  return migrateWithinScore(score, context);
}

function migrateWithinScore(score: Element, context: XmlLoadContext): boolean {
  const state = createMigrationState(score);
  return migrateChildren(score, state, context);
}

function migrateChildren(parent: Element, state: MigrationState, context: XmlLoadContext): boolean {
  let changed = false;
  for (const child of parent.getElements()) {
    if (child.getName() === 'audioLayerGroup') {
      migrateGroup(child, state, context);
      changed = true;
    } else if (
      child.getName() === 'soundLayer' ||
      ((child.getName() === 'soundObject' || child.getName() === 'polyObject') &&
        ['PolyObject', 'blue.soundObject.PolyObject'].includes(child.getAttribute('type') ?? ''))
    ) {
      changed = migrateChildren(child, state, context) || changed;
    }
  }
  return changed;
}

function migrateGroup(group: Element, state: MigrationState, context: XmlLoadContext): void {
  checkShape(
    group,
    ['name', 'uniqueId'],
    ['defaultHeightIndex', 'audioLayers', 'tracks', 'audioLayer', 'layer'],
    context,
    ['audioLayer', 'layer'],
  );
  const legacyLayers = group
    .getElements()
    .toArray()
    .flatMap((child) =>
      ['audioLayers', 'tracks'].includes(child.getName())
        ? child.getElements().toArray()
        : ['audioLayer', 'layer'].includes(child.getName())
          ? [child]
          : [],
    );
  for (const container of group.getElements()) {
    if (['audioLayers', 'tracks'].includes(container.getName()))
      checkShape(container, [], ['audioLayer', 'layer', 'track'], context, [
        'audioLayer',
        'layer',
        'track',
      ]);
  }
  for (const layer of legacyLayers) {
    if (layer.getName() === 'track') continue;
    checkShape(
      layer,
      [
        'name',
        'uniqueId',
        'muted',
        'solo',
        'heightIndex',
        'customHeight',
        'automationSelectedIndex',
      ],
      ['backgroundColor', 'audioClip', 'parameterId', 'noteProcessorChain'],
      context,
      ['audioClip', 'parameterId'],
    );
    const processors = layer.getElement('noteProcessorChain');
    if (processors) {
      if (layer.getName() === 'track') validateTrackProcessorChain(layer, context);
      else checkShape(processors, [], [], context);
    }
  }
  for (const tracks of group.getElements('tracks')) {
    for (const track of tracks.getElements('track')) validateTrackContent(track, context);
  }
  group.setName('trackLayerGroup');
  ensureUniqueId(group, 'group', state);

  const legacyContainer = group.getElement('audioLayers');
  const canonicalContainer = group.getElement('tracks');
  const tracks = canonicalContainer ?? legacyContainer ?? group.addElement('tracks');
  if (tracks !== canonicalContainer) tracks.setName('tracks');

  // Some transitional writers emitted both containers. Fold the legacy
  // validated children into the canonical one so no supported clip disappears.
  if (canonicalContainer && legacyContainer) {
    moveChildElements(legacyContainer, tracks);
    group.removeElement('audioLayers');
  }

  // A few historical writers emitted audioLayer children directly under the
  // group. Move those nodes into the canonical container while retaining the
  // order of the validated legacy layer nodes.
  const directLegacyLayers = group
    .getElements()
    .toArray()
    .filter(
      (child) =>
        child !== tracks && (child.getName() === 'audioLayer' || child.getName() === 'layer'),
    );
  for (const layer of directLegacyLayers) {
    group.removeElement(layer.getName());
    tracks.addElement(layer);
  }

  for (const child of tracks.getElements().toArray()) {
    if (
      child.getName() !== 'audioLayer' &&
      child.getName() !== 'layer' &&
      child.getName() !== 'track'
    ) {
      continue;
    }
    child.setName('track');
    ensureUniqueId(child, 'track', state);

    if (!child.hasElement('noteProcessorChain')) child.addElement('noteProcessorChain');
  }
}

function validateTrackProcessorChain(track: Element, context: XmlLoadContext): void {
  const processors = track.getElement('noteProcessorChain');
  if (processors) NoteProcessorChain.loadFromXML(processors, context.at(processors));
}

function validateTrackContent(track: Element, context: XmlLoadContext): void {
  checkShape(
    track,
    ['name', 'muted', 'solo', 'heightIndex', 'customHeight', 'uniqueId', 'automationSelectedIndex'],
    [
      'backgroundColor',
      'noteProcessorChain',
      'instrument',
      'audioClip',
      'soundObject',
      'parameterId',
    ],
    context,
    ['audioClip', 'soundObject', 'parameterId'],
  );
  validateTrackProcessorChain(track, context);
}

function createMigrationState(root: Element): MigrationState {
  const usedIds = new Set<string>();
  collectCanonicalIds(root, usedIds, false);
  return { usedIds, nextGroupId: 1, nextTrackId: 1 };
}

function collectCanonicalIds(element: Element, usedIds: Set<string>, insideLegacy: boolean): void {
  const legacy =
    insideLegacy || element.getName() === 'audioLayerGroup' || element.getName() === 'audioLayer';
  if (!legacy) {
    const id = element.getAttributeValue('uniqueId')?.trim();
    if (id) usedIds.add(id);
  }
  for (const child of element.getElements()) collectCanonicalIds(child, usedIds, legacy);
}

function ensureUniqueId(element: Element, kind: 'group' | 'track', state: MigrationState): string {
  const existing = element.getAttributeValue('uniqueId')?.trim() ?? '';
  if (existing && !state.usedIds.has(existing)) {
    state.usedIds.add(existing);
    element.setAttribute('uniqueId', existing);
    return existing;
  }

  let candidate = '';
  do {
    const sequence = kind === 'group' ? state.nextGroupId++ : state.nextTrackId++;
    candidate = `migrated-${kind}-${sequence}`;
  } while (state.usedIds.has(candidate));
  state.usedIds.add(candidate);
  element.setAttribute('uniqueId', candidate);
  return candidate;
}
