import type { Element } from '../serialization/xml-reader';
import type { XmlLoadContext } from '../serialization/xml-load';
import { readInt, readDouble } from '../utilities/xml';

/** Read a required time field, accepting aliases only when their values agree. */
export function readTimeNumber(
  data: Element,
  context: XmlLoadContext,
  names: string[],
  integer = false,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const present = names
    .map((name) => data.getElement(name))
    .filter((node): node is Element => node !== null);
  if (present.length === 0)
    throw context.at(data).error({
      code: 'cardinality',
      member: names[0],
      message: `Missing required typed time field ${names[0]}.`,
      recovery: 'Supply all fields required by the selected time type.',
    });
  const values = present.map((node) =>
    integer ? readInt(node, context, min, max) : readDouble(node, context),
  );
  if (values.some((value) => value !== values[0]))
    throw context.at(present[1]).error({
      code: 'conflict',
      member: names[0],
      message: 'Conflicting time field aliases.',
      recovery: 'Keep one consistent time value.',
    });
  return values[0];
}
