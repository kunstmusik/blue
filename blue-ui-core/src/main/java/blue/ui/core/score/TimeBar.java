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
import blue.settings.PlaybackSettings;
import blue.time.TimeContext;
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

            int start;

            @Override
            public void mousePressed(MouseEvent e) {
                if (!rootTimeline) {
                    return;
                }

                start = e.getX();

                if (start < 0) {
                    start = 0;
                }

                double time = (double) start / timeState.getPixelSecond();

                if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                    time = Math.round(time / timeState.getSnapValue()) * timeState.getSnapValue();
                }

                if (SwingUtilities.isLeftMouseButton(e)) {

                    data.setRenderStartTime(time);

                } else if (UiUtilities.isRightMouseButton(e)) {
                    data.setRenderEndTime(time);
                }

            }

        });

        this.addMouseMotionListener(new MouseMotionAdapter() {

            @Override
            public void mouseDragged(MouseEvent e) {
                if (!rootTimeline) {
                    return;
                }

                int start = e.getX();

                if (start < 0) {
                    start = 0;
                }

                double time = (double) start / timeState.getPixelSecond();

                if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                    time = Math.round(time / timeState.getSnapValue()) * timeState.getSnapValue();
                }

                if (SwingUtilities.isLeftMouseButton(e)) {
                    data.setRenderStartTime(time);
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

        if (rootTimeline) {
            g.setColor(Color.GREEN);
            int x = (int) (data.getRenderStartTime() * timeState.getPixelSecond());
            g.drawLine(x, 0, x, this.getHeight());

            double renderLoopTime = data.getRenderEndTime();

            if (renderLoopTime >= 0.0f) {
                g.setColor(Color.YELLOW);
                x = (int) (data.getRenderEndTime() * timeState.getPixelSecond());
                g.drawLine(x, 0, x, this.getHeight());
            }

            if (renderTimeManager.isCurrentProjectRendering()) {
                double latency = PlaybackSettings.getInstance().getPlaybackLatencyCorrection();

                if (timePointer > latency && renderStart >= 0.0f) {
                    g.setColor(Color.ORANGE);
                    x = (int) ((timePointer + renderStart - latency) * timeState.
                            getPixelSecond());
                    g.drawLine(x, 0, x, this.getHeight());
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
        TimeContext context = (data != null) ? data.getTimeContext() : null;
        
        // Choose rendering based on display format
        switch (displayFormat) {
            case TIME, SMPTE -> drawTimeBasedRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
            case SAMPLES -> drawSamplesRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
            case MEASURE_BEATS -> drawMeasureBeatsRuler(g, bounds, h, pixelTime, startTime, endTime, duration, context);
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
     * Draws ruler using beats format (0, 1, 2, 3...)
     */
    private void drawBeatsRuler(Graphics g, Rectangle bounds, int h, 
            double pixelTime, double startTime, double endTime, double duration) {
        double majorBeatUnit = getMajorBeatUnit.invoke(pixelTime);
        var startVal = ((int) (startTime / majorBeatUnit) * majorBeatUnit);
        var df = new java.text.DecimalFormat();

        for (double i = startVal; i < endTime; i += majorBeatUnit) {
            String txt = df.format(i);
            int x = (int) (bounds.width * (i - startTime) / duration) + bounds.x;
            g.drawLine(x, 10, x, h);
            g.drawString(txt, x + 2, 16);
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
     * Draws ruler using measure:beats format (1:1, 1:2, 2:1...)
     * Uses Paul Heckbert's "Nice Numbers" algorithm for adaptive scaling.
     */
    private void drawMeasureBeatsRuler(Graphics g, Rectangle bounds, int h,
            double pixelTime, double startTime, double endTime, double duration,
            TimeContext context) {
        // Use nice numbers algorithm for adaptive tick spacing based on beats
        int nticks = Math.max(bounds.width / 80, 2); // Aim for ~80 pixels between ticks
        double range = niceNum(endTime - startTime, false);
        double d = niceNum(range / (nticks - 1), true);
        double graphMin = Math.floor(startTime / d) * d;
        double graphMax = Math.ceil(endTime / d) * d;
        int nfrac = (int) Math.max(-Math.floor(Math.log10(d)), 0);

        for (double beatPos = graphMin; beatPos < graphMax + 0.5 * d; beatPos += d) {
            String txt = formatMeasureBeats(beatPos, context, nfrac);
            int x = (int) (bounds.width * (beatPos - startTime) / duration) + bounds.x;
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                g.drawLine(x, 10, x, h);
                g.drawString(txt, x + 2, 16);
            }
        }
    }
    
    /**
     * Format beat position as measure:beat with appropriate precision.
     */
    private String formatMeasureBeats(double beatPos, TimeContext context, int nfrac) {
        if (context == null || context.getMeterMap() == null) {
            // Fallback to simple beat display
            if (nfrac == 0) {
                return String.valueOf((int) beatPos);
            }
            return String.format("%%.%df".formatted(nfrac), beatPos);
        }
        
        var meterMap = context.getMeterMap();
        var measureBeats = meterMap.toMeasureBeats(blue.time.TimeUnit.beats(beatPos));
        long measure = measureBeats.getMeasureNumber();
        double beat = measureBeats.getBeatNumber();
        
        // Show as measure:beat with appropriate decimal places
        if (nfrac == 0 || beat == Math.floor(beat)) {
            return String.format("%d:%d", measure, (int) beat);
        }
        // Build format string like "%d:%.2f" for nfrac=2
        String formatStr = "%d:%." + nfrac + "f";
        return String.format(formatStr, measure, beat);
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
    public void renderTimeUpdated(double timePointer) {
        this.timePointer = timePointer;
        repaint();
    }

}
