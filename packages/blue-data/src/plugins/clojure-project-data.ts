import type { BlueDataObject } from '../blue-data-object';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readText } from '../utilities/xml';

/** Java-compatible XML type name for Clojure project settings. */
export const CLOJURE_PROJECT_DATA_BDO_TYPE = 'blue.clojure.project.ClojureProjectData';

export class ClojureLibraryEntry implements BlueDataObject {
  private dependencyCoordinates = 'org/library-name';
  private version = '1.0.0';

  /** Creates a default Clojure library entry or copies a supplied instance. */
  constructor(other?: ClojureLibraryEntry) {
    if (other) {
      this.dependencyCoordinates = other.dependencyCoordinates;
      this.version = other.version;
    }
  }

  /** Returns the dependency coordinates stored on the Clojure library entry. */
  getDependencyCoordinates(): string {
    return this.dependencyCoordinates;
  }

  /** Sets the dependency coordinates stored on the Clojure library entry. */
  setDependencyCoordinates(coordinates: string): void {
    this.dependencyCoordinates = coordinates;
  }

  /** Returns the version stored on the Clojure library entry. */
  getVersion(): string {
    return this.version;
  }

  /** Sets the version stored on the Clojure library entry. */
  setVersion(version: string): void {
    this.version = version;
  }

  /** Reconstructs the Clojure library entry from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): ClojureLibraryEntry {
    checkRoot(data, 'clojureLibraryEntry', context);
    checkShape(data, [], ['coordinates', 'version'], context);
    const entry = new ClojureLibraryEntry();
    const coordinates = data.getElement('coordinates');
    const version = data.getElement('version');
    if (coordinates) entry.setDependencyCoordinates(readText(coordinates, context));
    if (version) entry.setVersion(readText(version, context));
    return entry;
  }

  saveAsXML(): Element {
    const element = new Element('clojureLibraryEntry');
    element.addElement('coordinates').setText(this.getDependencyCoordinates());
    element.addElement('version').setText(this.getVersion());
    return element;
  }

  deepCopy(): BlueDataObject {
    return new ClojureLibraryEntry(this);
  }
}

export class ClojureProjectData implements BlueDataObject {
  private libraryEntries: ClojureLibraryEntry[] = [];

  /** Creates a default Clojure project data or copies a supplied instance. */
  constructor(other?: ClojureProjectData) {
    if (other) {
      this.libraryEntries = other.libraryEntries.map(
        (entry) => entry.deepCopy() as ClojureLibraryEntry,
      );
    }
  }

  /** Returns the library entries stored on the Clojure project data. */
  getLibraryEntries(): ClojureLibraryEntry[] {
    return this.libraryEntries;
  }

  /** Replaces the configured Clojure library entries. */
  setLibraryEntries(entries: ClojureLibraryEntry[]): void {
    this.libraryEntries = [...entries];
  }

  /** Adds a dependency entry to the project's Clojure configuration. */
  addLibraryEntry(entry: ClojureLibraryEntry): void {
    this.libraryEntries.push(entry);
  }

  /** Formats the configured dependencies as a Clojure vector for Pomegranate. */
  getPomegranateString(): string | null {
    const filtered = this.libraryEntries.filter(
      (entry) =>
        entry.getDependencyCoordinates().trim().length > 0 && entry.getVersion().trim().length > 0,
    );

    if (filtered.length === 0) {
      return null;
    }

    let builder = "(use '[cemerick.pomegranate :only (add-dependencies)])\n";
    builder += "(add-dependencies :coordinates '[";

    for (const entry of filtered) {
      builder += `[${entry.getDependencyCoordinates()} "${entry.getVersion()}" :exclusions [org.clojure/clojure]]\n`;
    }

    builder += '] :repositories (merge ';
    builder += 'cemerick.pomegranate.aether/maven-central ';
    builder += '{"clojars" "https://repo.clojars.org"}))';

    return builder;
  }

  /** Reconstructs the Clojure project data from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): ClojureProjectData {
    checkShape(data, ['bdoType'], ['clojureLibraryEntry'], context, ['clojureLibraryEntry']);
    if (!isClojureProjectDataElement(data))
      throw context.at(data).error({
        code: 'type',
        member: '@bdoType',
        value: data.getAttribute('bdoType') ?? '',
        message: 'Unsupported project plugin type.',
        recovery: 'Use a supported Clojure project payload.',
      });
    const projectData = new ClojureProjectData();
    for (const node of data.getElements('clojureLibraryEntry'))
      projectData.addLibraryEntry(ClojureLibraryEntry.loadFromXML(node, context));
    return projectData;
  }

  saveAsXML(): Element {
    const element = new Element('blueDataObject');
    element.setAttribute('bdoType', CLOJURE_PROJECT_DATA_BDO_TYPE);

    for (const entry of this.libraryEntries) {
      element.addElement(entry.saveAsXML());
    }

    return element;
  }

  deepCopy(): BlueDataObject {
    return new ClojureProjectData(this);
  }
}

export function isClojureProjectDataElement(element: Element | null): boolean {
  return (
    element !== null &&
    element.getName() === 'blueDataObject' &&
    element.getAttribute('bdoType') === CLOJURE_PROJECT_DATA_BDO_TYPE
  );
}

/** Finds the Clojure settings element among the project's plug-in XML entries. */
export function findClojureProjectDataElement(pluginDataXml: Element[]): Element | null {
  return pluginDataXml.find((element) => isClojureProjectDataElement(element)) ?? null;
}

/** Reads Clojure settings from the project's plug-in XML, if present. */
export function loadClojureProjectDataFromPluginData(
  pluginDataXml: Element[],
): ClojureProjectData | null {
  const element = findClojureProjectDataElement(pluginDataXml);
  return element ? ClojureProjectData.loadFromXML(element) : null;
}

/** Updates the Clojure settings while carrying forward other plug-in XML entries. */
export function replaceClojureProjectDataInPluginData(
  pluginDataXml: Element[],
  projectData: ClojureProjectData | null,
): Element[] {
  const nextPluginData: Element[] = pluginDataXml
    .filter((element) => !isClojureProjectDataElement(element))
    .map((element) => element.clone());

  if (projectData) {
    nextPluginData.push(projectData.saveAsXML());
  }

  return nextPluginData;
}
