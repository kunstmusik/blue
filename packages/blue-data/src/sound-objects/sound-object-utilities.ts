/**
 * SoundObjectUtilities — shared utility for loading common sound object properties from XML.
 * Mirrors the Java SoundObjectUtilities.initBasicFromXML.
 *
 * Handles 3 XML formats for startTime and subjectiveDuration:
 *   1. New format: `<startTime type='BEATS'><csoundBeats>8.0</csoundBeats></startTime>`
 *   2. Legacy tag: `<startTimePosition type='BEATS'>...</startTimePosition>`
 *   3. Old format: `<startTime>8.0</startTime>` (plain text, no type attr)
 */
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeBehavior } from './time-behavior';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { Element } from '../serialization/xml-reader';

/**
 * Interface for objects that have the basic sound object properties.
 * Both AbstractSoundObject and PolyObject implement this.
 */
export interface BasicSoundObject {
  setName(name: string): void;
  getName(): string;
  setStartTime(value: TimePosition): void;
  getStartTime(): TimePosition;
  setSubjectiveDuration(value: TimeDuration): void;
  getSubjectiveDuration(): TimeDuration;
  setTimeBehavior(behavior: TimeBehavior): void;
  getTimeBehavior(): TimeBehavior;
  setBackgroundColor(color: number): void;
  getBackgroundColor(): number;
  setRepeatPoint(rp: TimeDuration | null): void;
  getRepeatPoint(): TimeDuration | null;
  setNoteProcessorChain(chain: NoteProcessorChain): void;
  getNoteProcessorChain(): NoteProcessorChain;
}

/**
 * Load common sound object properties from XML, handling all 3 format variants
 * for startTime and subjectiveDuration.
 *
 * @param sObj The sound object to populate
 * @param data The XML element containing the sound object data
 */
export function initBasicFromXML(sObj: BasicSoundObject, data: Element): void {
  // ─── Name ───
  const name = data.getTextString('name');
  if (name) sObj.setName(name);

  // ─── Start Time (3 formats) ───
  const startTimeElement = data.getElement('startTime');
  if (startTimeElement) {
    const typeAttr = startTimeElement.getAttributeValue('type');
    if (typeAttr) {
      // Format 1: New nested format with type attribute
      sObj.setStartTime(TimePosition.loadFromXML(startTimeElement));
    } else {
      // Format 3: Old plain text format
      const text = startTimeElement.getTextString();
      if (text) {
        sObj.setStartTime(TimePosition.beats(parseFloat(text)));
      }
    }
  } else {
    // Format 2: Legacy startTimePosition tag
    const startPosElement = data.getElement('startTimePosition');
    if (startPosElement) {
      const typeAttr = startPosElement.getAttributeValue('type');
      if (typeAttr) {
        sObj.setStartTime(TimePosition.loadFromXML(startPosElement));
      } else {
        const text = startPosElement.getTextString();
        if (text) {
          sObj.setStartTime(TimePosition.beats(parseFloat(text)));
        }
      }
    }
  }

  // ─── Subjective Duration (3 formats) ───
  const durElement = data.getElement('subjectiveDuration');
  if (durElement) {
    const typeAttr = durElement.getAttributeValue('type');
    if (typeAttr) {
      // Format 1: New nested format
      sObj.setSubjectiveDuration(TimeDuration.loadFromXML(durElement));
    } else {
      // Format 3: Old plain text
      const text = durElement.getTextString();
      if (text) {
        sObj.setSubjectiveDuration(TimeDuration.beats(parseFloat(text)));
      }
    }
  } else {
    // Format 2: Legacy subjectiveDurationTD tag
    const durTDElement = data.getElement('subjectiveDurationTD');
    if (durTDElement) {
      const typeAttr = durTDElement.getAttributeValue('type');
      if (typeAttr) {
        sObj.setSubjectiveDuration(TimeDuration.loadFromXML(durTDElement));
      } else {
        const text = durTDElement.getTextString();
        if (text) {
          sObj.setSubjectiveDuration(TimeDuration.beats(parseFloat(text)));
        }
      }
    } else {
      // Legacy: subjectiveDurationUnit (TimePosition used as duration)
      const durUnitElement = data.getElement('subjectiveDurationUnit');
      if (durUnitElement) {
        const typeAttr = durUnitElement.getAttributeValue('type');
        if (typeAttr) {
          // Load as TimePosition, extract beat value, create Duration
          const pos = TimePosition.loadFromXML(durUnitElement);
          sObj.setSubjectiveDuration(TimeDuration.beats(pos.getValue()));
        } else {
          const text = durUnitElement.getTextString();
          if (text) {
            sObj.setSubjectiveDuration(TimeDuration.beats(parseFloat(text)));
          }
        }
      }
    }
  }

  // ─── Time Behavior ───
  // Java uses ordinals: NOT_SUPPORTED=-1, SCALE=0, REPEAT_CLASSIC=1, NONE=2, REPEAT=3
  const tbStr = data.getTextString('timeBehavior');
  if (tbStr) {
    if (Object.values(TimeBehavior).includes(tbStr as TimeBehavior)) {
      sObj.setTimeBehavior(tbStr as TimeBehavior);
    } else {
      // Legacy numeric format
      const tbNum = parseInt(tbStr, 10);
      switch (tbNum) {
        case -1:
          sObj.setTimeBehavior(TimeBehavior.NOT_SUPPORTED);
          break;
        case 0:
          sObj.setTimeBehavior(TimeBehavior.SCALE);
          break;
        case 1:
          sObj.setTimeBehavior(TimeBehavior.REPEAT_CLASSIC);
          break;
        case 3:
          sObj.setTimeBehavior(TimeBehavior.REPEAT);
          break;
        case 2:
          sObj.setTimeBehavior(TimeBehavior.NONE);
          break;
      }
    }
  }

  // ─── Background Color ───
  const colorStr = data.getTextString('backgroundColor');
  if (colorStr) {
    sObj.setBackgroundColor(parseInt(colorStr, 10));
  }

  // ─── Repeat Point ───
  // Java: only set repeatPoint if value > 0.0; -1 means "no repeat" → null
  const rpElement = data.getElement('repeatPoint');
  if (rpElement) {
    const typeAttr = rpElement.getAttributeValue('type');
    if (typeAttr) {
      sObj.setRepeatPoint(TimeDuration.loadFromXML(rpElement));
    } else {
      const text = rpElement.getTextString();
      if (text) {
        const rpVal = parseFloat(text);
        if (rpVal > 0.0) {
          sObj.setRepeatPoint(TimeDuration.beats(rpVal));
        } else {
          sObj.setRepeatPoint(null);
        }
      }
    }
  }

  // ─── Note Processor Chain ───
  const npcElement = data.getElement('noteProcessorChain');
  if (npcElement) {
    sObj.setNoteProcessorChain(NoteProcessorChain.loadFromXML(npcElement));
  }
}

function timeBehaviorToType(tb: TimeBehavior): number {
  switch (tb) {
    case TimeBehavior.SCALE:
      return 0;
    case TimeBehavior.REPEAT_CLASSIC:
      return 1;
    case TimeBehavior.NONE:
      return 2;
    case TimeBehavior.REPEAT:
      return 3;
    case TimeBehavior.NOT_SUPPORTED:
      return -1;
    default:
      return 0;
  }
}

export function getBasicXML(sObj: BasicSoundObject, javaType: string): Element {
  const elem = new Element('soundObject');
  elem.setAttribute('type', javaType);

  elem.addElement(sObj.getStartTime().saveAsXML().setName('startTime'));
  elem.addElement(sObj.getSubjectiveDuration().saveAsXML().setName('subjectiveDuration'));
  elem.addElement('name').setText(sObj.getName());
  elem.addElement('backgroundColor').setText(sObj.getBackgroundColor().toString());

  const tb = sObj.getTimeBehavior();
  if (tb !== TimeBehavior.NOT_SUPPORTED) {
    elem.addElement('timeBehavior').setText(timeBehaviorToType(tb).toString());
    const rp = sObj.getRepeatPoint();
    if (rp) {
      elem.addElement(rp.saveAsXML().setName('repeatPoint'));
    } else {
      elem.addElement('repeatPoint').setText('-1.0');
    }
  }

  const npc = sObj.getNoteProcessorChain();
  if (npc) {
    elem.addElement(npc.saveAsXML().setName('noteProcessorChain'));
  }

  return elem;
}
