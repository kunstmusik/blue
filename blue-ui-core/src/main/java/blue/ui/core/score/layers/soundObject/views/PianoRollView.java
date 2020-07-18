/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score.layers.soundObject.views;

import blue.SoundLayer;
import blue.plugin.SoundObjectViewPlugin;
import blue.soundObject.PianoRoll;
import blue.soundObject.TimeBehavior;
import blue.soundObject.pianoRoll.PianoNote;
import blue.utilities.scales.ScaleLinear;
import java.awt.Graphics;
import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
@SoundObjectViewPlugin(scoreObjectType = PianoRoll.class)
public class PianoRollView extends GenericView {

   @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

        PianoRoll pianoRoll = (PianoRoll) sObj;

        if (getHeight() <= SoundLayer.LAYER_HEIGHT || pianoRoll.getNotes().isEmpty()) {
            return;
        }

//        PianoRollValueCache cache = (PianoRollValueCache) sObjView.getClientProperty(this);
//        
//        if(cache != null) {
//            cac
//        }
        PianoRollValueCache cache = generateCache(pianoRoll);

        var drawMaxHeight = getHeight() - SoundLayer.LAYER_HEIGHT - 6;

        var noteHeight = Math.min(3, Math.max(1, drawMaxHeight / cache.range));

        var drawHeight = Math.min(drawMaxHeight, noteHeight * cache.range - 6);

        int transY = SoundLayer.LAYER_HEIGHT + 3;

        if (drawHeight < drawMaxHeight) {
            transY += (drawMaxHeight - drawHeight) / 2;
        }

        graphics.translate(0, transY);

        int scaleDegrees = pianoRoll.getScale().getNumScaleDegrees();

        var drawColor = (isSelected()) ? pianoRoll.getBackgroundColor().darker() : pianoRoll.getBackgroundColor().brighter().brighter();
        graphics.setColor(drawColor);

        ScaleLinear yScale = new ScaleLinear(cache.min, cache.max, drawHeight, 0.0);
        final var pixelSeconds = timeState.getPixelSecond();

        if (pianoRoll.getTimeBehavior() == TimeBehavior.SCALE) {
            var w = getWidth();

            ScaleLinear xScale = new ScaleLinear(0.0, cache.notesDuration, 0, w);

            for (var note : pianoRoll.getNotes()) {
                var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
                var x = xScale.calc(note.getStart());
                var y = yScale.calc(noteNum);

                var width = xScale.calc(note.getDuration());

                graphics.fillRect((int) x, (int) y, (int) width, noteHeight);
            }

        } else if (pianoRoll.getTimeBehavior() == TimeBehavior.REPEAT) {
            var duration = pianoRoll.getSubjectiveDuration();
            var repeat = pianoRoll.getRepeatPoint() > 0.0 ? pianoRoll.getRepeatPoint() : cache.notesDuration;

            var curTime = 0.0;
            var xStart = 0;
            var windowWidth = repeat * pixelSeconds;

            ScaleLinear xScale = new ScaleLinear(0.0, repeat, 0, windowWidth);

            while (curTime < duration) {
                for (var note : pianoRoll.getNotes()) {
                    var x = xScale.calc(note.getStart());

                    if (x < windowWidth) {
                        var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
                        var y = yScale.calc(noteNum);

                        var width = xScale.calc(note.getDuration());

                        if (x + width > windowWidth) {
                            width = windowWidth - x;
                        }

                        graphics.fillRect((int) x + xStart, (int) y, (int) width, noteHeight);
                    }
                }
                curTime += repeat;
                xStart += windowWidth;
            }

        } else if (pianoRoll.getTimeBehavior() == TimeBehavior.REPEAT_CLASSIC) {
            var duration = pianoRoll.getSubjectiveDuration();
            var repeat = pianoRoll.getRepeatPoint() > 0.0 ? pianoRoll.getRepeatPoint() : cache.notesDuration;

            var curTime = 0.0;
            var xStart = 0;
            var windowWidth = repeat * pixelSeconds;

            while (curTime + repeat < duration) {
                for (var note : pianoRoll.getNotes()) {
                    var x = note.getStart() * pixelSeconds;

                    var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
                    var y = yScale.calc(noteNum);

                    var width = note.getDuration() * pixelSeconds;

//                    if (x + width > w) {
//                        width = w - x;
//                    }
                    graphics.fillRect((int) x + xStart, (int) y, (int) width, noteHeight);

                }
                curTime += repeat;
                xStart += windowWidth;
            }

            var remainingDur = duration - curTime;

            for (var note : pianoRoll.getNotes()) {

                if (note.getStart() + note.getDuration() < remainingDur) {
                    var x = note.getStart() * pixelSeconds;
                    var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
                    var y = yScale.calc(noteNum);

                    var width = note.getDuration() * pixelSeconds;

//                    if (x + width > w) {
//                        width = w - x;
//                    }
                    graphics.fillRect((int) x + xStart, (int) y, (int) width, noteHeight);
                }
            }

        } else if (pianoRoll.getTimeBehavior() == TimeBehavior.NONE) {
            var w = getWidth();

            for (var note : pianoRoll.getNotes()) {
                var x = note.getStart() * pixelSeconds;

                if (x < w) {
                    var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();
                    var y = yScale.calc(noteNum);

                    var width = note.getDuration() * pixelSeconds;

                    graphics.fillRect((int) x, (int) y, (int) width, noteHeight);
                }
            }
        }

        graphics.translate(0, -transY);

    }

    protected PianoRollValueCache generateCache(PianoRoll pianoRoll) {
        PianoRollValueCache cache = new PianoRollValueCache();
        ArrayList<PianoNote> notes = pianoRoll.getNotes();

        if (notes.size() > 0) {
            int scaleDegrees = pianoRoll.getScale().getNumScaleDegrees();

            for (var note : notes) {
                var noteNum = note.getOctave() * scaleDegrees + note.getScaleDegree();

                cache.min = Math.min(cache.min, noteNum);
                cache.max = Math.max(cache.max, noteNum);
                cache.notesDuration = Math.max(cache.notesDuration, note.getStart() + note.getDuration());
            }

            cache.range = cache.max - cache.min + 1;
        }

        return cache;
    }

    class PianoRollValueCache {

        int max = 0;
        int min = Integer.MAX_VALUE;
        int range = -1;
        double notesDuration = 0.0;
    }

}
