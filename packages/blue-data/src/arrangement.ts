/**
 * Arrangement — maps instruments to instrument IDs for CSD generation.
 * Mirrors the Java Arrangement class.
 *
 * The Arrangement holds a list of InstrumentAssignments, each linking an
 * instrument from the InstrumentLibrary to a specific instrument ID in the
 * generated CSD.
 */
import { InstrumentAssignment } from "./instruments/instrument-assignment";
import { Instrument } from "./instruments/instrument";
import { CompileData } from "./compile-data";
import { Parameter } from "./automation/parameter";
import { replaceAll, stripSingleLineComments } from "./utilities/text";
import { Element } from "./serialization/xml-reader";
import { Mixer } from "./mixer/mixer";
import { Channel } from "./mixer/channel";
import { Tables } from "./tables";

export class Arrangement {
  private arrangement: InstrumentAssignment[] = [];

  constructor(other?: Arrangement) {
    if (other) {
      for (const ia of other.arrangement) {
        this.arrangement.push(new InstrumentAssignment(ia));
      }
    }
  }

  // ─── Instrument management ───

  addInstrument(instrument: Instrument, instrumentId?: string): number {
    const id = instrumentId || this.getNextInstrumentId();
    const ia = new InstrumentAssignment();
    ia.arrangementId = id;
    ia.instr = instrument;
    this.arrangement.push(ia);
    this.sort();
    return this.arrangement.length;
  }

  addInstrumentAtEnd(instrument: Instrument): number {
    let max = 0;

    for (const ia of this.arrangement) {
      const numericId = parseNumericArrangementId(ia.arrangementId);
      if (numericId !== null && numericId > max) {
        max = numericId;
      }
    }

    const nextId = max + 1;
    const ia = new InstrumentAssignment();
    ia.arrangementId = String(nextId);
    ia.instr = instrument;
    this.arrangement.push(ia);

    return nextId;
  }

  addInstrumentWithId(instrument: Instrument, instrumentId: string, sort = true): void {
    const ia = new InstrumentAssignment();
    ia.arrangementId = instrumentId;
    ia.instr = instrument;
    this.arrangement.push(ia);

    if (sort) {
      this.sort();
    }
  }

  size(): number {
    return this.arrangement.length;
  }

  getInstrumentId(index: number): string {
    return this.arrangement[index]?.arrangementId ?? "";
  }

  getInstrument(index: number): Instrument {
    return this.arrangement[index]?.instr;
  }

  getInstrumentById(id: string): Instrument | undefined {
    return this.arrangement.find((ia) => ia.arrangementId === id)?.instr;
  }

  getArrangement(): InstrumentAssignment[] {
    return [...this.arrangement];
  }

  clearUnusedInstrAssignments(): void {
    this.arrangement = this.arrangement.filter((ia) => ia.enabled);
  }

  removeInstrument(index: number): Instrument | null {
    return this.arrangement.splice(index, 1)[0]?.instr ?? null;
  }

  removeInstrumentById(arrangementId: string): Instrument | null {
    const index = this.arrangement.findIndex((ia) => ia.arrangementId === arrangementId);
    if (index < 0) return null;
    return this.removeInstrument(index);
  }

  replaceInstrument(arrangementId: string, instrument: Instrument): boolean {
    const assignment = this.arrangement.find((ia) => ia.arrangementId === arrangementId);
    if (!assignment) return false;
    assignment.instr = instrument;
    return true;
  }

  updateAssignment(
    arrangementId: string,
    patch: { enabled?: boolean; nextArrangementId?: string },
  ): boolean {
    const assignment = this.arrangement.find((ia) => ia.arrangementId === arrangementId);
    if (!assignment) return false;
    let changed = false;
    if (patch.enabled !== undefined && assignment.enabled !== patch.enabled) {
      assignment.enabled = patch.enabled;
      changed = true;
    }
    if (patch.nextArrangementId !== undefined && patch.nextArrangementId.trim()) {
      const nextArrangementId = patch.nextArrangementId.trim();
      const duplicate = this.arrangement.some(
        (ia) => ia !== assignment && ia.arrangementId === nextArrangementId,
      );
      if (!duplicate && assignment.arrangementId !== nextArrangementId) {
        assignment.arrangementId = nextArrangementId;
        this.sort();
        changed = true;
      }
    }
    return changed;
  }

  getNextInstrumentId(): string {
    let max = 0;
    for (const ia of this.arrangement) {
      const numericId = parseNumericArrangementId(ia.arrangementId);
      if (numericId !== null) {
        max = Math.max(max, numericId);
      }
    }
    return String(max + 1);
  }

  private sort(): void {
    this.arrangement.sort((a, b) => a.compareTo(b));
  }

  // ─── CSD Generation ───

  /**
   * Generate the orchestra section from all enabled instruments.
   * Skips assignments where the instrument reference is not resolved
   * (this happens when loading from XML without a library second-pass).
   *
   * @param compileData - Shared compilation context
   * @param parameterMap - Optional map from instrument to its Parameter[] for automation
   */
  generateOrchestra(
    compileData: CompileData,
    mixer?: Mixer,
    nchnls = 2,
    parameterMap?: Map<Instrument, Parameter[]>,
  ): string {
    const buffer: string[] = [];

    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue; // Skip unresolved instrument references

      // Get parameters for this instrument if available
      const instrParams = parameterMap?.get(ia.instr);

      // Use parameter-aware generateInstrument if parameters are available
      let instrumentText: string;
      if (
        instrParams &&
        typeof (ia.instr as any).generateInstrument === "function"
      ) {
        instrumentText = (ia.instr as any).generateInstrument(instrParams);
      } else {
        instrumentText = ia.instr.generateInstrument();
      }
      if (!instrumentText) continue;

      // Transform instrument text with arrangement ID substitution
      let transformed = this.replaceInstrumentId(
        ia.arrangementId,
        instrumentText,
      );

      // Handle blueMixerOut → outc conversion
      transformed = this.convertBlueMixerOut(
        compileData,
        mixer,
        ia.arrangementId,
        transformed,
        nchnls,
      );

      // Java CSDRender appends "\n" after transformed text:
      // buffer.append(transformed).append("\n");
      // This ensures endin is on its own line
      if (!transformed.endsWith("\n")) {
        transformed += "\n";
      }
      if (!transformed.endsWith("\n\n")) {
        transformed += "\n";
      }

      buffer.push(`\tinstr ${ia.arrangementId}\t;${ia.instr.getName()}\n`);
      buffer.push(transformed);
      buffer.push("\tendin\n\n");
    }

    return buffer.join("");
  }

  async generateOrchestraAsync(
    compileData: CompileData,
    mixer?: Mixer,
    nchnls = 2,
    parameterMap?: Map<Instrument, Parameter[]>,
  ): Promise<string> {
    const buffer: string[] = [];

    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue;

      const instrParams = parameterMap?.get(ia.instr);
      let instrumentText = await ia.instr.generateInstrumentAsync(compileData, instrParams);
      if (!instrumentText) continue;

      let transformed = this.replaceInstrumentId(
        ia.arrangementId,
        instrumentText,
      );

      transformed = this.convertBlueMixerOut(
        compileData,
        mixer,
        ia.arrangementId,
        transformed,
        nchnls,
      );

      if (!transformed.endsWith("\n")) {
        transformed += "\n";
      }
      if (!transformed.endsWith("\n\n")) {
        transformed += "\n";
      }

      buffer.push(`\tinstr ${ia.arrangementId}\t;${ia.instr.getName()}\n`);
      buffer.push(transformed);
      buffer.push("\tendin\n\n");
    }

    return buffer.join("");
  }

  /**
   * Generate global orchestra code from all instruments.
   */
  generateGlobalOrc(compileData: CompileData): string {
    const buffer: string[] = [];
    const seenInstruments = new Set<Instrument>();

    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue; // Skip unresolved instrument references
      if (seenInstruments.has(ia.instr)) continue;
      const globalOrc = ia.instr.generateGlobalOrc();
      if (globalOrc) {
        const assignmentId = compileData.getInstrSourceId(ia.instr) ?? ia.arrangementId;
        buffer.push(this.replaceInstrumentId(assignmentId, globalOrc));
      }
      seenInstruments.add(ia.instr);
    }

    return buffer.join("\n");
  }

  /**
   * Generate global score code from all enabled instruments.
   */
  generateGlobalSco(compileData: CompileData): string {
    const buffer: string[] = [];

    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue;
      const globalSco = ia.instr.generateGlobalSco();
      if (globalSco) {
        const assignmentId = compileData.getInstrSourceId(ia.instr) ?? ia.arrangementId;
        buffer.push(this.replaceInstrumentId(assignmentId, globalSco));
      }
    }

    return buffer.join("\n");
  }

  /**
   * Generate any compile-time ftables used by enabled instruments.
   */
  generateFTables(tables: Tables): void {
    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue;
      ia.instr.generateFTables(tables);
    }
  }

  generateUserDefinedOpcodes(udoList: unknown): void {
    for (const ia of this.arrangement) {
      if (!ia.enabled) continue;
      if (!ia.instr) continue;
      ia.instr.generateUserDefinedOpcodes(udoList);
    }
  }

  private replaceInstrumentId(arrangementId: string, input: string): string {
    let replacementId: string;
    const numId = parseInt(arrangementId, 10);
    if (!isNaN(numId)) {
      replacementId = numId.toString();
    } else {
      replacementId = `"${arrangementId}"`;
    }

    let transformed = replaceAll(input, "<INSTR_ID>", replacementId);
    transformed = replaceAll(transformed, "<INSTR_NAME>", arrangementId);
    return transformed;
  }

  private convertBlueMixerOut(
    compileData: CompileData,
    mixer: Mixer | undefined,
    arrangementId: string,
    input: string,
    nchnls: number,
  ): string {
    if (!input.includes("blueMixerOut") && !input.includes("blueMixerIn")) {
      return input;
    }

    const buffer: string[] = [];
    const lines = input.split(/\r?\n/);
    let blueMixerInFound = false;

    for (const line of lines) {
      const mixerInIndex = line.indexOf("blueMixerIn");

      if (mixerInIndex > 0) {
        const noCommentLine = stripSingleLineComments(line);
        if (!noCommentLine.includes("blueMixerIn")) {
          buffer.push(line);
          continue;
        }

        if (!mixer?.isEnabled()) {
          throw new Error(
            "Error: Instrument uses blueMixerIn but mixer is not enabled",
          );
        }

        blueMixerInFound = true;
        const argText = noCommentLine.substring(0, mixerInIndex).trim();
        const args = argText.split(",");
        const channel = this.getChannelForArrangementId(mixer, arrangementId);

        for (let i = 0; i < nchnls && i < args.length; i++) {
          const arg = args[i].trim();
          const variable = this.getMixerVariable(
            compileData,
            mixer,
            channel,
            i,
          );
          buffer.push(`${arg} = ${variable}`);
        }

        continue;
      }

      if (line.trim().startsWith("blueMixerOut")) {
        const argText = line.trim().substring(12);
        const args = argText.split(",");
        const firstArg = args[0]?.trim() ?? "";

        if (/^".*"$/.test(firstArg)) {
          if (!mixer?.isEnabled()) {
            buffer.push(`outc ${args.slice(1).join(",")}`);
            continue;
          }

          const subChannelName = firstArg.substring(1, firstArg.length - 1);
          const subChannel = Array.from(mixer.getSubChannels()).find(
            (channel) => subChannelName === channel.getName(),
          );

          if (!subChannel) {
            throw new Error(
              `Unable to find subchannel with name: ${subChannelName}`,
            );
          }

          mixer.addSubChannelDependency(subChannelName);

                for (let i = 1; i < nchnls + 1 && i < args.length; i++) {
                  const arg = args[i] ?? "";
            const variable = Mixer.getSubChannelVar(subChannelName, i - 1);
            const operator = blueMixerInFound ? "=" : "+=";
            buffer.push(`${variable} ${operator} ${arg}`);
          }

          continue;
        }

        if (!mixer?.isEnabled()) {
          buffer.push(line.replaceAll("blueMixerOut", "outc"));
          continue;
        }

        const channel = this.getChannelForArrangementId(mixer, arrangementId);
        for (let i = 0; i < nchnls && i < args.length; i++) {
          const arg = args[i] ?? "";
          const variable = this.getMixerVariable(
            compileData,
            mixer,
            channel,
            i,
          );
          const operator = blueMixerInFound ? "=" : "+=";
          buffer.push(`${variable} ${operator} ${arg}`);
        }

        continue;
      }

      buffer.push(line);
    }

    return buffer.join("\n");
  }

  private getChannelForArrangementId(
    mixer: Mixer,
    arrangementId: string,
  ): Channel | undefined {
    return mixer
      .getAllSourceChannels()
      .find((channel) => channel.getName() === arrangementId);
  }

  private getMixerVariable(
    compileData: CompileData,
    mixer: Mixer,
    channel: Channel | undefined,
    outputIndex: number,
  ): string {
    if (!channel) {
      return Mixer.getSubChannelVar(Mixer.MASTER_CHANNEL, outputIndex);
    }

    const channelId = compileData.getChannelIdAssignments().get(channel);
    if (typeof channelId !== "number") {
      throw new Error(
        `Unable to find mixer channel assignment for channel: ${channel.getName()}`,
      );
    }

    return Mixer.getChannelVar(channelId, outputIndex);
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element("arrangement");
    for (const ia of this.arrangement) {
      elem.addElement(ia.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): Arrangement {
    const arr = new Arrangement();
    const items = data.getElements("instrumentAssignment");

    while (items.hasMoreElements()) {
      const elem = items.next();
      arr.arrangement.push(InstrumentAssignment.loadFromXML(elem));
    }

    return arr;
  }

  static loadFromXMLWithLibrary(
    data: Element,
    _iLibrary: unknown,
  ): Arrangement {
    return Arrangement.loadFromXML(data);
  }
}

function parseNumericArrangementId(arrangementId: string): number | null {
  const trimmed = arrangementId.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}
