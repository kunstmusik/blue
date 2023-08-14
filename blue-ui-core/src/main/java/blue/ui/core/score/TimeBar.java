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

import blue.BlueData;
import blue.score.TimeState;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.soundObject.PolyObject;
import blue.time.TimeUtilities;
import blue.ui.utilities.BlueGradientFactory;
import blue.ui.utilities.UiUtilities;
import blue.utilities.MemoizedFunction;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.DecimalFormat;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import org.openide.util.Lookup;

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

        int timeDisplay = timeState.getTimeDisplay();

        int textWidth;

        FontMetrics fontMetrics = g.getFontMetrics();
        if (timeDisplay == PolyObject.DISPLAY_TIME) {
            textWidth = fontMetrics.stringWidth("00:00");
        } else {
            // Assuming less than 1000 measures
            textWidth = fontMetrics.stringWidth("000");
        }

        double pixelTime = timeState.getPixelSecond();

        g.setColor(getForeground());

        int startX = bounds.x;
        int endX = startX + bounds.width;

        double startTime = startX / (double) pixelTime;
        double endTime = endX / (double) pixelTime;
        double duration = endTime - startTime;

        g.drawLine(startX, h, endX, h);

        DecimalFormat df = new DecimalFormat();

        if (timeState.getTimeDisplay() == TimeState.DISPLAY_TIME) {
            double majorTimeUnit = getMajorTimeUnit.invoke(pixelTime);
            //System.out.println("Major Time Unit: " + majorTimeUnit + " : " + pixelTime);
            var startVal = ((int) (startTime / majorTimeUnit) * majorTimeUnit);

            for (double i = startVal; i < endTime; i += majorTimeUnit) {
                String txt = TimeUtilities.convertSecondsToTimeString(i);
                int x = (int) (bounds.width * (i - startTime) / duration) + startX;
                g.drawLine(x, 10, x, h);
                g.drawString(txt, 0 + x + 2, 16);
            }

        } else if (timeState.getTimeDisplay() == TimeState.DISPLAY_BEATS) {
            double majorBeatUnit = getMajorBeatUnit.invoke(pixelTime);
            var startVal = ((int) (startTime / majorBeatUnit) * majorBeatUnit);

//            System.out.println(startVal + " : " + majorBeatUnit);
            for (double i = startVal; i < endTime; i += majorBeatUnit) {
                String txt = df.format(i);
                int x = (int) (bounds.width * (i - startTime) / duration) + startX;
                g.drawLine(x, 10, x, h);
                g.drawString(txt, 0 + x + 2, 16);
            }

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
