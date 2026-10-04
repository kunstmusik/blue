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
import { XmlLoadContext } from '../serialization/xml-load';
import { parseXmlInteger, readDouble, readInt, readText } from '../utilities/xml';

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
export const BASIC_SOUND_OBJECT_CHILDREN = [
  'name',
  'startTime',
  'startTimePosition',
  'startTimeUnit',
  'subjectiveDuration',
  'subjectiveDurationTD',
  'subjectiveDurationUnit',
  'durationUnit',
  'backgroundColor',
  'timeBehavior',
  'repeatPoint',
  'noteProcessorChain',
] as const;

/** Common local fields are checked without claiming fields owned by concrete subclasses. */
export function initBasicFromXML(
  sObj: BasicSoundObject,
  data: Element,
  context = new XmlLoadContext(data),
): void {
  for (const field of BASIC_SOUND_OBJECT_CHILDREN) {
    const elements = [...data.getElements(field)];
    if (elements.length > 1)
      throw context.at(elements[1]).error({
        code: 'cardinality',
        member: field,
        message: `Duplicate SoundObject field ${field}.`,
        recovery: 'Keep one physical field before coalescing aliases.',
      });
  }
  const name = data.getElement('name');
  if (name) sObj.setName(readText(name, context));

  const normalizeUnit = (element: Element): Element => {
    const type = element.getAttribute('type');
    const types: Record<string, string> = {
      BeatTime: 'BEATS',
      TimeValue: 'TIME',
      FrameValue: 'FRAME',
    };
    if (type === null || !types[type])
      throw context.at(element).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported development-era TimeUnit representation.',
        recovery:
          'Convert this time form in a compatible historical editor; no default value was substituted.',
      });
    const copy = element.clone();
    copy.setAttribute('type', types[type]);
    context.anchor(copy, element);
    return copy;
  };
  const position = (element: Element): TimePosition => {
    if (element.getName() === 'startTimeUnit')
      return TimePosition.loadFromXML(normalizeUnit(element), context);
    if (element.getName() === 'startTime' && element.getAttribute('type') === null)
      return TimePosition.beats(readDouble(element, context));
    return TimePosition.loadFromXML(element, context);
  };
  const duration = (element: Element): TimeDuration => {
    if (element.getName() === 'durationUnit' || element.getName() === 'subjectiveDurationUnit')
      return TimeDuration.loadFromXML(normalizeUnit(element), context);
    if (
      element.getAttribute('type') === null &&
      (element.getName() === 'subjectiveDuration' || element.getName() === 'repeatPoint')
    )
      return TimeDuration.beats(readDouble(element, context));
    return TimeDuration.loadFromXML(element, context);
  };
  const coalesce = <T extends TimePosition | TimeDuration>(
    fields: readonly string[],
    load: (element: Element) => T,
  ): T | undefined => {
    const elements = fields.flatMap((field) => [...data.getElements(field)]);
    const values = elements.map(load);
    if (values.some((value) => value.saveAsXML().toXml() !== values[0].saveAsXML().toXml()))
      throw context.at(elements[1]).error({
        code: 'conflict',
        message: 'SoundObject time aliases disagree.',
        recovery: 'Keep one canonical time representation or equal aliases.',
      });
    return values[0];
  };
  const start = coalesce(['startTime', 'startTimePosition', 'startTimeUnit'], position);
  const interval = coalesce(
    ['subjectiveDuration', 'subjectiveDurationTD', 'subjectiveDurationUnit', 'durationUnit'],
    duration,
  );
  if (start) sObj.setStartTime(start);
  if (interval) sObj.setSubjectiveDuration(interval);

  const behavior = data.getElement('timeBehavior');
  if (behavior) {
    const text = readText(behavior, context);
    const ordinals = [
      TimeBehavior.NOT_SUPPORTED,
      TimeBehavior.SCALE,
      TimeBehavior.REPEAT_CLASSIC,
      TimeBehavior.NONE,
      TimeBehavior.REPEAT,
    ];
    sObj.setTimeBehavior(
      Object.values(TimeBehavior).includes(text as TimeBehavior)
        ? (text as TimeBehavior)
        : ordinals[parseXmlInteger(text, context.at(behavior), -1, 3) + 1],
    );
  }
  const color = data.getElement('backgroundColor');
  if (color) sObj.setBackgroundColor(readInt(color, context, -2147483648, 4294967295) | 0);
  const repeat = data.getElement('repeatPoint');
  if (repeat) {
    if (repeat.getAttribute('type') === null && readDouble(repeat, context) === -1)
      sObj.setRepeatPoint(null);
    else sObj.setRepeatPoint(duration(repeat));
  }
  const chain = data.getElement('noteProcessorChain');
  if (chain) sObj.setNoteProcessorChain(NoteProcessorChain.loadFromXML(chain, context));
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
  elem.addElement('backgroundColor').setText((sObj.getBackgroundColor() | 0).toString());

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
