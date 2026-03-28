/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor.pianoRoll;

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.score.TimeState;
import blue.soundObject.PianoRoll;
import blue.time.MeterMap;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.ui.core.score.TimeDisplayFormat;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.math.BigDecimal;
import java.math.RoundingMode;
import javax.swing.JComponent;
import javax.swing.UIManager;

/**
 * Time ruler for the PianoRoll editor.
 * 
 * Supports local and global ruler modes via {@link PianoRoll#isUseGlobalRuler()}.
 * Uses {@link TimeDisplayFormat} for label formatting and adapts the Score 
 * TimeBar's nice-numbers algorithm for tick spacing.
 * 
 * @author steven
 */
public final class TimeBar extends JComponent implements PropertyChangeListener, ScoreObjectListener {

    private static final Font LABEL_FONT = UIManager.getFont("Label.font")
            .deriveFont(Font.PLAIN, 10);
    private static final java.text.DecimalFormat BEAT_FORMAT = new java.text.DecimalFormat();

    private PianoRoll pianoRoll;
    private TimeState scoreTimeState;

    public TimeBar() {
        this.setDoubleBuffered(true);
        this.setLayout(null);
    }

    public void setScoreTimeState(TimeState scoreTimeState) {
        if (this.scoreTimeState != null) {
            this.scoreTimeState.removePropertyChangeListener(this);
        }
        this.scoreTimeState = scoreTimeState;
        if (scoreTimeState != null) {
            scoreTimeState.addPropertyChangeListener(this);
        }
        repaint();
    }

    @Override
    public void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);

        super.paintComponent(g);

        if (pianoRoll == null || this.getHeight() == 0 || this.getWidth() == 0) {
            return;
        }

        Rectangle bounds = g.getClipBounds();
        int h = 19;

        int startX = bounds.x;
        int endX = startX + bounds.width;

        double pixelTime = pianoRoll.getPixelSecond();
        TimeContext context = TimeContextManager.getContext();

        double beatOffset = pianoRoll.getRulerBeatOffset(context);
        TimeBase timeBase = pianoRoll.getEffectivePrimaryTimeDisplay(scoreTimeState);
        TimeDisplayFormat format = TimeDisplayFormat.fromTimeBase(timeBase);

        double startBeat = startX / pixelTime + beatOffset;
        double endBeat = endX / pixelTime + beatOffset;

        g.setColor(getForeground());
        g.drawLine(startX, h, endX, h);
        g.setFont(LABEL_FONT);

        switch (format) {
            case TIME, SECONDS -> drawTimeRuler(g, bounds, h, pixelTime, startBeat, endBeat, beatOffset, context, format);
            case BBT, BBST, BBF -> drawMeasureBeatsRuler(g, bounds, h, pixelTime, startBeat, endBeat, beatOffset, context);
            default -> drawBeatsRuler(g, bounds, h, pixelTime, startBeat, endBeat, beatOffset);
        }
    }

    private void drawBeatsRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startBeat, double endBeat, double beatOffset) {
        double majorBeatUnit = calcMajorBeatUnit(pixelTime);
        double startVal = Math.floor(startBeat / majorBeatUnit) * majorBeatUnit;

        for (double beat = startVal; beat < endBeat; beat += majorBeatUnit) {
            int x = (int) ((beat - beatOffset) * pixelTime);
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                String txt = BEAT_FORMAT.format(beat);
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 14);
            }
        }
    }

    private void drawTimeRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startBeat, double endBeat, double beatOffset,
            TimeContext context, TimeDisplayFormat format) {
        double startSeconds = TimeDisplayFormat.beatsToSeconds(startBeat, context);
        double endSeconds = TimeDisplayFormat.beatsToSeconds(endBeat, context);

        int nticks = Math.max(bounds.width / 80, 2);
        double range = niceNum(endSeconds - startSeconds, false);
        double d = niceNum(range / (nticks - 1), true);
        double graphMin = Math.floor(startSeconds / d) * d;
        double graphMax = Math.ceil(endSeconds / d) * d;
        int nfrac = (int) Math.max(-Math.floor(Math.log10(d)), 0);

        for (double seconds = graphMin; seconds < graphMax + 0.5 * d; seconds += d) {
            double beatPos = TimeDisplayFormat.secondsToBeats(seconds, context);
            int x = (int) ((beatPos - beatOffset) * pixelTime);

            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                String txt = format == TimeDisplayFormat.SECONDS
                        ? formatSeconds(seconds, nfrac)
                        : formatTime(seconds, nfrac);
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 14);
            }
        }
    }

    private String formatSeconds(double seconds, int nfrac) {
        int scale = Math.max(1, Math.min(nfrac, 6));
        String text = BigDecimal.valueOf(seconds)
                .setScale(scale, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString();
        return text.contains(".") ? text : text + ".0";
    }

    private void drawMeasureBeatsRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startBeat, double endBeat, double beatOffset,
            TimeContext context) {
        if (context == null || context.getMeterMap() == null) {
            drawBeatsRuler(g, bounds, h, pixelTime, startBeat, endBeat, beatOffset);
            return;
        }

        var meterMap = context.getMeterMap();

        var firstMeter = meterMap.get(0).getMeter();
        double approxBeatsPerMeasure = firstMeter.getMeasureBeatDuration();
        double approxPixelsPerMeasure = approxBeatsPerMeasure * pixelTime;
        double pixelsPerBeat = pixelTime;

        int minLabelSpacing = 60;
        int measureGrouping = 1;
        boolean showBeats = false;

        if (approxPixelsPerMeasure < minLabelSpacing) {
            while (measureGrouping * approxPixelsPerMeasure < minLabelSpacing) {
                measureGrouping *= 2;
            }
        } else if (pixelsPerBeat >= minLabelSpacing) {
            showBeats = true;
        }

        var startBBST = meterMap.beatsToBBST(Math.max(0, startBeat), TimeContext.DEFAULT_PPQ);
        long startMeasure = startBBST.getBar();

        if (measureGrouping > 1) {
            startMeasure = ((startMeasure - 1) / measureGrouping) * measureGrouping + 1;
        }

        long currentMeasure = startMeasure;
        Color normalColor = g.getColor();
        Color separatorColor = normalColor.darker();

        while (true) {
            double measureStartBeat = getMeasureStartBeat(meterMap, currentMeasure);

            if (measureStartBeat > endBeat + approxBeatsPerMeasure) {
                break;
            }

            if (measureStartBeat >= 0) {
                int x = (int) ((measureStartBeat - beatOffset) * pixelTime);
                if (x >= bounds.x - 50 && x <= bounds.x + bounds.width + 50) {
                    String txt = String.valueOf(currentMeasure);
                    g.setColor(normalColor);
                    g.drawLine(x, 0, x, h);
                    g.drawString(txt, x + 2, 14);
                }

                if (showBeats && measureGrouping == 1) {
                    var meter = getMeterAtMeasure(meterMap, currentMeasure);
                    int numBeats = (int) meter.numBeats;
                    double beatDuration = 4.0 / meter.beatLength;

                    for (int beat = 2; beat <= numBeats; beat++) {
                        double beatPos = measureStartBeat + (beat - 1) * beatDuration;
                        if (beatPos > endBeat) break;

                        int beatX = (int) ((beatPos - beatOffset) * pixelTime);
                        if (beatX >= bounds.x - 50 && beatX <= bounds.x + bounds.width + 50) {
                            g.setColor(normalColor);
                            g.drawLine(beatX, 10, beatX, h);

                            String measurePart = String.valueOf(currentMeasure);
                            String beatPart = String.valueOf(beat);
                            int measureWidth = g.getFontMetrics().stringWidth(measurePart);

                            g.drawString(measurePart, beatX + 2, 14);
                            g.setColor(separatorColor);
                            g.drawString("|", beatX + 2 + measureWidth, 14);
                            g.setColor(normalColor);
                            int separatorWidth = g.getFontMetrics().stringWidth("|");
                            g.drawString(beatPart, beatX + 2 + measureWidth + separatorWidth, 14);
                        }
                    }
                }
            }

            currentMeasure += measureGrouping;
        }
        g.setColor(normalColor);
    }

    private double getMeasureStartBeat(MeterMap meterMap, long measureNumber) {
        if (measureNumber <= 1) {
            return 0.0;
        }

        double beats = 0.0;
        long processedUpToMeasure = 1;

        for (int i = 0; i < meterMap.size(); i++) {
            var entry = meterMap.get(i);
            long entryStartMeasure = entry.getMeasureNumber();
            var meter = entry.getMeter();
            double beatsPerMeasure = meter.getMeasureBeatDuration();

            long meterEndMeasure;
            if (i + 1 < meterMap.size()) {
                meterEndMeasure = meterMap.get(i + 1).getMeasureNumber();
            } else {
                meterEndMeasure = Long.MAX_VALUE;
            }

            if (measureNumber <= entryStartMeasure) {
                break;
            }

            long sectionStart = Math.max(entryStartMeasure, processedUpToMeasure);
            long sectionEnd = Math.min(measureNumber, meterEndMeasure);
            long measuresInSection = sectionEnd - sectionStart;

            if (measuresInSection > 0) {
                beats += measuresInSection * beatsPerMeasure;
                processedUpToMeasure = sectionEnd;
            }

            if (processedUpToMeasure >= measureNumber) {
                break;
            }
        }

        return beats;
    }

    private blue.time.Meter getMeterAtMeasure(MeterMap meterMap, long measureNumber) {
        blue.time.Meter meter = meterMap.get(0).getMeter();
        for (int i = 0; i < meterMap.size(); i++) {
            var entry = meterMap.get(i);
            if (entry.getMeasureNumber() <= measureNumber) {
                meter = entry.getMeter();
            } else {
                break;
            }
        }
        return meter;
    }

    private double calcMajorBeatUnit(double pixelTime) {
        int minMajorWidth = 100;
        var v = Math.log(pixelTime / minMajorWidth) / Math.log(2);
        return 1.0 / Math.pow(2, (int) v);
    }

    private String formatTime(double seconds, int nfrac) {
        int totalSeconds = (int) seconds;
        int minutes = totalSeconds / 60;
        int secs = totalSeconds % 60;
        double fracSeconds = seconds - totalSeconds;

        if (nfrac > 0) {
            double scaledFrac = Math.round(fracSeconds * Math.pow(10, nfrac));
            // Handle carry-over when fractional part rounds to 1.0
            if (scaledFrac >= Math.pow(10, nfrac)) {
                scaledFrac = 0;
                secs++;
                if (secs >= 60) {
                    secs = 0;
                    minutes++;
                }
            }
            int millis = (int) scaledFrac;
            String fracFormat = "%0" + nfrac + "d";
            return String.format("%d:%02d." + fracFormat, minutes, secs, millis);
        }
        return String.format("%d:%02d", minutes, secs);
    }

    private double niceNum(double x, boolean round) {
        if (x == 0) return 0;

        double absX = Math.abs(x);
        long exp = (long) Math.floor(Math.log10(absX));
        double f = absX / Math.pow(10, exp);
        double nf;

        if (round) {
            if (f < 1.5) nf = 1;
            else if (f < 3) nf = 2;
            else if (f < 7) nf = 5;
            else nf = 10;
        } else {
            if (f <= 1) nf = 1;
            else if (f <= 2) nf = 2;
            else if (f <= 5) nf = 5;
            else nf = 10;
        }
        return nf * Math.pow(10, exp);
    }

    public void editPianoRoll(PianoRoll pianoRoll) {
        if (this.pianoRoll != null) {
            this.pianoRoll.removePropertyChangeListener(this);
            this.pianoRoll.removeScoreObjectListener(this);
        }

        this.pianoRoll = pianoRoll;

        if (pianoRoll != null) {
            pianoRoll.addPropertyChangeListener(this);
            pianoRoll.addScoreObjectListener(this);
        }

        repaint();
    }

    @Override
    public void scoreObjectChanged(ScoreObjectEvent event) {
        if (event.getScoreObject() == this.pianoRoll
                && event.getPropertyChanged() == ScoreObjectEvent.START_TIME) {
            if (pianoRoll.isUseGlobalRuler()) {
                repaint();
            }
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.pianoRoll) {
            String prop = evt.getPropertyName();
            if (prop.equals("primaryTimeDisplay") || prop.equals("useGlobalRuler")
                    || prop.equals("pixelSecond") || prop.equals("secondaryRulerEnabled")
                    || prop.equals("secondaryTimeDisplay")) {
                repaint();
            }
        } else if (evt.getSource() == this.scoreTimeState) {
            if (pianoRoll != null && pianoRoll.isUseGlobalRuler()) {
                repaint();
            }
        }
    }
}