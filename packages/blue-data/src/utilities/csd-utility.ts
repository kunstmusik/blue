/**
 * CSDUtility — imports CSD and ORC/SCO files into BlueData projects.
 * Mirrors the Java CSDUtility class.
 */
import { BlueData } from '../blue-data';
import { GenericInstrument } from '../instruments/generic-instrument';
import { GenericScore } from '../sound-objects/generic-score';
import { PolyObject } from '../sound-objects/poly-object';
import { Note } from '../sound-objects/note';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TempoPoint } from '../time/tempo-point';
import { CurveType } from '../time/curve-type';
import { TimeContext } from '../time/time-context';
import { parseUDODeclaration } from '../opcodes/udo-utilities';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { getNotes, getTotalDuration } from './score';

export enum CSDImportMode {
  IMPORT_GLOBAL = 0,
  IMPORT_SINGLE_SOUNDOBJECT = 1,
  IMPORT_SOUNDOBJECT_PER_INSTRUMENT = 2,
}

interface ScoreSection {
  scoreText: string;
  sectionStartTime: number;
}

/**
 * Extract content between XML-style tags, such as <CsInstruments>...</CsInstruments>.
 * Mirrors Java TextUtilities.getTextBetweenTags().
 */
export function getTextBetweenTags(tagName: string, text: string): string | null {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;

  const startIdx = text.indexOf(startTag);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startTag.length;
  const endIdx = text.indexOf(endTag, contentStart);
  if (endIdx === -1) return null;

  return text.substring(contentStart, endIdx);
}

export function convertOrcScoToBlue(
  orcText: string,
  scoText: string,
  importMode: CSDImportMode = CSDImportMode.IMPORT_GLOBAL,
): BlueData {
  const data = new BlueData();

  parseCsOrc(data, orcText);
  parseCsScore(data, scoText, importMode);

  const rootScore = data.getScore();
  if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
    const pObj = rootScore[0] as PolyObject;
    if (pObj.length === 0) {
      pObj.newLayerAt(-1);
    }
  }

  return data;
}

export function convertCSDtoBlue(
  csdText: string,
  importMode: CSDImportMode = CSDImportMode.IMPORT_GLOBAL,
): BlueData {
  const data = new BlueData();

  const orc = getTextBetweenTags('CsInstruments', csdText);
  const sco = getTextBetweenTags('CsScore', csdText);

  if (orc !== null) {
    parseCsOrc(data, orc);
  }
  if (sco !== null) {
    parseCsScore(data, sco, importMode);
  }

  const rootScore = data.getScore();
  if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
    const pObj = rootScore[0] as PolyObject;
    if (pObj.length === 0) {
      pObj.newLayerAt(-1);
    }
  }

  return data;
}

export function parseCsOrc(data: BlueData, orc: string): void {
  const lines = orc.split('\n');

  let globalOrch = '';
  let sr: string | null = null;
  let kr: string | null = null;
  let ksmps: string | null = null;

  let instrIds: string | null = null;
  let iBody = '';
  let udoDeclaration: string | null = null;

  let udo: OpcodeDefinition | null = null;
  let instr: GenericInstrument | null = null;

  const arrangement = data.getArrangement();
  const opcodeList = data.getOpcodeList();

  let state = 0;
  let reprocessCurrentLine = false;
  let i = 0;

  while (reprocessCurrentLine || i < lines.length) {
    let line: string;
    if (!reprocessCurrentLine) {
      line = lines[i];
    } else {
      line = lines[i];
      reprocessCurrentLine = false;
    }

    const trimLine = line.trim();

    switch (state) {
      case 0: {
        if (trimLine.startsWith('instr')) {
          const index = line.indexOf(';');
          let iName = '';

          if (index !== -1) {
            iName = line.substring(index + 1).trim();
            line = line.substring(0, index);
          }
          instrIds = line.substring(line.indexOf('instr') + 5).trim();

          instr = new GenericInstrument();
          instr.setName(iName);

          state = 1;
        } else if (trimLine.startsWith('opcode')) {
          let declLine = line;
          const index = declLine.indexOf(';');
          if (index !== -1) {
            declLine = declLine.substring(0, index);
          }
          udo = parseUDODeclaration(declLine);

          if (udo != null) {
            state = 2;
          } else {
            udoDeclaration = declLine.trim();
            state = 3;
          }
        } else {
          if (trimLine.startsWith('kr')) {
            kr = line.substring(line.indexOf('=') + 1).trim();
          } else if (trimLine.startsWith('sr')) {
            sr = line.substring(line.indexOf('=') + 1).trim();
          } else if (trimLine.startsWith('nchnls')) {
            data.getProjectProperties().channels = line.substring(line.indexOf('=') + 1).trim();
          } else if (trimLine.startsWith('ksmps')) {
            ksmps = line.substring(line.indexOf('=') + 1).trim();
          } else {
            globalOrch += line + '\n';
          }
        }
        break;
      }
      case 1: {
        if (trimLine.startsWith('endin')) {
          if (instr != null && instrIds != null) {
            instr.setText(iBody);

            if (instrIds.indexOf(',') > -1) {
              const ids = instrIds.split(',');

              for (const id of ids) {
                arrangement.addInstrumentWithId(instr, id.trim());
              }
            } else {
              arrangement.addInstrumentWithId(instr, instrIds);
            }
          }

          instr = null;
          instrIds = null;
          iBody = '';
          state = 0;
        } else {
          if (instr != null) {
            iBody += line + '\n';
          }
        }
        break;
      }
      case 2: {
        if (trimLine.startsWith('endop')) {
          if (udo != null) {
            udo.setCode(iBody);
            opcodeList.addOpcode(udo);
            iBody = '';
            udo = null;
          }
          state = 0;
        } else {
          if (udo != null) {
            iBody += line + '\n';
          }
        }
        break;
      }
      case 3: {
        if (isInstrOrUDODeclarationBoundary(trimLine)) {
          udoDeclaration = null;
          state = 0;
          reprocessCurrentLine = true;
          break;
        }

        if (trimLine.length > 0) {
          udoDeclaration = (udoDeclaration ?? '') + '\n' + trimLine;
        }

        if (udoDeclaration != null) {
          udo = parseUDODeclaration(udoDeclaration);
          if (udo != null) {
            udoDeclaration = null;
            state = 2;
          }
        }
        break;
      }
    }

    if (!reprocessCurrentLine) {
      i++;
    }
  }

  /* HANDLE RESERVED GLOBAL VARIABLES */
  if (kr != null && ksmps == null && sr != null) {
    try {
      const krDouble = parseFloat(kr);
      const srDouble = parseFloat(sr);
      if (!isNaN(krDouble) && !isNaN(srDouble) && krDouble !== 0) {
        ksmps = Math.floor(srDouble / krDouble).toString();
      }
    } catch {
      ksmps = null;
    }
  }

  if (sr != null) {
    data.getProjectProperties().sampleRate = sr;
    data
      .getScore()
      .getTimeContext()
      .setSampleRate(parseInt(sr, 10) || 44100);
  }

  if (ksmps != null) {
    data.getProjectProperties().ksmps = ksmps;
  }

  data.getGlobalOrcSco().setGlobalOrc(globalOrch);
}

export function parseCsScore(data: BlueData, scoreText: string, importMode: CSDImportMode): void {
  let tables = '';
  let iStatements = '';

  const lines = scoreText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('f')) {
      tables += lines[i] + '\n';

      if (i < lines.length - 1) {
        do {
          const nextLine = lines[i + 1].trim();
          if (nextLine.length === 0) break;

          const c = nextLine.charAt(0);
          if ((c >= '0' && c <= '9') || c === '"' || c === '.') {
            tables += lines[i + 1] + '\n';
            i++;
          } else {
            break;
          }
        } while (i < lines.length - 1);
      }
    } else if (line.startsWith('i')) {
      iStatements += line + '\n';

      if (i < lines.length - 1) {
        do {
          const nextLine = lines[i + 1].trim();
          if (nextLine.length === 0) break;

          const c = nextLine.charAt(0);
          if ((c >= '0' && c <= '9') || c === '"' || c === '.') {
            iStatements += lines[i + 1] + '\n';
            i++;
          } else {
            break;
          }
        } while (i < lines.length - 1);
      }
    } else if (line.startsWith('s')) {
      iStatements += line + '\n';
    } else if (line.startsWith('t')) {
      if (line.length > 1) {
        const tLine = line.substring(1).trim();
        const tempoMap = data.getScore().getTimeContext().getTempoMap();
        const parts = tLine.split(/\s+/);

        if (parts.length % 2 === 0) {
          try {
            tempoMap.reset();
            for (let j = 0; j < parts.length; j += 2) {
              const beat = Number(parts[j]);
              const tempo = Number(parts[j + 1]);
              if (!Number.isFinite(beat) || !Number.isFinite(tempo)) {
                throw new Error('Invalid tempo statement found');
              }
              if (j === 0) {
                tempoMap.setTempoPoint(0, beat, tempo, CurveType.CONSTANT);
              } else {
                tempoMap.addTempoPoint(new TempoPoint(beat, tempo, CurveType.CONSTANT));
              }
            }
            tempoMap.setEnabled(true);
          } catch {
            throw new Error('Invalid tempo statement found');
          }
        } else {
          throw new Error('Invalid tempo statement found');
        }
      }
    }
  }

  const noteText = iStatements;

  const rootScore = data.getScore();
  if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
    const pObj = rootScore[0] as PolyObject;
    if (pObj.length === 1 && pObj[0].length === 0) {
      pObj.length = 0;
    }
  }

  switch (importMode) {
    case CSDImportMode.IMPORT_GLOBAL: {
      if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
        (rootScore[0] as PolyObject).newLayerAt(-1);
      }
      data.getGlobalOrcSco().setGlobalSco(noteText);
      break;
    }

    case CSDImportMode.IMPORT_SINGLE_SOUNDOBJECT: {
      const sections = getScoreSections(noteText);
      for (const section of sections) {
        setSoundObjectPerSection(data, section);
      }
      break;
    }

    case CSDImportMode.IMPORT_SOUNDOBJECT_PER_INSTRUMENT: {
      const sections = getScoreSections(noteText);
      for (const section of sections) {
        setSoundObjectsPerInstrument(data, section);
      }
      break;
    }
  }

  data.getTableSet().setTables(tables);
}

function isInstrOrUDODeclarationBoundary(trimmedLine: string): boolean {
  return (
    trimmedLine.startsWith('opcode') ||
    trimmedLine.startsWith('instr') ||
    trimmedLine.startsWith('endop') ||
    trimmedLine.startsWith('endin')
  );
}

function getScoreSections(scoreText: string): ScoreSection[] {
  const scoreSections: ScoreSection[] = [];
  const lines = scoreText.split('\n');

  let currentSection = '';
  let sectionStartTime = 0.0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('s')) {
      const section: ScoreSection = {
        scoreText: currentSection,
        sectionStartTime,
      };
      scoreSections.push(section);

      const nl = getNotes(section.scoreText);
      sectionStartTime += getTotalDuration(nl);
      currentSection = '';
    } else {
      currentSection += rawLine + '\n';
    }
  }

  const section: ScoreSection = {
    scoreText: currentSection,
    sectionStartTime,
  };
  scoreSections.push(section);

  return scoreSections;
}

function setSoundObjectPerSection(data: BlueData, section: ScoreSection): void {
  const context = data.getScore().getTimeContext();
  const genScore = createSizedGenericScore(section.scoreText, 'Imported Score', context);
  genScore.setStartTime(TimePosition.beats(section.sectionStartTime));

  const rootScore = data.getScore();
  if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
    const pObj = rootScore[0] as PolyObject;
    const sLayer = pObj.newLayerAt(-1);
    sLayer.push(genScore);
  }
}

function setSoundObjectsPerInstrument(data: BlueData, section: ScoreSection): void {
  const context = data.getScore().getTimeContext();
  const map = new Map<number, string[]>();

  const lines = section.scoreText.split('\n');
  let previousNote: Note | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const note = Note.createNoteFromText(line, previousNote);
    if (!note) continue;

    const iNumStr = note.getPField(1);
    if (!iNumStr) continue;

    const iNum = parseInt(iNumStr, 10);
    if (isNaN(iNum)) continue;

    if (!map.has(iNum)) {
      map.set(iNum, []);
    }
    map.get(iNum)!.push(line);
    previousNote = note;
  }

  const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b);

  for (const iNum of sortedKeys) {
    const linesForInstr = map.get(iNum)!;
    const score = linesForInstr.join('\n') + '\n';
    const notes = getNotes(score);

    if (notes.length === 0) continue;

    notes.sort();
    const minStart = notes.getNote(0).getStartTime();

    notes.normalizeNoteList();

    const genScore = createSizedGenericScore(notes.toScoreText(), `Instrument ${iNum}`, context);

    genScore.setStartTime(TimePosition.beats(minStart + section.sectionStartTime));

    const rootScore = data.getScore();
    if (rootScore.length > 0 && rootScore[0] instanceof PolyObject) {
      const pObj = rootScore[0] as PolyObject;
      const sLayer = pObj.newLayerAt(-1);
      sLayer.push(genScore);
    }
  }
}

function createSizedGenericScore(
  noteText: string,
  name: string,
  context: TimeContext,
): GenericScore {
  const genScore = new GenericScore();
  genScore.setScoreText(noteText);
  const notes = getNotes(noteText);
  const totalDur = getTotalDuration(notes);
  genScore.setSubjectiveDuration(TimeDuration.beats(totalDur));
  genScore.setName(name);
  return genScore;
}
