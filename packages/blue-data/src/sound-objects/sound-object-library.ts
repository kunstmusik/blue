/**
 * SoundObjectLibrary — library of reusable sound objects.
 * Mirrors the Java SoundObjectLibrary class.
 *
 * Stores sound objects with stable objRefId values for cross-reference
 * resolution (e.g., Instance sound objects reference library entries by id).
 */
import { SoundObject } from './sound-object';
import { Instance } from './instance';
import { PolyObject } from './poly-object';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';
import { loadSoundObjectFromXML } from './sound-object-registry';

export interface SoundObjectLibraryEntry {
  libraryId: string;
  object: SoundObject;
}

export interface SoundObjectFingerprint {
  canonicalHash: string;
  displayName: string;
  objectType: string;
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export class SoundObjectLibrary implements BlueDataObject {
  private _objects: SoundObject[] = [];
  private _idMap = new Map<SoundObject, string>();
  private _nextId = 0;

  constructor(other?: SoundObjectLibrary, mode: CopyMode = 'duplication') {
    if (other) {
      for (const obj of other._objects) {
        const copy = obj.deepCopy(mode);
        this._objects.push(copy);
        const id = other._idMap.get(obj);
        if (id) {
          this._idMap.set(copy, id);
        }
      }
      this._nextId = other._nextId;
    }
  }

  addObject(obj: SoundObject): string {
    const id = this.generateId();
    this._objects.push(obj);
    this._idMap.set(obj, id);
    return id;
  }

  getObject(index: number): SoundObject | undefined {
    return this._objects[index];
  }

  getObjectById(id: string, objRefMap?: ObjRefLoadMap): SoundObject | undefined {
    if (objRefMap) {
      const obj = objRefMap.get(id);
      if (obj && obj instanceof Object && 'generateForCSD' in obj) {
        return obj as SoundObject;
      }
    }
    for (const [obj, lid] of this._idMap) {
      if (lid === id) return obj;
    }
    return undefined;
  }

  getAllObjects(): SoundObject[] {
    return [...this._objects];
  }

  size(): number {
    return this._objects.length;
  }

  removeObject(index: number): boolean {
    if (index < 0 || index >= this._objects.length) return false;
    const obj = this._objects[index];
    this._objects.splice(index, 1);
    this._idMap.delete(obj);
    return true;
  }

  removeObjectById(id: string): boolean {
    const index = this._objects.findIndex((object) => this._idMap.get(object) === id);
    return this.removeObject(index);
  }

  replaceObjectById(id: string, replacement: SoundObject): boolean {
    const index = this._objects.findIndex((object) => this._idMap.get(object) === id);
    if (index < 0) return false;
    const previous = this._objects[index];
    this._objects[index] = replacement;
    this._idMap.delete(previous);
    this._idMap.set(replacement, id);
    return true;
  }

  getEntries(): SoundObjectLibraryEntry[] {
    return this._objects.map((obj, i) => ({
      libraryId: this._idMap.get(obj) ?? `lib_${i}`,
      object: obj,
    }));
  }

  findIdForObject(object: SoundObject): string | null {
    return this._idMap.get(object) ?? null;
  }

  containsObject(object: SoundObject): boolean {
    return this._idMap.has(object);
  }

  createFingerprint(object: SoundObject): SoundObjectFingerprint {
    return {
      canonicalHash: hashText(object.saveAsXML().toXml()),
      displayName: object.getName(),
      objectType: object.constructor.name,
    };
  }

  findUniqueByFingerprint(fingerprint: SoundObjectFingerprint): SoundObject | undefined {
    const matches = this._objects.filter((object) => {
      const candidate = this.createFingerprint(object);
      return (
        candidate.canonicalHash === fingerprint.canonicalHash &&
        candidate.displayName === fingerprint.displayName &&
        candidate.objectType === fingerprint.objectType
      );
    });
    return matches.length === 1 ? matches[0] : undefined;
  }

  checkAndAddInstanceSoundObjects(instanceSoundObjects: Instance[]): void {
    const originalToCopyMap = new Map<SoundObject, SoundObject>();

    for (const instance of instanceSoundObjects) {
      const instanceSObj = instance.getSoundObject();
      if (!instanceSObj) continue;

      const existingId = this.findIdForObject(instanceSObj);
      if (existingId) {
        instance.setLibraryId(existingId);
        continue;
      }

      let copy = originalToCopyMap.get(instanceSObj);
      if (!copy) {
        copy = instanceSObj.deepCopy();
        const libraryId = this.addObject(copy);
        originalToCopyMap.set(instanceSObj, copy);
        instance.setLibraryId(libraryId);
      } else {
        const libraryId = this.findIdForObject(copy);
        if (libraryId) instance.setLibraryId(libraryId);
      }
      instance.setSoundObject(copy);
    }
  }

  private generateId(): string {
    let id: string;
    do id = `lib_${this._nextId++}`;
    while ([...this._idMap.values()].includes(id));
    return id;
  }

  // ─── XML ───

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const map = objRefMap ?? new ObjRefSaveMap();
    const entries = this._objects.map((object) => {
      const id = this._idMap.get(object);
      if (!id) throw new Error('Project library object has no stable identity.');
      map.seed(object, id);
      return { object, id };
    });
    const root = new Element('soundObjectLibrary');
    for (const { object, id } of entries) {
      const payload = object.saveAsXML(map);
      payload.setAttribute('objRefId', id);
      root.addElement(payload);
    }
    return root;
  }

  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): SoundObjectLibrary {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'soundObjectLibrary', context);
    checkShape(data, [], ['soundObject'], context, ['soundObject']);
    const nodes = data.getElements('soundObject').toArray();
    const ids = new Set<string>();
    const library = new SoundObjectLibrary();
    for (const node of nodes) {
      const id = node.getAttribute('objRefId');
      if (id !== null) {
        if (!id.trim() || ids.has(id))
          throw context.at(node).error({
            code: 'reference',
            member: '@objRefId',
            value: id,
            message: 'Project library ID is empty or duplicated.',
            recovery: 'Supply distinct nonempty object IDs.',
          });
        ids.add(id);
        const match = /^lib_(\d+)$/.exec(id);
        const number = match ? Number(match[1]) : NaN;
        if (Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER - 1)
          library._nextId = Math.max(library._nextId, number + 1);
      }
    }
    const stableIds = nodes.map((node) => {
      const explicit = node.getAttribute('objRefId');
      if (explicit !== null) return explicit;
      let generated: string;
      do generated = library.generateId();
      while (ids.has(generated));
      ids.add(generated);
      return generated;
    });
    const map = new ObjRefLoadMap();
    const values: Array<SoundObject | undefined> = new Array(nodes.length);
    const loading = new Set<number>();
    const resolve = (index: number): SoundObject => {
      const existing = values[index];
      if (existing) return existing;
      const node = nodes[index];
      if (loading.has(index))
        throw context.at(node).error({
          code: 'reference',
          member: '@objRefId',
          value: stableIds[index],
          message: 'Cyclic project library reference.',
          recovery: 'Remove the cycle in a compatible editor.',
        });
      loading.add(index);
      const payload = node.clone();
      payload.removeAttribute('objRefId');
      context.anchor(payload, node);
      const object = loadSoundObjectFromXML(payload, map, context);
      values[index] = object;
      loading.delete(index);
      return object;
    };
    for (let index = 0; index < nodes.length; index++)
      map.registerLoader(stableIds[index], () => resolve(index));
    for (let index = 0; index < nodes.length; index++) {
      if (!nodes[index].hasAttribute('objRefId')) {
        const historical = String(index);
        if (map.has(historical))
          throw context.at(nodes[index]).error({
            code: 'reference',
            value: historical,
            message: 'Historical library index conflicts with an explicit ID.',
            recovery: 'Supply explicit nonconflicting library identities.',
          });
        map.registerLoader(historical, () => resolve(index));
      }
    }
    for (let index = 0; index < nodes.length; index++) {
      const object = resolve(index);
      library._objects.push(object);
      library._idMap.set(object, stableIds[index]);
    }
    while (ids.has(`lib_${library._nextId}`)) library._nextId++;
    if (!providedContext) requireXmlValue(context.result(library), sink);
    // Publish reference identities only after every nested owner accepted.
    if (objRefMap)
      for (let index = 0; index < nodes.length; index++) {
        objRefMap.register(stableIds[index], values[index]!);
        if (!nodes[index].hasAttribute('objRefId'))
          objRefMap.register(String(index), values[index]!);
      }
    return library;
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    return new SoundObjectLibrary(this, mode);
  }
}

export function collectInstanceSoundObjects(sObjs: SoundObject[]): Instance[] {
  const instances: Instance[] = [];
  for (const sObj of sObjs) {
    if (sObj instanceof Instance) {
      instances.push(sObj);
    } else if (sObj instanceof PolyObject) {
      instances.push(...collectInstanceSoundObjects(sObj.getSoundObjects(true)));
    }
  }
  return instances;
}
