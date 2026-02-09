/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Paint;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;

import org.openide.util.Lookup;

import blue.BlueData;
import blue.score.TimeState;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.ui.utilities.BlueGradientFactory;
import blue.ui.utilities.UiUtilities;
import blue.utilities.MemoizedFunction;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public final class TimeBar extends JPanel implements
        PropertyChangeListener, RenderTimeManagerListener {

    private static final Font LABEL_FONT = UIManager.getFont("Label.font")
            .deriveFont(Font.PLAIN, 11);

    // BufferedImage bufferedImage;
    // Image image;
    private BlueData data;

    private TimeState timeState;

    private final Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    private double renderStart = 0.0f;

    private double timePointer = 0.0f;

    private boolean rootTimeline = true;
    
    private TimeDisplayFormat displayFormat = TimeDisplayFormat.BEATS;
    
    // Selection state for drag-to-select
    private boolean isDragging = false;
    private double dragStartTime = -1;
    private int dragStartX = -1;
    private static final int DRAG_THRESHOLD = 5; // pixels before drag is recognized
    private static final Color SELECTION_COLOR = new Color(100, 150, 255, 80);
    
    private static final java.text.DecimalFormat BEAT_FORMAT = new java.text.DecimalFormat();

    MemoizedFunction<Double, Double> getMajorTimeUnit = new MemoizedFunction<>(
            this::calcMajorTimeUnit);

    MemoizedFunction<Double, Double> getMajorBeatUnit = new MemoizedFunction<>(
            this::calcMajorBeatUnit);

    RenderTimeManager renderTimeManager
            = Lookup.getDefault().lookup(RenderTimeManager.class);

    public TimeBar() {
        this.setDoubleBuffered(true);
        this.setLayout(null);

        // this.add(playMarker);
        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent e) {
                if (!rootTimeline || data == null || timeState == null) {
                    return;
                }

                int x = Math.max(0, e.getX());
                double time = (double) x / timeState.getPixelSecond();

                if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                    TimeContext ctx = TimeContextManager.getContext();
                    double sv = timeState.getSnapValueInBeats(time, ctx.getTempoMap(), ctx.getSampleRate());
                    time = Math.round(time / sv) * sv;
                }

                if (SwingUtilities.isLeftMouseButton(e)) {
                    // Start potential drag operation
                    isDragging = false;
                    dragStartX = x;
                    dragStartTime = time;
                } else if (UiUtilities.isRightMouseButton(e)) {
                    // Right-click sets render end immediately
                    data.setRenderEndTime(time);
                }
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                if (!rootTimeline || data == null || timeState == null) {
                    return;
                }

                if (SwingUtilities.isLeftMouseButton(e)) {
                    if (!isDragging && dragStartTime >= 0) {
                        // Click without drag - set render start and clear selection
                        data.setRenderStartTime(dragStartTime);
                        data.setRenderEndTime(-1.0);
                    }
                    // Reset drag state
                    isDragging = false;
                    dragStartX = -1;
                    dragStartTime = -1;
                }
            }
        });

        this.addMouseMotionListener(new MouseMotionAdapter() {

            @Override
            public void mouseDragged(MouseEvent e) {
                if (!rootTimeline || data == null || timeState == null) {
                    return;
                }

                int x = Math.max(0, e.getX());
                double time = (double) x / timeState.getPixelSecond();

                if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                    TimeContext ctx = TimeContextManager.getContext();
                    double sv = timeState.getSnapValueInBeats(time, ctx.getTempoMap(), ctx.getSampleRate());
                    time = Math.round(time / sv) * sv;
                }

                if (SwingUtilities.isLeftMouseButton(e)) {
                    // Check if we've exceeded drag threshold
                    if (!isDragging && dragStartX >= 0 && Math.abs(x - dragStartX) > DRAG_THRESHOLD) {
                        isDragging = true;
                    }
                    
                    if (isDragging) {
                        // Handle selection - ensure start < end regardless of drag direction
                        double selStart = Math.min(dragStartTime, time);
                        double selEnd = Math.max(dragStartTime, time);
                        data.setRenderStartTime(selStart);
                        data.setRenderEndTime(selEnd);
                        checkScroll(e.getPoint());
                        repaint();
                    }
                } else if (UiUtilities.isRightMouseButton(e)) {
                    data.setRenderEndTime(time);
                    checkScroll(e.getPoint());
                }
            }
        });

        renderTimeManager.addPropertyChangeListener(this);
        renderTimeManager.addRenderTimeManagerListener(this);
    }

    @Override
    public void paintComponent(Graphics g) {

        Graphics2D g2d = (Graphics2D) g;

        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        Paint p = g2d.getPaint();
        g2d.setPaint(BlueGradientFactory.getGradientPaint(getBackground()));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        g2d.setPaint(p);

        if (timeState == null || this.getHeight() == 0 || this.getWidth() == 0) {
            return;
        }

        drawLinesAndNumbers(g);

        if (rootTimeline && data != null) {
            // Get clip bounds to account for scroll offset
            Rectangle clipBounds = g.getClipBounds();
            double pixelTime = timeState.getPixelSecond();
            double startTime = clipBounds.x / pixelTime;
            
            // Draw selection range highlight (between render start and end)
            double renderStartTime = data.getRenderStartTime();
            double renderLoopTime = data.getRenderEndTime();
            if (renderLoopTime >= 0.0f && renderLoopTime > renderStartTime) {
                int selStartX = (int) ((renderStartTime - startTime) * pixelTime) + clipBounds.x;
                int selEndX = (int) ((renderLoopTime - startTime) * pixelTime) + clipBounds.x;
                // Clamp to visible bounds
                selStartX = Math.max(clipBounds.x, selStartX);
                selEndX = Math.min(clipBounds.x + clipBounds.width, selEndX);
                if (selEndX > selStartX) {
                    g.setColor(SELECTION_COLOR);
                    g.fillRect(selStartX, 0, selEndX - selStartX, this.getHeight());
                }
            }
            
            // Draw render start marker (green)
            g.setColor(Color.GREEN);
            int x = (int) ((renderStartTime - startTime) * pixelTime) + clipBounds.x;
            if (x >= clipBounds.x - 1 && x <= clipBounds.x + clipBounds.width + 1) {
                g.drawLine(x, 0, x, this.getHeight());
            }

            // Draw render end marker (yellow)
            if (renderLoopTime >= 0.0f) {
                g.setColor(Color.YELLOW);
                x = (int) ((renderLoopTime - startTime) * pixelTime) + clipBounds.x;
                if (x >= clipBounds.x - 1 && x <= clipBounds.x + clipBounds.width + 1) {
                    g.drawLine(x, 0, x, this.getHeight());
                }
            }

            // Draw playback position marker (orange)
            if (renderTimeManager.isCurrentProjectRendering()) {
                if (timePointer >= 0.0f && renderStart >= 0.0f) {
                    g.setColor(Color.ORANGE);
                    double playbackTime = timePointer;
                    x = (int) ((playbackTime - startTime) * pixelTime) + clipBounds.x;
                    if (x >= clipBounds.x - 1 && x <= clipBounds.x + clipBounds.width + 1) {
                        g.drawLine(x, 0, x, this.getHeight());
                    }
                }
            }
        }
    }

    private double calcMajorBeatUnit(double pixelTime) {
        int minMajorWidth = 100;

        var v = Math.log(pixelTime / minMajorWidth) / Math.log(2);
        var majorBeatUnit = 1.0 / Math.pow(2, (int) v);

        return majorBeatUnit;
    }

    private double calcMajorTimeUnit(double pixelTime) {
        int minMajorWidth = 100;

        double majorTimeUnit = 0;
        double[] units = {1, 2, 4, 10, 15, 20, 30, 60, 150, 300, 600, 900, 1200, 1800, 3600, 7200, 14400};
        var width = 0.0;

        if (pixelTime < minMajorWidth) {
            for (int i = 0; i < units.length && width < minMajorWidth; i++) {
                width = units[i] * pixelTime;
                majorTimeUnit = units[i];
            }

        } else {
            var v = Math.log(pixelTime / minMajorWidth) / Math.log(2);
            majorTimeUnit = 1.0 / Math.pow(2, (int) v);
        }
        return majorTimeUnit;
    }

    private void drawLinesAndNumbers(Graphics g) {
        Rectangle bounds = g.getClipBounds();

        int h = 19;

        double pixelTime = timeState.getPixelSecond();

        g.setColor(getForeground());

        int startX = bounds.x;
        int endX = startX + bounds.width;

        double startTime = startX / (double) pixelTime;
        double endTime = endX / (double) pixelTime;
        double duration = endTime - startTime;

        g.drawLine(startX, h, endX, h);

        // Get TimeContext for formatting
        TimeContext context = (data != null) ? data.getScore().getTimeContext() : null;
        
        // Choose rendering based on display format
        switch (displayFormat) {
            case TIME, SMPTE -> drawTimeBasedRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
            case SAMPLES -> drawSamplesRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
            case BBT, BBST, BBF -> drawMeasureBeatsRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
            default -> drawBeatsRuler(g, bounds, h, pixelTime, startTime, endTime, duration);
        }

        //        GraphLabels.drawTicks(startTime, endTime, (int) (bounds.width / 64),
        //                (num, nfrac) -> {
        //                    df.setMaximumFractionDigits(nfrac);
        //                    df.setMinimumFractionDigits(nfrac);
        ////                    String txt = df.format(num);
        //                    String txt = TimeUtilities.convertSecondsToTimeString(num);
        //                    int x = (int) (bounds.width * (num - startTime) / duration) + startX;
        //                    g.drawLine(x, 10, x, h);
        //                    g.drawString(txt, 0 + x + 2, 16);
        //                });
        //        
        //        
        //        int lastVal = 0;
        //
        //        int divisions = getWidth() / pixelTime;
        //
        ////        int longHeight = (int) (h * .5);
        ////        int shortHeight = (int) (h * .75);
        //        int longHeight = h - 6;
        //        int shortHeight = h - 3;
        //
        //        int start = (startX / pixelTime);
        //        int end = (endX / pixelTime) + 1;
        //
        //        end = end > divisions ? divisions : end;
        //
        //        for (int i = start; i < end; i++) {
        //            int lineX = i * pixelTime;
        //
        //            if (i % timeUnit == 0) {
        //                if (lineX == 0 || lineX - lastVal > textWidth) {
        //                    g.drawLine(lineX, h, lineX, longHeight);
        //                    lastVal = lineX;
        //                } else {
        //                    g.drawLine(lineX, h, lineX, shortHeight);
        //                }
        //            } else {
        //                g.drawLine(lineX, h, lineX, shortHeight);
        //            }
        //        }
        //
        //        // DRAW LABELS
        //        g.setFont(LABEL_FONT);
        //        lastVal = 0;
        //        for (int i = start; i < end; i++) {
        //            if (i % timeUnit == 0) {
        //                String time = "";
        //
        //                if (timeDisplay == PolyObject.DISPLAY_TIME) {
        //                    int min = i / 60;
        //                    int sec = i % 60;
        //                    String seconds = (sec < 10) ? "0" + sec : String.valueOf(sec);
        //                    time = min + ":" + seconds;
        //                } else if (timeDisplay == PolyObject.DISPLAY_BEATS) {
        //                    time = Integer.toString(i);
        //                }
        //
        //                int labelX = (i * pixelTime);
        //
        //                if (labelX == 0 || labelX - lastVal > textWidth) {
        //                    g.drawString(time, labelX + 3, 14);
        //                    lastVal = labelX;
        //                }
        //            }
        //        }
    }
    
    /**
     * Draws ruler using Csound beats format (0, 1, 2, 3...)
     * Csound beats are 0-indexed.
     */
    private void drawBeatsRuler(Graphics g, Rectangle bounds, int h, 
            double pixelTime, double startTime, double endTime, double duration) {
        double majorBeatUnit = getMajorBeatUnit.invoke(pixelTime);
        var startVal = Math.floor(startTime / majorBeatUnit) * majorBeatUnit;

        for (double i = startVal; i < endTime; i += majorBeatUnit) {
            // Calculate x position directly: beat position * pixels per beat
            int x = (int) (i * pixelTime);
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                String txt = BEAT_FORMAT.format(i);
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 16);
            }
        }
    }
    
    /**
     * Draws ruler using time format (0:00, 0:01...)
     * Uses Paul Heckbert's "Nice Numbers" algorithm for adaptive scaling.
     * Note: The timeline is in beats, so we need to convert between beats and seconds.
     */
    private void drawTimeBasedRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startBeat, double endBeat, double beatDuration,
            TimeContext context) {
        // Convert beat range to seconds for calculating time increments
        double startSeconds = TimeDisplayFormat.beatsToSeconds(startBeat, context);
        double endSeconds = TimeDisplayFormat.beatsToSeconds(endBeat, context);
        
        // Use nice numbers algorithm for adaptive tick spacing
        int nticks = Math.max(bounds.width / 80, 2); // Aim for ~80 pixels between ticks
        double range = niceNum(endSeconds - startSeconds, false);
        double d = niceNum(range / (nticks - 1), true);
        double graphMin = Math.floor(startSeconds / d) * d;
        double graphMax = Math.ceil(endSeconds / d) * d;
        int nfrac = (int) Math.max(-Math.floor(Math.log10(d)), 0);
        
        for (double seconds = graphMin; seconds < graphMax + 0.5 * d; seconds += d) {
            // Convert seconds back to beat position for x calculation
            double beatPos = TimeDisplayFormat.secondsToBeats(seconds, context);
            int x = (int) (bounds.width * (beatPos - startBeat) / beatDuration) + bounds.x;
            
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                String txt = formatTimeWithPrecision(seconds, nfrac);
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 16);
            }
        }
    }
    
    /**
     * Format seconds as time string with appropriate precision.
     * @param seconds the time in seconds
     * @param nfrac number of fractional digits needed
     */
    private String formatTimeWithPrecision(double seconds, int nfrac) {
        int totalSeconds = (int) seconds;
        int minutes = totalSeconds / 60;
        int secs = totalSeconds % 60;
        double fracSeconds = seconds - totalSeconds;
        
        if (minutes >= 60) {
            int hours = minutes / 60;
            minutes = minutes % 60;
            if (nfrac > 0) {
                int millis = (int) Math.round(fracSeconds * Math.pow(10, nfrac));
                String fracFormat = "%0" + nfrac + "d";
                return String.format("%d:%02d:%02d." + fracFormat, hours, minutes, secs, millis);
            }
            return String.format("%d:%02d:%02d", hours, minutes, secs);
        }
        
        if (nfrac > 0) {
            int millis = (int) Math.round(fracSeconds * Math.pow(10, nfrac));
            String fracFormat = "%0" + nfrac + "d";
            return String.format("%d:%02d." + fracFormat, minutes, secs, millis);
        }
        return String.format("%d:%02d", minutes, secs);
    }
    
    /**
     * Draws ruler using measure:beats format with musical powers-of-2 grouping.
     * Properly handles time signature changes by iterating through actual measure boundaries.
     * - Zoomed out: labels every 32, 16, 8, 4, 2 measures
     * - Medium: labels every measure
     * - Zoomed in: labels measure + whole beats (respecting meter)
     */
    private void drawMeasureBeatsRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startTime, double endTime, double duration,
            TimeContext context) {
        
        if (context == null || context.getMeterMap() == null) {
            // Fallback to simple beats ruler
            drawBeatsRuler(g, bounds, h, pixelTime, startTime, endTime, duration);
            return;
        }
        
        var meterMap = context.getMeterMap();
        
        // Get approximate pixels per measure using first meter (for determining grouping level)
        var firstMeter = meterMap.get(0).getMeter();
        double approxBeatsPerMeasure = firstMeter.getMeasureBeatDuration();
        double approxPixelsPerMeasure = approxBeatsPerMeasure * pixelTime;
        double pixelsPerBeat = pixelTime;
        
        // We want at least ~60 pixels between labels
        int minLabelSpacing = 60;
        
        // Determine the display level:
        // Level 1: Group measures by powers of 2 (1, 2, 4, 8, 16, 32...)
        // Level 2: Show every measure
        // Level 3: Show measure + whole beats
        
        int measureGrouping = 1;
        boolean showBeats = false;
        
        if (approxPixelsPerMeasure < minLabelSpacing) {
            // Zoomed out - group measures by powers of 2
            while (measureGrouping * approxPixelsPerMeasure < minLabelSpacing) {
                measureGrouping *= 2;
            }
        } else if (pixelsPerBeat >= minLabelSpacing) {
            // Zoomed in enough to show individual beats
            showBeats = true;
        }
        // else: show every measure (measureGrouping = 1, showBeats = false)
        
        // Find the starting measure from the start beat position
        var startBBST = meterMap.beatsToBBST(Math.max(0, startTime), context.getPPQ());
        long startMeasure = startBBST.getBar();
        
        // Align to measure grouping
        if (measureGrouping > 1) {
            startMeasure = ((startMeasure - 1) / measureGrouping) * measureGrouping + 1;
        }
        
        // Iterate through measures and draw labels
        long currentMeasure = startMeasure;
        Color normalColor = g.getColor();
        Color separatorColor = normalColor.darker();
        
        while (true) {
            // Get the beat position for the start of this measure
            double measureStartBeat = getMeasureStartBeat(meterMap, currentMeasure);
            
            if (measureStartBeat > endTime + approxBeatsPerMeasure) {
                break; // Past the visible range
            }
            
            if (measureStartBeat >= 0) {
                // Draw measure label with full-height line
                // Calculate x position directly: beat position * pixels per beat
                int x = (int) (measureStartBeat * pixelTime);
                if (x >= bounds.x - 50 && x <= bounds.x + bounds.width + 50) {
                    String txt = String.valueOf(currentMeasure);
                    g.setColor(normalColor);
                    g.drawLine(x, 0, x, h);  // Full height line for measures
                    g.drawString(txt, x + 2, 16);
                }
                
                // If showing beats, draw beat labels within this measure
                if (showBeats && measureGrouping == 1) {
                    var meter = getMeterAtMeasure(meterMap, currentMeasure);
                    int numBeats = (int) meter.numBeats;
                    double beatDuration = 4.0 / meter.beatLength; // Duration of one beat in Csound beats
                    
                    for (int beat = 2; beat <= numBeats; beat++) {
                        double beatPos = measureStartBeat + (beat - 1) * beatDuration;
                        if (beatPos > endTime) break;
                        
                        // Calculate x position directly: beat position * pixels per beat
                        int beatX = (int) (beatPos * pixelTime);
                        if (beatX >= bounds.x - 50 && beatX <= bounds.x + bounds.width + 50) {
                            // Draw partial line for beats (not full height)
                            g.setColor(normalColor);
                            g.drawLine(beatX, 10, beatX, h);
                            
                            // Draw measure|beat label with darker separator
                            String measurePart = String.valueOf(currentMeasure);
                            String beatPart = String.valueOf(beat);
                            int measureWidth = g.getFontMetrics().stringWidth(measurePart);
                            
                            g.drawString(measurePart, beatX + 2, 16);
                            g.setColor(separatorColor);
                            g.drawString("|", beatX + 2 + measureWidth, 16);
                            g.setColor(normalColor);
                            int separatorWidth = g.getFontMetrics().stringWidth("|");
                            g.drawString(beatPart, beatX + 2 + measureWidth + separatorWidth, 16);
                        }
                    }
                }
            }
            
            currentMeasure += measureGrouping;
        }
        g.setColor(normalColor);
    }
    
    /**
     * Get the beat position for the start of a measure.
     * Calculates by iterating through meter entries.
     */
    private double getMeasureStartBeat(blue.time.MeterMap meterMap, long measureNumber) {
        if (measureNumber <= 1) {
            return 0.0;
        }
        
        double beats = 0.0;
        long processedUpToMeasure = 1; // We've accounted for beats up to (but not including) this measure
        
        for (int i = 0; i < meterMap.size(); i++) {
            var entry = meterMap.get(i);
            long entryStartMeasure = entry.getMeasureNumber();
            var meter = entry.getMeter();
            double beatsPerMeasure = meter.getMeasureBeatDuration();
            
            // Find where this meter section ends
            long meterEndMeasure;
            if (i + 1 < meterMap.size()) {
                meterEndMeasure = meterMap.get(i + 1).getMeasureNumber();
            } else {
                meterEndMeasure = Long.MAX_VALUE; // This meter continues forever
            }
            
            // How many measures in this meter section contribute to our target?
            if (measureNumber <= entryStartMeasure) {
                // Target measure is before this meter entry starts
                break;
            }
            
            // Calculate measures to count in this section
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
    
    /**
     * Get the meter in effect at a given measure.
     */
    private blue.time.Meter getMeterAtMeasure(blue.time.MeterMap meterMap, long measureNumber) {
        // Find the meter entry that applies to this measure
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
    
    /**
     * Draws ruler using samples format (0, 44100, 88200...)
     * Uses Paul Heckbert's "Nice Numbers" algorithm for adaptive scaling.
     * Note: Samples correlate to time, so we use time-based calculation.
     */
    private void drawSamplesRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startBeat, double endBeat, double beatDuration,
            TimeContext context) {
        // Convert beat range to seconds
        double startSeconds = TimeDisplayFormat.beatsToSeconds(startBeat, context);
        double endSeconds = TimeDisplayFormat.beatsToSeconds(endBeat, context);
        
        // Get sample rate (default 44100)
        int sampleRate = getSampleRate(context);
        
        // Calculate sample range
        double startSample = startSeconds * sampleRate;
        double endSample = endSeconds * sampleRate;
        
        // Use nice numbers algorithm for adaptive tick spacing
        int nticks = Math.max(bounds.width / 80, 2); // Aim for ~80 pixels between ticks
        double range = niceNum(endSample - startSample, false);
        double d = niceNum(range / (nticks - 1), true);
        double graphMin = Math.floor(startSample / d) * d;
        double graphMax = Math.ceil(endSample / d) * d;
        int nfrac = (int) Math.max(-Math.floor(Math.log10(d)), 0);
        
        for (double sample = graphMin; sample < graphMax + 0.5 * d; sample += d) {
            // Convert sample back to beat position for x calculation
            double seconds = sample / sampleRate;
            double beatPos = TimeDisplayFormat.secondsToBeats(seconds, context);
            int x = (int) (bounds.width * (beatPos - startBeat) / beatDuration) + bounds.x;
            
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                String txt = formatSampleCountWithPrecision(sample, nfrac);
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 16);
            }
        }
    }
    
    /**
     * Get sample rate from context or use default.
     */
    private int getSampleRate(TimeContext context) {
        // TODO: Get from project settings when available
        return 44100;
    }
    
    /**
     * Format sample count for display with appropriate precision based on zoom level.
     * @param samples the sample count (can be fractional for display purposes)
     * @param nfrac number of fractional digits needed for the base unit
     */
    private String formatSampleCountWithPrecision(double samples, int nfrac) {
        // Determine the best unit (M, k, or raw) based on the magnitude
        if (Math.abs(samples) >= 1000000) {
            double val = samples / 1000000.0;
            // Calculate precision needed for millions
            int mfrac = Math.max(0, nfrac - 6);
            if (mfrac == 0 && val == Math.floor(val)) {
                return String.format("%dM", (long) val);
            }
            // Show enough decimals to distinguish values
            int displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 5 : 1));
            return String.format("%%.%dfM".formatted(displayFrac), val);
        } else if (Math.abs(samples) >= 1000) {
            double val = samples / 1000.0;
            // Calculate precision needed for thousands
            int kfrac = Math.max(0, nfrac - 3);
            if (kfrac == 0 && val == Math.floor(val)) {
                return String.format("%dk", (long) val);
            }
            int displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 2 : 1));
            return String.format("%%.%dfk".formatted(displayFrac), val);
        }
        // Raw sample count
        if (nfrac == 0 || samples == Math.floor(samples)) {
            return String.valueOf((long) samples);
        }
        return String.format("%%.%df".formatted(nfrac), samples);
    }
    
    /**
     * Paul Heckbert's "Nice Numbers" algorithm for graph labels.
     * Returns a "nice" number approximately equal to x.
     * Rounds the number if round is true, takes ceiling if false.
     */
    private double niceNum(double x, boolean round) {
        if (x == 0) return 0;
        
        long exp = (long) Math.floor(Math.log10(Math.abs(x)));
        double f = x / Math.pow(10, exp);
        double nf;
        
        if (round) {
            if (f < 1.5) {
                nf = 1;
            } else if (f < 3) {
                nf = 2;
            } else if (f < 7) {
                nf = 5;
            } else {
                nf = 10;
            }
        } else {
            if (f <= 1) {
                nf = 1;
            } else if (f <= 2) {
                nf = 2;
            } else if (f <= 5) {
                nf = 5;
            } else {
                nf = 10;
            }
        }
        return nf * Math.pow(10, exp);
    }
    
    /**
     * Sets the display format for the timeline ruler.
     * @param format the TimeDisplayFormat to use
     */
    public void setDisplayFormat(TimeDisplayFormat format) {
        if (format != null && format != this.displayFormat) {
            this.displayFormat = format;
            repaint();
        }
    }
    
    /**
     * Gets the current display format.
     * @return the current TimeDisplayFormat
     */
    public TimeDisplayFormat getDisplayFormat() {
        return displayFormat;
    }

    /**
     * @param data
     */
    public void setData(BlueData data) {
        if (this.data != null) {
            this.data.removePropertyChangeListener(this);
        }

        this.data = data;

        data.addPropertyChangeListener(this);

        // FIXME - should be using Score object
        //setPolyObject(data.getPolyObject());
        setTimeState(data.getScore().getTimeState());

    }

    public void setRootTimeline(boolean rootTimeline) {
        this.rootTimeline = rootTimeline;
    }

    /**
     * @param timeState
     */
    protected void setTimeState(TimeState timeState) {
        if (this.timeState != null) {
            this.timeState.removePropertyChangeListener(this);
        }

        this.removeAll();

        this.timeState = timeState;

        this.timeState.addPropertyChangeListener(this);

        // updateBuffer();
        repaint();
    }

    private void checkScroll(Point p) {

        JScrollPane scrollPane = UiUtilities.findParentScrollPane(this);

        Point newPoint = new Point(p.x,
                scrollPane.getViewport().getViewPosition().y);

        scrollRect.setLocation(newPoint);

        JComponent view = (JComponent) scrollPane.getViewport().getView();
        view.scrollRectToVisible(scrollRect);

    }

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.PropertyChangeListener#propertyChange(java.beans.PropertyChangeEvent)
     */
    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();

        if (evt.getSource() == this.data && (prop.equals("renderStartTime") || prop.
                equals("renderLoopTime"))) {
            repaint();
        } else if (evt.getSource() == this.timeState) {
            if (prop.equals("timeDisplay") || prop.equals("timeUnit") || prop.
                    equals("pixelSecond")) {
                // updateBuffer();

                repaint();
            }
        } else if (evt.getSource() == renderTimeManager) {
            if (prop.equals(RenderTimeManager.RENDER_START)) {
                this.renderStart = ((Double) evt.getNewValue()).doubleValue();
                this.timePointer = -1.0f;
                repaint();
            }
        }
    }

    @Override
    public void renderInitiated() {
    }

    @Override
    public void renderEnded() {
    }

    @Override
    public void renderTimeUpdated(double beatTime, double secondsTime) {
        this.timePointer = beatTime;
        repaint();
    }

}
