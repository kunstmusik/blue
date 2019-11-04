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
import blue.Marker;
import blue.MarkersList;
import blue.score.TimeState;
import blue.services.render.RenderTimeManager;
import blue.services.render.RenderTimeManagerListener;
import blue.settings.PlaybackSettings;
import blue.soundObject.PolyObject;
import blue.ui.utilities.BlueGradientFactory;
import blue.ui.utilities.UiUtilities;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.LookAndFeel;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import javax.swing.UIManager;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import org.openide.util.Lookup;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */
public final class TimeBar extends JPanel implements
        PropertyChangeListener, TableModelListener, RenderTimeManagerListener {

    private static final Font LABEL_FONT = new Font("dialog", Font.PLAIN, 11);
    
    // BufferedImage bufferedImage;

    // Image image;
    private BlueData data;

    private TimeState timeState;

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    private double renderStart = 0.0f;

    private double timePointer = 0.0f;
    
    private boolean rootTimeline = true;

    RenderTimeManager renderTimeManager = 
                Lookup.getDefault().lookup(RenderTimeManager.class);
    
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
                    if (e.isShiftDown() && rootTimeline) {
                        data.getMarkersList().addMarker(time);

                    } else {
                        data.setRenderStartTime(time);
                    }
                } else if (UiUtilities.isRightMouseButton(e)) {
                    data.setRenderEndTime(time);
                }

            }

            // public void mouseReleased(MouseEvent e) {
            // int end = e.getX();
            // System.out.println("[for time rescaling]");
            // System.out.println("start: " + start + " end: " + end);
            //
            // }
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
        
        Graphics2D g2d = (Graphics2D)g;
        Paint p = g2d.getPaint();
        g2d.setPaint(BlueGradientFactory.getGradientPaint(getBackground()));        
        g2d.fillRect(0,0, getWidth(), getHeight());
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

        int pixelTime = timeState.getPixelSecond();
        int timeUnit = timeState.getTimeUnit();

        LookAndFeel lnf = UIManager.getLookAndFeel();

//        if(lnf instanceof MetalLookAndFeel) {
//            g.setColor(((MetalLookAndFeel)lnf).getPrimaryControl());
//        } else {
          g.setColor(getForeground());
//        g.setColor(Color.WHITE);
//        }
        
        int startX = bounds.x;
        int endX = startX + bounds.width;

        g.drawLine(startX, h, endX, h);

        int lastVal = 0;

        int divisions = getWidth() / pixelTime;

//        int longHeight = (int) (h * .5);
//        int shortHeight = (int) (h * .75);
        
        int longHeight = h - 6;
        int shortHeight = h - 3;

        int start = (startX / pixelTime);
        int end = (endX / pixelTime) + 1;

        end = end > divisions ? divisions : end;

        for (int i = start; i < end; i++) {
            int lineX = i * pixelTime;

            if (i % timeUnit == 0) {
                if (lineX == 0 || lineX - lastVal > textWidth) {
                    g.drawLine(lineX, h, lineX, longHeight);
                    lastVal = lineX;
                } else {
                    g.drawLine(lineX, h, lineX, shortHeight);
                }
            } else {
                g.drawLine(lineX, h, lineX, shortHeight);
            }
        }

        // DRAW LABELS
        g.setFont(LABEL_FONT);
        lastVal = 0;
        for (int i = start; i < end; i++) {
            if (i % timeUnit == 0) {
                String time = "";

                if (timeDisplay == PolyObject.DISPLAY_TIME) {
                    int min = i / 60;
                    int sec = i % 60;
                    String seconds = (sec < 10) ? "0" + sec : String.valueOf(sec);
                    time = min + ":" + seconds;
                } else if (timeDisplay == PolyObject.DISPLAY_NUMBER) {
                    time = Integer.toString(i);
                }

                int labelX = (i * pixelTime);

                if (labelX == 0 || labelX - lastVal > textWidth) {
                    g.drawString(time, labelX + 3, 14);
                    lastVal = labelX;
                }
            }
        }
    }

    /**
     * @param data
     */
    public void setData(BlueData data) {
        if (this.data != null) {
            this.data.removePropertyChangeListener(this);
            this.data.getMarkersList().removeTableModelListener(this);
        }

        this.data = data;

        data.addPropertyChangeListener(this);
        data.getMarkersList().addTableModelListener(this);

        // FIXME - should be using Score object
        //setPolyObject(data.getPolyObject());
        setTimeState(data.getScore().getTimeState());

    }

    public boolean isRootTimeline() {
        return rootTimeline;
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

        Component[] components = getComponents();

        this.removeAll();

        for (Component component : components) {
            if (component instanceof PlayMarker) {
                ((PlayMarker) component).cleanup();
            }
        }


        this.timeState = timeState;

        if (rootTimeline) {
            initializeMarkers();
        }

        
        this.timeState.addPropertyChangeListener(this);

        // updateBuffer();
        repaint();
    }

    private void initializeMarkers() {
        if (data == null) {
            return;
        }

        MarkersList markers = data.getMarkersList();

        for (int i = 0; i < markers.size(); i++) {
            Marker m = markers.getMarker(i);
            PlayMarker pm = new PlayMarker(m);

            int x = (int) (m.getTime() * timeState.getPixelSecond());

            pm.setLocation(x, 0);

            this.add(pm);
        }
    }

    private void checkScroll(Point p) {

        JScrollPane scrollPane = (JScrollPane) this.getParent().getParent().
                getParent();

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

                if (rootTimeline) {
                    Component[] components = getComponents();
                    this.removeAll();

                    for (Component component : components) {
                        if (component instanceof PlayMarker) {
                            ((PlayMarker) component).cleanup();
                        }
                    }
                    this.initializeMarkers();
                }

                repaint();
            }
        } else if (evt.getSource() == renderTimeManager) {
            if (prop.equals(RenderTimeManager.RENDER_START)) {
                this.renderStart = ((Double) evt.getNewValue()).doubleValue();
                this.timePointer = -1.0f;
                repaint();
            } 
//            else if (prop.equals(RenderTimeManager.TIME_POINTER)) {
//                this.timePointer = ((Double) evt.getNewValue()).doubleValue();
//                repaint();
//            }
        }
    }

    @Override
    public void tableChanged(TableModelEvent e) {
        if (e.getType() == TableModelEvent.DELETE ||
                e.getType() == TableModelEvent.INSERT) {
            Component[] components = getComponents();
            this.removeAll();

            for (Component component : components) {
                if(component instanceof PlayMarker) {
                    ((PlayMarker)component).cleanup();
                }
            }

            this.initializeMarkers();
            this.repaint();
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

    class PlayMarker extends JComponent implements PropertyChangeListener {

        int w = 10;

        int h = 10;

        int[] xPoints = {0, 0, w};

        int[] yPoints = {0, h, 0};

        private Marker marker;

        private int originX = -1;

        public PlayMarker(Marker marker) {
            ToolTipManager.sharedInstance().registerComponent(this);

            Dimension d = new Dimension(10, 11);

            this.setSize(d);

            this.marker = marker;

            marker.addPropertyChangeListener(this);

            this.addMouseListener(new MouseAdapter() {

                @Override
                public void mousePressed(MouseEvent e) {
                    originX = e.getX();
                }

                @Override
                public void mouseReleased(MouseEvent e) {
                    originX = -1;
                    if (!PlayMarker.this.isVisible()) {
                        data.getMarkersList().removeMarker(
                                PlayMarker.this.marker);
                        cleanup();
                    }
                }
            });

            this.addMouseMotionListener(new MouseMotionAdapter() {

                @Override
                public void mouseDragged(MouseEvent e) {
                    if (originX >= 0) {
                        PlayMarker playMarker = PlayMarker.this;

                        Container parent = playMarker.getParent();

                        Point p = SwingUtilities.convertPoint(playMarker, e.
                                getPoint(), parent);

                        int newX = p.x - originX;

                        if (newX < 0) {
                            newX = 0;
                        }

                        if (p.y > parent.getHeight()) {
                            PlayMarker.this.setVisible(false);
                            return;
                        }

                        PlayMarker.this.setVisible(true);

                        double newTime = (double) newX / timeState.getPixelSecond();

                        playMarker.setLocation(newX, 0);
                        playMarker.marker.setTime(newTime);

                        checkScroll(p);

                    }
                }
            });
        }

        @Override
        public String getToolTipText() {
            return marker.getName() + " [" + marker.getTime() + "]";
        }

        @Override
        public void paintComponent(Graphics g) {

            Graphics2D g2d = (Graphics2D) g;

            BasicStroke stroke = new BasicStroke(2, BasicStroke.CAP_ROUND,
                    BasicStroke.JOIN_ROUND);
            g2d.setStroke(stroke);

            g2d.setColor(Color.ORANGE.brighter().brighter());
            g2d.fillPolygon(xPoints, yPoints, 3);

            g2d.setColor(Color.ORANGE);
            g2d.drawPolygon(xPoints, yPoints, 3);

        }

        @Override
        public void propertyChange(PropertyChangeEvent evt) {
            if (evt.getSource() == marker) {
                if (evt.getPropertyName().equals("time")) {
                    double time = ((Double) evt.getNewValue()).doubleValue();
                    int x = (int) (timeState.getPixelSecond() * time);

                    this.setLocation(x, 0);
                }
            }
        }

        public void cleanup() {
            if(marker != null) {
                marker.removePropertyChangeListener(this);
            }
            marker = null;
        }
    }
}