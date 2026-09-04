import { Element } from '../serialization/xml-reader';
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
export function migrateAudioLayersToTracks(root: Element): boolean {
  const score = findFirstElement(root, 'score');
  return score ? migrateWithinScore(score) : false;
}

export function migrateAudioLayersToTracksInScore(score: Element): boolean {
  return migrateWithinScore(score);
}

function migrateWithinScore(score: Element): boolean {
  const state = createMigrationState(score);
  return migrateChildren(score, state);
}

function migrateChildren(parent: Element, state: MigrationState): boolean {
  let changed = false;
  for (const child of parent.getElements().toArray()) {
    if (child.getName() === 'audioLayerGroup') {
      migrateGroup(child, state);
      changed = true;
      // Unknown descendants may themselves contain an old group. Walk them
      // after normalizing the outer group without treating the new `tracks`
      // container as a legacy boundary.
      changed = migrateChildren(child, state) || changed;
      continue;
    }
    changed = migrateChildren(child, state) || changed;
  }
  return changed;
}

function migrateGroup(group: Element, state: MigrationState): void {
  group.setName('trackLayerGroup');
  ensureUniqueId(group, 'group', state);

  const legacyContainer = group.getElement('audioLayers');
  const canonicalContainer = group.getElement('tracks');
  const tracks = canonicalContainer ?? legacyContainer ?? group.addElement('tracks');
  if (tracks !== canonicalContainer) tracks.setName('tracks');

  // Some transitional writers emitted both containers. Fold the legacy
  // children into the canonical one so no clip or unknown child disappears.
  if (canonicalContainer && legacyContainer) {
    moveChildElements(legacyContainer, tracks);
    group.removeElement('audioLayers');
  }

  // A few historical writers emitted audioLayer children directly under the
  // group. Move those nodes into the canonical container while retaining the
  // order of the legacy layer nodes and leaving unrelated siblings alone.
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

    // Audio layers never had a Track-owned instrument or Track processor
    // chain. Replacing recognized nodes guarantees the migrated state is
    // empty while preserving all unrelated XML siblings for later handling.
    child.removeElements('instrument');
    child.removeElements('noteProcessorChain');
    child.addElement('noteProcessorChain');
  }
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

function findFirstElement(root: Element, name: string): Element | null {
  if (root.getName() === name) return root;
  for (const child of root.getElements()) {
    const found = findFirstElement(child, name);
    if (found) return found;
  }
  return null;
}
