"""Pure-Python tempo-map helpers used by the legacy orchestra package."""


class _TempoPoint(object):
    def __init__(self, beat, tempo):
        self.beat = float(beat)
        self.tempo = float(tempo)
        self.accumulated_time = 0.0


class TempoMap(object):
    """Subset of Java Blue's TempoMap used by legacy Python time warping."""

    DEFAULT_TEMPO = 60.0

    def __init__(self, points=None, enabled=False):
        if points is None:
            points = [_TempoPoint(0.0, self.DEFAULT_TEMPO)]
        self.points = points
        self.enabled = bool(enabled)
        self._recalculate_accumulated_times()

    @staticmethod
    def createTempoMap(tempoString):
        """Create a tempo map from ``beat tempo`` pairs, or return ``None``."""
        tokens = str(tempoString).split()
        if len(tokens) == 0 or len(tokens) % 2 != 0:
            return None

        points = []
        index = 0
        while index < len(tokens):
            try:
                beat = float(tokens[index])
                tempo = float(tokens[index + 1])
            except Exception:
                return None

            if beat < 0.0 or tempo <= 0.0:
                return None

            points.append(_TempoPoint(beat, tempo))
            index += 2

        return TempoMap(points, True)

    def setEnabled(self, enabled):
        self.enabled = bool(enabled)

    def isEnabled(self):
        return self.enabled

    def beatsToSeconds(self, beat):
        beat = float(beat)
        if beat == 0.0:
            return 0.0

        if not self.enabled or len(self.points) == 0:
            return beat * (60.0 / self.DEFAULT_TEMPO)

        for index in range(len(self.points) - 1):
            current = self.points[index]
            next_point = self.points[index + 1]

            if beat >= current.beat and beat < next_point.beat:
                delta_beat = beat - current.beat
                factor1 = 60.0 / current.tempo
                factor2 = 60.0 / next_point.tempo
                segment_length = next_point.beat - current.beat
                if segment_length == 0.0:
                    return current.accumulated_time
                acceleration = (factor2 - factor1) / segment_length
                return current.accumulated_time + self._area_under_curve(
                    factor1, delta_beat, acceleration
                )

        last_point = self.points[-1]
        factor = 60.0 / last_point.tempo
        return last_point.accumulated_time + (factor * (beat - last_point.beat))

    def _recalculate_accumulated_times(self):
        if len(self.points) == 0:
            return

        self.points[0].accumulated_time = 0.0
        for index in range(1, len(self.points)):
            previous = self.points[index - 1]
            current = self.points[index]
            delta_beat = current.beat - previous.beat

            if delta_beat == 0.0:
                current.accumulated_time = previous.accumulated_time
            else:
                factor1 = 60.0 / previous.tempo
                factor2 = 60.0 / current.tempo
                acceleration = (factor2 - factor1) / delta_beat
                current.accumulated_time = previous.accumulated_time + self._area_under_curve(
                    factor1, delta_beat, acceleration
                )

    @staticmethod
    def _area_under_curve(factor1, delta_beat, acceleration):
        return (factor1 * delta_beat) + (0.5 * acceleration * (delta_beat ** 2))


__all__ = ["TempoMap"]

