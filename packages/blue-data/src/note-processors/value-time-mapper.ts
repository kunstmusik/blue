export class ValueTimeMapper {
  private _timeMap: BeatValuePair[] = [];

  constructor();
  constructor(src: ValueTimeMapper);
  constructor(src?: ValueTimeMapper) {
    if (src && src._timeMap.length > 0) {
      this._timeMap = src._timeMap.map((p) => {
        const pair = new BeatValuePair();
        pair.beat = p.beat;
        pair.value = p.value;
        return pair;
      });
    }
  }

  static createValueTimeMapper(beatValueString: string): ValueTimeMapper | null {
    const tokens = beatValueString.trim().split(/\s+/);

    if (tokens.length % 2 !== 0) {
      return null;
    }

    const timeMap: BeatValuePair[] = [];

    for (let i = 0; i < tokens.length; i += 2) {
      try {
        const beat = parseFloat(tokens[i]);
        const value = parseFloat(tokens[i + 1]);

        if (beat < 0.0) {
          return null;
        }

        const pair = new BeatValuePair();
        pair.beat = beat;
        pair.value = value;
        timeMap.push(pair);
      } catch {
        return null;
      }
    }

    const tm = new ValueTimeMapper();
    tm._timeMap = timeMap;
    return tm;
  }

  getValueForBeat(beat: number): number {
    if (this._timeMap.length === 0) return NaN;

    if (beat >= this._timeMap[this._timeMap.length - 1].beat) {
      return this._timeMap[this._timeMap.length - 1].value;
    }

    for (let i = 0; i < this._timeMap.length - 1; i++) {
      if (beat >= this._timeMap[i].beat && beat < this._timeMap[i + 1].beat) {
        const x1 = this._timeMap[i].value;
        const x2 = this._timeMap[i + 1].value;

        const m = x2 - x1;
        const x =
          (beat - this._timeMap[i].beat) / (this._timeMap[i + 1].beat - this._timeMap[i].beat);

        return m * x + x1;
      }
    }

    return NaN;
  }
}

class BeatValuePair {
  beat = 0.0;
  value = 0;
}
