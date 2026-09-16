/**
 * ProjectProperties — holds project-level settings for CSD generation.
 * Mirrors the Java ProjectProperties class while preserving existing
 * compatibility fields used by the current TypeScript codebase.
 */
import { Element } from './serialization/xml-reader';
import { ObjRefSaveMap } from './serialization/obj-ref-map';

export class ProjectProperties {
  title = '';
  author = '';
  notes = '';

  sampleRate = '44100';
  ksmps = '64';
  private _channels = '2';

  useZeroDbFS = false;
  zeroDbFS = '1';

  diskSampleRate = '44100';
  diskKsmps = '1';
  diskChannels = '2';
  diskUseZeroDbFS = false;
  diskZeroDbFS = '1';

  useAudioOut = true;
  useAudioIn = false;
  useMidiIn = false;
  useMidiOut = false;
  noteAmpsEnabled = true;
  outOfRangeEnabled = true;
  warningsEnabled = true;
  benchmarkEnabled = true;
  advancedSettings = '';
  completeOverride = false;

  fileName = '';
  askOnRender = false;
  diskNoteAmpsEnabled = true;
  diskOutOfRangeEnabled = true;
  diskWarningsEnabled = true;
  diskBenchmarkEnabled = true;
  diskAdvancedSettings = '';
  diskCompleteOverride = false;
  diskAlwaysRenderEntireProject = false;

  mediaFolder = '';
  copyToMediaFileOnImport = true;

  // Legacy compatibility fields retained for existing callers and file formats.
  commandLine = '';
  diskCommandLine = '';
  oFormat = '';
  audioOutput = '';

  constructor(other?: ProjectProperties) {
    if (other) {
      this.title = other.title;
      this.author = other.author;
      this.notes = other.notes;
      this.sampleRate = other.sampleRate;
      this.ksmps = other.ksmps;
      this.channels = other.channels;
      this.useZeroDbFS = other.useZeroDbFS;
      this.zeroDbFS = other.zeroDbFS;
      this.diskSampleRate = other.diskSampleRate;
      this.diskKsmps = other.diskKsmps;
      this.diskChannels = other.diskChannels;
      this.diskUseZeroDbFS = other.diskUseZeroDbFS;
      this.diskZeroDbFS = other.diskZeroDbFS;
      this.useAudioOut = other.useAudioOut;
      this.useAudioIn = other.useAudioIn;
      this.useMidiIn = other.useMidiIn;
      this.useMidiOut = other.useMidiOut;
      this.noteAmpsEnabled = other.noteAmpsEnabled;
      this.outOfRangeEnabled = other.outOfRangeEnabled;
      this.warningsEnabled = other.warningsEnabled;
      this.benchmarkEnabled = other.benchmarkEnabled;
      this.advancedSettings = other.advancedSettings;
      this.completeOverride = other.completeOverride;
      this.fileName = other.fileName;
      this.askOnRender = other.askOnRender;
      this.diskNoteAmpsEnabled = other.diskNoteAmpsEnabled;
      this.diskOutOfRangeEnabled = other.diskOutOfRangeEnabled;
      this.diskWarningsEnabled = other.diskWarningsEnabled;
      this.diskBenchmarkEnabled = other.diskBenchmarkEnabled;
      this.diskAdvancedSettings = other.diskAdvancedSettings;
      this.diskCompleteOverride = other.diskCompleteOverride;
      this.diskAlwaysRenderEntireProject = other.diskAlwaysRenderEntireProject;
      this.mediaFolder = other.mediaFolder;
      this.copyToMediaFileOnImport = other.copyToMediaFileOnImport;
      this.commandLine = other.commandLine;
      this.diskCommandLine = other.diskCommandLine;
      this.oFormat = other.oFormat;
      this.audioOutput = other.audioOutput;
    }
  }

  get channels(): string {
    return this._channels;
  }

  set channels(value: string) {
    this._channels = value;
  }

  get nchnls(): string {
    return this._channels;
  }

  set nchnls(value: string) {
    this._channels = value;
  }

  /**
   * Backward-compatible helper that returns realtime options as a newline list.
   */
  toCsoundOptions(): string {
    return this.getRealtimeCsoundOptions().join('\n');
  }

  /**
   * Java parity with ProjectPropertiesUtil.getRealtimeCommandLine(), but
   * returns only Csound option tokens suitable for setOption().
   */
  getRealtimeCsoundOptions(): string[] {
    if (this.completeOverride) {
      const overrideText = this.advancedSettings || this.commandLine || '';
      return this.parseOptionTokens(overrideText);
    }

    const options: string[] = [];

    if (this.useAudioOut) {
      options.push('-odac');
    }

    if (this.useAudioIn) {
      options.push('-iadc');
    }

    options.push(this.getRealtimeMessageLevelFlag());
    options.push(...this.parseOptionTokens(this.advancedSettings));

    return options;
  }

  getRealtimeMessageLevelFlag(): string {
    let level = 0;

    if (this.noteAmpsEnabled) level += 1;
    if (this.outOfRangeEnabled) level += 2;
    if (this.warningsEnabled) level += 4;
    if (this.benchmarkEnabled) level += 128;

    return `-m${level}`;
  }

  private parseOptionTokens(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    const matches = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const tokens = matches
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => {
        if (
          (token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("'") && token.endsWith("'"))
        ) {
          return token.slice(1, -1);
        }
        return token;
      })
      .filter((token) => token.startsWith('-'));

    return tokens;
  }

  // ─── XML ───

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('projectProperties');

    elem.addElement('title').setText(this.title);
    elem.addElement('author').setText(this.author);
    elem.addElement('notes').setText(this.notes);
    if (this.sampleRate) elem.addElement('sampleRate').setText(this.sampleRate);
    if (this.ksmps) elem.addElement('ksmps').setText(this.ksmps);
    if (this.channels) elem.addElement('channels').setText(this.channels);
    elem.addElement('useZeroDbFS').setText(this.useZeroDbFS.toString());
    if (this.zeroDbFS) elem.addElement('zeroDbFS').setText(this.zeroDbFS);

    if (this.diskSampleRate) elem.addElement('diskSampleRate').setText(this.diskSampleRate);
    if (this.diskKsmps) elem.addElement('diskKsmps').setText(this.diskKsmps);
    if (this.diskChannels) elem.addElement('diskChannels').setText(this.diskChannels);
    elem.addElement('diskUseZeroDbFS').setText(this.diskUseZeroDbFS.toString());
    if (this.diskZeroDbFS) elem.addElement('diskZeroDbFS').setText(this.diskZeroDbFS);

    elem.addElement('useAudioOut').setText(this.useAudioOut.toString());
    elem.addElement('useAudioIn').setText(this.useAudioIn.toString());
    elem.addElement('useMidiIn').setText(this.useMidiIn.toString());
    elem.addElement('useMidiOut').setText(this.useMidiOut.toString());
    elem.addElement('noteAmpsEnabled').setText(this.noteAmpsEnabled.toString());
    elem.addElement('outOfRangeEnabled').setText(this.outOfRangeEnabled.toString());
    elem.addElement('warningsEnabled').setText(this.warningsEnabled.toString());
    elem.addElement('benchmarkEnabled').setText(this.benchmarkEnabled.toString());
    elem.addElement('advancedSettings').setText(this.advancedSettings);
    elem.addElement('completeOverride').setText(this.completeOverride.toString());

    elem.addElement('fileName').setText(this.fileName);
    elem.addElement('askOnRender').setText(this.askOnRender.toString());
    elem.addElement('diskNoteAmpsEnabled').setText(this.diskNoteAmpsEnabled.toString());
    elem.addElement('diskOutOfRangeEnabled').setText(this.diskOutOfRangeEnabled.toString());
    elem.addElement('diskWarningsEnabled').setText(this.diskWarningsEnabled.toString());
    elem.addElement('diskBenchmarkEnabled').setText(this.diskBenchmarkEnabled.toString());
    elem.addElement('diskAdvancedSettings').setText(this.diskAdvancedSettings);
    elem.addElement('diskCompleteOverride').setText(this.diskCompleteOverride.toString());
    elem
      .addElement('diskAlwaysRenderEntireProject')
      .setText(this.diskAlwaysRenderEntireProject.toString());

    elem.addElement('mediaFolder').setText(this.mediaFolder);
    elem.addElement('copyToMediaFileOnImport').setText(this.copyToMediaFileOnImport.toString());

    if (this.commandLine) elem.addElement('commandLine').setText(this.commandLine);
    if (this.diskCommandLine) elem.addElement('diskCommandLine').setText(this.diskCommandLine);
    if (this.oFormat) elem.addElement('oFormat').setText(this.oFormat);
    if (this.audioOutput) elem.addElement('audioOutput').setText(this.audioOutput);

    return elem;
  }

  static loadFromXML(data: Element): ProjectProperties {
    const props = new ProjectProperties();

    const title = data.getTextString('title');
    if (title !== null) props.title = title;

    const author = data.getTextString('author');
    if (author !== null) props.author = author;

    const notes = data.getTextString('notes');
    if (notes !== null) props.notes = notes;

    const sr = data.getTextString('sampleRate');
    if (sr !== null) props.sampleRate = sr;

    const ksmps = data.getTextString('ksmps');
    if (ksmps !== null) props.ksmps = ksmps;

    const channels = data.getTextString('channels');
    if (channels !== null) {
      props.channels = channels;
    }

    const udb = data.getTextString('useZeroDbFS');
    if (udb !== null) props.useZeroDbFS = udb.toLowerCase() === 'true';

    const zdb = data.getTextString('zeroDbFS');
    if (zdb !== null) props.zeroDbFS = zdb;

    const diskSr = data.getTextString('diskSampleRate');
    if (diskSr !== null) props.diskSampleRate = diskSr;

    const diskKsmps = data.getTextString('diskKsmps');
    if (diskKsmps !== null) props.diskKsmps = diskKsmps;

    const diskChannels = data.getTextString('diskChannels');
    if (diskChannels !== null) props.diskChannels = diskChannels;

    const ddb = data.getTextString('diskUseZeroDbFS');
    if (ddb !== null) props.diskUseZeroDbFS = ddb.toLowerCase() === 'true';

    const dzdb = data.getTextString('diskZeroDbFS');
    if (dzdb !== null) props.diskZeroDbFS = dzdb;

    const useAudioOut = data.getTextString('useAudioOut');
    if (useAudioOut !== null) props.useAudioOut = useAudioOut.toLowerCase() === 'true';

    const useAudioIn = data.getTextString('useAudioIn');
    if (useAudioIn !== null) props.useAudioIn = useAudioIn.toLowerCase() === 'true';

    const useMidiIn = data.getTextString('useMidiIn');
    if (useMidiIn !== null) props.useMidiIn = useMidiIn.toLowerCase() === 'true';

    const useMidiOut = data.getTextString('useMidiOut');
    if (useMidiOut !== null) props.useMidiOut = useMidiOut.toLowerCase() === 'true';

    const noteAmpsEnabled = data.getTextString('noteAmpsEnabled');
    if (noteAmpsEnabled !== null) props.noteAmpsEnabled = noteAmpsEnabled.toLowerCase() === 'true';

    const outOfRangeEnabled = data.getTextString('outOfRangeEnabled');
    if (outOfRangeEnabled !== null)
      props.outOfRangeEnabled = outOfRangeEnabled.toLowerCase() === 'true';

    const warningsEnabled = data.getTextString('warningsEnabled');
    if (warningsEnabled !== null) props.warningsEnabled = warningsEnabled.toLowerCase() === 'true';

    const benchmarkEnabled = data.getTextString('benchmarkEnabled');
    if (benchmarkEnabled !== null)
      props.benchmarkEnabled = benchmarkEnabled.toLowerCase() === 'true';

    const adv = data.getTextString('advancedSettings');
    if (adv !== null) props.advancedSettings = adv;

    const co = data.getTextString('completeOverride');
    if (co !== null) props.completeOverride = co.toLowerCase() === 'true';

    const fileName = data.getTextString('fileName');
    if (fileName !== null) props.fileName = fileName;

    const askOnRender = data.getTextString('askOnRender');
    if (askOnRender !== null) props.askOnRender = askOnRender.toLowerCase() === 'true';

    const diskNoteAmpsEnabled = data.getTextString('diskNoteAmpsEnabled');
    if (diskNoteAmpsEnabled !== null)
      props.diskNoteAmpsEnabled = diskNoteAmpsEnabled.toLowerCase() === 'true';

    const diskOutOfRangeEnabled = data.getTextString('diskOutOfRangeEnabled');
    if (diskOutOfRangeEnabled !== null)
      props.diskOutOfRangeEnabled = diskOutOfRangeEnabled.toLowerCase() === 'true';

    const diskWarningsEnabled = data.getTextString('diskWarningsEnabled');
    if (diskWarningsEnabled !== null)
      props.diskWarningsEnabled = diskWarningsEnabled.toLowerCase() === 'true';

    const diskBenchmarkEnabled = data.getTextString('diskBenchmarkEnabled');
    if (diskBenchmarkEnabled !== null)
      props.diskBenchmarkEnabled = diskBenchmarkEnabled.toLowerCase() === 'true';

    const diskAdv = data.getTextString('diskAdvancedSettings');
    if (diskAdv !== null) props.diskAdvancedSettings = diskAdv;

    const diskCo = data.getTextString('diskCompleteOverride');
    if (diskCo !== null) props.diskCompleteOverride = diskCo.toLowerCase() === 'true';

    const diskAlwaysRenderEntireProject = data.getTextString('diskAlwaysRenderEntireProject');
    if (diskAlwaysRenderEntireProject !== null) {
      props.diskAlwaysRenderEntireProject = diskAlwaysRenderEntireProject.toLowerCase() === 'true';
    }

    const mediaFolder = data.getTextString('mediaFolder');
    if (mediaFolder !== null) props.mediaFolder = mediaFolder;

    const copyToMediaFileOnImport = data.getTextString('copyToMediaFileOnImport');
    if (copyToMediaFileOnImport !== null) {
      props.copyToMediaFileOnImport = copyToMediaFileOnImport.toLowerCase() === 'true';
    } else {
      // Legacy alias: copyToMediaFolderOnImport → copyToMediaFileOnImport
      const legacyCopy = data.getTextString('copyToMediaFolderOnImport');
      if (legacyCopy !== null) {
        props.copyToMediaFileOnImport = legacyCopy.toLowerCase() === 'true';
      }
    }

    const cmd = data.getTextString('commandLine');
    if (cmd !== null) props.commandLine = cmd;

    const diskCmd = data.getTextString('diskCommandLine');
    if (diskCmd !== null) props.diskCommandLine = diskCmd;

    const oFormat = data.getTextString('oFormat');
    if (oFormat !== null) props.oFormat = oFormat;

    const ao = data.getTextString('audioOutput');
    if (ao !== null) props.audioOutput = ao;

    return props;
  }
}
