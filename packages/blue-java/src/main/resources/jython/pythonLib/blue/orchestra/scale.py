"""Pure-Python Scala scale parser used by the legacy orchestra package."""

import math
import os


class Scale(object):
    def __init__(self, scaleName="", ratios=None, baseFrequency=261.625565, octave=2.0):
        self.scaleName = scaleName
        self.ratios = ratios if ratios is not None else []
        self.baseFrequency = float(baseFrequency)
        self.octave = float(octave)

    @staticmethod
    def loadScale(scalaFile):
        path = _path_from_file_like(scalaFile)
        scale = Scale(os.path.basename(path))

        try:
            input_file = open(path, "r")
            try:
                lines = input_file.readlines()
            finally:
                input_file.close()
        except IOError:
            return None

        line_count = 0
        index = 0

        for raw_line in lines:
            line = raw_line.strip()
            if line.startswith("!"):
                continue

            if line_count == 0:
                pass
            elif line_count == 1:
                try:
                    pitch_count = int(line)
                except ValueError:
                    return None
                if pitch_count <= 0:
                    return None
                scale.ratios = [0.0] * pitch_count
                scale.ratios[0] = 1.0
                index = 1
            elif scale.ratios is not None:
                try:
                    multiplier = _get_multiplier(line)
                except ValueError:
                    return None

                if index == len(scale.ratios):
                    scale.octave = multiplier
                elif index < len(scale.ratios):
                    scale.ratios[index] = multiplier
                    index += 1

            line_count += 1

        return scale

    @staticmethod
    def get12TET():
        scale = Scale("12TET")
        ratio = math.pow(2.0, 1.0 / 12.0)
        scale.ratios = [math.pow(ratio, index) for index in range(12)]
        return scale

    def setBaseFrequency(self, baseFrequency):
        self.baseFrequency = float(baseFrequency)

    def getBaseFrequency(self):
        return self.baseFrequency

    def getNumScaleDegrees(self):
        return len(self.ratios)

    def getFrequency(self, octave, scaleDegree):
        oct_value = int(octave)
        pitch_index = int(scaleDegree)

        if pitch_index < 0:
            raise IndexError("scaleDegree must be non-negative")

        if pitch_index >= len(self.ratios):
            oct_value += pitch_index // len(self.ratios)
            pitch_index = pitch_index % len(self.ratios)

        octave_multiplier = math.pow(self.octave, oct_value - 8)
        return (octave_multiplier * self.baseFrequency) * self.ratios[pitch_index]

    def getScaleName(self):
        return self.scaleName

    def setScaleName(self, scaleName):
        self.scaleName = scaleName


def _path_from_file_like(scalaFile):
    if hasattr(scalaFile, "getPath"):
        return scalaFile.getPath()
    if hasattr(scalaFile, "getAbsolutePath"):
        return scalaFile.getAbsolutePath()
    return str(scalaFile)


def _get_multiplier(lineInput):
    line = _remove_comments(lineInput)
    if "/" in line:
        values = line.split("/", 1)
        return float(values[0]) / float(values[1])
    if "." in line:
        cents = float(line)
        return math.pow(2.0, cents / 1200.0)
    return float(line)


def _remove_comments(line):
    for marker in (" ", "\t"):
        index = line.find(marker)
        if index > -1:
            return line[:index]
    return line


Scale.TwelveTET = Scale.get12TET()

__all__ = ["Scale"]

