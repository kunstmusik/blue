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
package blue.ui.core.score;

import blue.BlueData;
import blue.Marker;
import blue.MarkersList;
import blue.score.TimeState;
import blue.ui.utilities.UiUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import javax.swing.event.MouseInputAdapter;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

/**
 *
 * @author stevenyi
 */
public class MarkersBar extends JPanel implements PropertyChangeListener, TableModelListener {

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    private TimeState timeState = null;

    private BlueData data = null;

    private boolean rootTimeline = true;

    public MarkersBar() {
        setLayout(null);
        setOpaque(true);

        var mouseListener = new MouseInputAdapter() {

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

            @Override
            public void mouseReleased(MouseEvent e) {
                // int end = e.getX();
                // System.out.println("[for time rescaling]");
                // System.out.println("start: " + start + " end: " + end);
                //
            }

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
        };

        this.addMouseListener(mouseListener);

        this.addMouseMotionListener(mouseListener);

//        var parentDispatchingMouseAdapter = new ParentDispatchingMouseAdapter(this);
//        addMouseListener(parentDispatchingMouseAdapter);
//        addMouseMotionListener(parentDispatchingMouseAdapter);
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

    /**
     * @param timeState
     */
    protected void setTimeState(TimeState timeState) {
        if (this.timeState != null) {
            this.timeState.removePropertyChangeListener(this);
        }

        this.removeAll();

        this.timeState = timeState;

        if (rootTimeline) {
            initializeMarkers(data.getMarkersList());
        }

        this.timeState.addPropertyChangeListener(this);

        // updateBuffer();
        repaint();
    }

    public void setRootTimeline(boolean rootTimeline) {
        this.rootTimeline = rootTimeline;
    }

    private void initializeMarkers(MarkersList markers) {

        for (int i = 0; i < markers.size(); i++) {
            Marker m = markers.getMarker(i);
            addPlayMarker(m);
        }
    }

    private void addPlayMarker(Marker m) {
        PlayMarker pm = new PlayMarker(m);

        int x = (int) (m.getTime() * timeState.getPixelSecond());

        pm.setLocation(x, 0);

        this.add(pm);
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

        if (evt.getSource() == this.timeState) {
            if (prop.equals("pixelSecond")) {
                if (rootTimeline) {

                    for (var c : getComponents()) {
                        if (c instanceof PlayMarker) {
                            var pMarker = (PlayMarker) c;
                            var x = pMarker.marker.getTime() * timeState.getPixelSecond();
                            pMarker.setLocation((int) x, 0);
                        }
                    }
                }
                //repaint();
            }
        }
    }

    @Override
    public void tableChanged(TableModelEvent e) {
        var markersList = data.getMarkersList();
        switch (e.getType()) {
            case TableModelEvent.INSERT:
                for (int i = e.getFirstRow(); i <= e.getLastRow(); i++) {
                    var m = markersList.getMarker(i);
                    addPlayMarker(m);
                }
                break;
            case TableModelEvent.DELETE:
                for (var c : getComponents()) {
                    if (c instanceof PlayMarker) {
                        var pm = (PlayMarker) c;
                        if (!markersList.contains(pm.marker)) {
                            remove(pm);
                        }
                    }
                }
                repaint();
                break;
            default:
                break;
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        g.setColor(Color.BLACK);
        g.fillRect(0, 0, getWidth(), getHeight());
        g.setColor(Color.DARK_GRAY);
        g.drawLine(0, getHeight() - 1, getWidth(), getHeight() - 1);
    }

    class PlayMarker extends JLabel implements PropertyChangeListener {

        int w = 10;

        int h = 10;

        int[] xPoints = {0, 0, w};

        int[] yPoints = {0, h, 0};

        private Marker marker;

        private int originX = -1;

        JLabel label;

        public PlayMarker(Marker marker) {
            setOpaque(true);
            
            // Color ORANGE with slight alpha 
            setBackground(new Color(255, 200, 0, 180));
            setForeground(Color.BLACK);
            setLayout(new BoxLayout(this, BoxLayout.X_AXIS));

            ToolTipManager.sharedInstance().registerComponent(this);

            setText(marker.getName());

            setBorder(
                    BorderFactory.createCompoundBorder(
                            BorderFactory.createLineBorder(Color.ORANGE, 1),
                            BorderFactory.createEmptyBorder(3, 3, 3, 3)));

            setSize(getPreferredSize().width, 20);

            this.marker = marker;

            setFocusable(false);

            var mouseListener = new MouseInputAdapter() {

                int start;
                double markerStart = -1.0;

                @Override
                public void mousePressed(MouseEvent e) {
                    if (UiUtilities.isRightMouseButton(e)) {
                        JPopupMenu popup = new JPopupMenu();
                        popup.add(new AbstractAction("Remove") {
                            @Override
                            public void actionPerformed(ActionEvent e) {
                                data.getMarkersList().removeMarker(marker);
                            }
                        });
                        popup.show(PlayMarker.this, e.getX(), e.getY());
                    } else {
                        Point p = SwingUtilities.convertPoint(PlayMarker.this, e.getPoint(), getParent());
                        start = p.x;

                        if (start < 0) {
                            start = 0;
                        }

                        markerStart = marker.getTime();
                    }
                }

                @Override
                public void mouseReleased(MouseEvent e) {
                    // TODO - add undoability?
                    start = -1;
                }

                @Override
                public void mouseDragged(MouseEvent e) {
                    if(start < 0) {
                        return;
                    }
                    Point p = SwingUtilities.convertPoint(PlayMarker.this, e.getPoint(), getParent());
                    int diffX = p.x - start;

                    double diffTime = (double) diffX / timeState.getPixelSecond();

                    double time = markerStart + diffTime;

                    if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                        time = Math.round(time / timeState.getSnapValue()) * timeState.getSnapValue();
                    }

                    time = Math.max(0.0, time);

                    marker.setTime(time);
                    checkScroll(p);
                    repaint();
                }
            };

            this.addMouseListener(mouseListener);
            this.addMouseMotionListener(mouseListener);

            invalidate();
        }

        @Override
        public String getToolTipText() {
            return marker.getName() + " [" + marker.getTime() + "]";
        }

        @Override
        public void paintComponent(Graphics g) {
            super.paintComponent(g);

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
                switch (evt.getPropertyName()) {
                    case "time":
                        double time = ((Double) evt.getNewValue()).doubleValue();
                        int x = (int) (timeState.getPixelSecond() * time);
                        this.setLocation(x, 0);
                        repaint();
                        break;
                    case "name":
                        setText(marker.getName());
                        setSize(getPreferredSize().width, 20);
                        repaint();
                        break;
                }

            }
        }

        @Override
        public void removeNotify() {

            if (marker != null) {
                marker.removePropertyChangeListener(this);
            }

            super.removeNotify();
        }

        @Override
        public void addNotify() {
            super.addNotify();
            if (marker != null) {
                marker.addPropertyChangeListener(this);
            }
        }

    }
}
