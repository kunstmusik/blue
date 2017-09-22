/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.editor.ceciliaModule;

import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.CGraph;
import blue.soundObject.ceciliaModule.CGraphPoint;
import blue.soundObject.ceciliaModule.CeciliaObject;
import blue.ui.utilities.UiUtilities;
import blue.utility.TextUtilities;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.awt.geom.Rectangle2D;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.StringTokenizer;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;

/**
 * @author Administrator
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class Grapher extends JComponent {
    private static final int NOISE_POINTS = 50;

    private static final int SINE_POINTS = 50;

    private ArrayList graphOrder = new ArrayList();

    private HashMap graphs = new HashMap();

    private CGraph currentGraph;

    private CGraph copyBufferGraph;

    private CGraphPoint selectedPoint = null;

    private CGraph selectedGraph = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;

    private CeciliaModule ceciliaModule;

    // private static final Color bgColor = new Color(231, 231, 231);

    public Grapher() {
        // TODO add mouse listeners
        this.addMouseListener(new MouseListener() {

            @Override
            public void mouseClicked(MouseEvent e) {
                // if (currentGraph == null) { return; }
            }

            @Override
            public void mouseEntered(MouseEvent e) {
            }

            @Override
            public void mouseExited(MouseEvent e) {
            }

            @Override
            public void mousePressed(MouseEvent e) {
                if (currentGraph == null) {
                    return;
                }

                if (selectedGraph != null) {

                } else if (selectedPoint != null) {
                    if (UiUtilities.isRightMouseButton(e)) {
                        ArrayList points = currentGraph.getPoints();
                        if (selectedPoint != points.get(0)
                                && selectedPoint != points
                                        .get(points.size() - 1)) {
                            points.remove(selectedPoint);
                            selectedPoint = null;
                        }
                    } else {
                        setBoundaryXValues();
                    }
                } else {
                    if (SwingUtilities.isLeftMouseButton(e)) {
                        selectedPoint = insertGraphPoint(e.getX(), e.getY());
                        setBoundaryXValues();
                        repaint();
                    }
                }

            }

            @Override
            public void mouseReleased(MouseEvent e) {
                if (currentGraph == null) {
                    return;
                }
                repaint();

            }
        });

        this.addMouseMotionListener(new MouseMotionListener() {

            @Override
            public void mouseDragged(MouseEvent e) {
                if (currentGraph == null) {
                    return;
                }
                if (selectedPoint != null) {

                    int x = e.getX();
                    int y = e.getY();

                    int topY = 5;
                    int bottomY = getHeight() - 5;

                    if (x < leftBoundaryX) {
                        x = leftBoundaryX;
                    } else if (x > rightBoundaryX) {
                        x = rightBoundaryX;
                    }

                    if (y < topY) {
                        y = topY;
                    } else if (y > bottomY) {
                        y = bottomY;
                    }

                    if (selectedPoint != null) {
                        selectedPoint.time = screenToDoubleX(x);
                        selectedPoint.value = screenToDoubleY(y);
                        repaint();
                    }
                } else if (selectedGraph != null) {

                }
            }

            @Override
            public void mouseMoved(MouseEvent e) {
                if (currentGraph == null) {
                    return;
                }

                if (currentGraph == null) {
                    return;
                }

                int x = e.getX();
                int y = e.getY();

                CGraphPoint foundPoint = findGraphPoint(x, y);

                if (foundPoint != null) {
                    if (selectedPoint != foundPoint) {
                        selectedPoint = foundPoint;
                        repaint();
                    }
                } else if (selectedPoint != null) {
                    selectedPoint = null;
                    repaint();
                }
            }
        });
    }

    public void setCurrentGraph(String objectName) {
        currentGraph = (CGraph) graphs.get(objectName);
        repaint();
    }

    public CGraph getCurrentGraph() {
        return currentGraph;
    }

    /**
     * Use by the MouseListener to add points
     * 
     * @param i
     * @param j
     * @return
     */
    protected CGraphPoint insertGraphPoint(int x, int y) {
        CGraphPoint point = new CGraphPoint();
        point.time = screenToDoubleX(x);
        point.value = screenToDoubleY(y);

        ArrayList points = currentGraph.getPoints();
        int index = 1;

        for (int i = 0; i < points.size(); i++) {
            CGraphPoint p1 = (CGraphPoint) points.get(i);
            CGraphPoint p2 = (CGraphPoint) points.get(i + 1);

            if (point.time >= p1.time && point.time <= p2.time) {
                index = i + 1;
                break;
            }
        }

        points.add(index, point);

        return point;
    }

    public void setBoundaryXValues() {
        ArrayList points = currentGraph.getPoints();

        if (selectedPoint == points.get(0)) {
            leftBoundaryX = 5;
            rightBoundaryX = 5;
            return;
        } else if (selectedPoint == points.get(points.size() - 1)) {
            leftBoundaryX = this.getWidth() - 5;
            rightBoundaryX = this.getWidth() - 5;
            return;
        }

        for (int i = 0; i < points.size(); i++) {
            if (points.get(i) == selectedPoint) {
                CGraphPoint p1 = (CGraphPoint) points.get(i - 1);
                CGraphPoint p2 = (CGraphPoint) points.get(i + 1);
                leftBoundaryX = doubleToScreenX(p1.time);
                rightBoundaryX = doubleToScreenX(p2.time);
                return;
            }
        }

    }

    public CGraphPoint findGraphPoint(int x, int y) {

        for (Iterator iter = currentGraph.getPoints().iterator(); iter
                .hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            int tempX = doubleToScreenX(point.time);
            int tempY = doubleToScreenY(point.value);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2
                    && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    public CGraphPoint findGraphPoint(int x) {
        for (Iterator iter = currentGraph.getPoints().iterator(); iter
                .hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            int tempX = doubleToScreenX(point.time);

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }

    public void clearPanel() {
        graphOrder.clear();
        graphs.clear();
        currentGraph = null;
    }

    public void addGraphOrder(String objectName) {
        graphOrder.add(objectName);
    }

    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        this.ceciliaModule = ceciliaModule;

        HashMap map = ceciliaModule.getStateData();

        if (map.size() == 0) {
            return;
        }

        for (Iterator iter = map.values().iterator(); iter.hasNext();) {
            CeciliaObject element = (CeciliaObject) iter.next();

            if (element instanceof CGraph) {
                CGraph graph = (CGraph) element;
                graphs.put(graph.getObjectName(), graph);

                if (currentGraph == null) {
                    currentGraph = graph;
                }
            }
        }
        repaint();
    }

    public void setDuration(double duration) {
        // TODO -rescale all graph points to new time
        // -set new duration
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        Graphics2D g2d = (Graphics2D) g;

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        // g.setColor(bgColor);
        g2d.setColor(Color.black);
        g2d.fillRect(0, 0, this.getWidth(), this.getHeight());

        g2d.setColor(Color.DARK_GRAY.darker());

        // DRAW X-LINES

        int h = this.getHeight() - 10;
        int right = this.getWidth() - 5;

        for (int i = 0; i < 12; i++) {
            int y = (int) ((i / 12.0f) * h);
            g2d.drawLine(5, y, right, y);
        }

        // DRAW Y-LINES

        int w = this.getWidth() - 10;
        int bottom = this.getHeight() - 5;

        for (int i = 0; i < 12; i++) {
            int x = (int) ((i / 12.0f) * w);

            g2d.drawLine(x, 5, x, bottom);
        }

        // DRAW BORDER
        g2d.setColor(Color.lightGray);
        g2d.drawRect(5, 5, this.getWidth() - 10, this.getHeight() - 10);

        // g.setColor(Color.white);
        int colorIndex = 0;

        Color currentColor = null;

        // for(Iterator iter = graphs.values().iterator(); iter.hasNext();) {
        for (Iterator iter = graphOrder.iterator(); iter.hasNext();) {
            String objectName = (String) iter.next();

            CGraph tempGraph = (CGraph) graphs.get(objectName);

            if (tempGraph == currentGraph) {
                currentColor = LineColors.getColor(colorIndex);
                colorIndex++;
            } else {
                // if(tempGraph.getColor().equals("")) {
                g2d.setColor(LineColors.getLightColor(colorIndex));
                colorIndex++;
                // } else {
                // g2d.setColor(LineColors.getLightColor(tempGraph
                // .getColor()));
                // }

                drawGraph(g2d, tempGraph, false);
            }
        }

        if (currentColor != null) {
            g2d.setColor(currentColor);
            drawGraph(g2d, currentGraph, true);
        }

        if (selectedPoint != null) {
            int x = doubleToScreenX(selectedPoint.time);
            int y = doubleToScreenY(selectedPoint.value);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            if (currentGraph != null) {
                drawPointInformation(g2d, x, y);
            }
        }
    }

    /**
     * @param g2d
     * @param x
     * @param y
     */
    private void drawPointInformation(Graphics2D g2d, int x, int y) {
        g2d.setColor(Color.white);

        double range = currentGraph.getMax() - currentGraph.getMin();
        double yVal = (selectedPoint.value * range) + currentGraph.getMin();

        String xText = "x: " + selectedPoint.time;
        String yText = "y: " + yVal;

        Rectangle2D xRect = g2d.getFontMetrics().getStringBounds(xText, g2d);
        Rectangle2D yRect = g2d.getFontMetrics().getStringBounds(yText, g2d);

        double wx = xRect.getWidth();
        double wy = yRect.getWidth();

        double w = wx > wy ? wx : wy;

        // int width = (int)Math.round(w);
        int width = 95;
        // int height = (int)(Math.round(xRect.getHeight() +
        // yRect.getHeight()));
        int height = 28;

        // System.out.println("width: " + width + " height: " + height);

        int xLoc = x + 5;
        int yLoc = y + 5;

        if (x + width > this.getWidth()) {
            xLoc = x - width - 5;
        }

        if (y + height > this.getHeight()) {
            yLoc = y - 14 - 5;
        }

        g2d.drawString(xText, xLoc, yLoc);
        g2d.drawString(yText, xLoc, yLoc + 14);
    }

    /**
     * @param g
     * @param tempGraph
     */
    private final void drawGraph(Graphics g, CGraph tempGraph,
            boolean drawPoints) {
        // double max = tempGraph.getMax();
        // double min = tempGraph.getMin();

        // double diff = max - min;

        // int width = this.getWidth() - 10;
        // int height = this.getHeight() - 10;

        int prevX = -1;
        int prevY = -1;

        for (Iterator iter = tempGraph.getPoints().iterator(); iter.hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            int x = doubleToScreenX(point.time);
            int y = doubleToScreenY(point.value);

            if (drawPoints) {
                paintPoint(g, x, y);
            }

            if (prevX != -1) {
                g.drawLine(prevX, prevY, x, y);
            }
            prevX = x;
            prevY = y;
        }

    }

    private final void paintPoint(Graphics g, int x, int y) {
        g.fillRect(x - 2, y - 2, 5, 5);
    }

    private final int doubleToScreenX(double val) {
        int width = this.getWidth() - 10;
        return (int)Math.round(val * width) + 5;
    }

    private final int doubleToScreenY(double val) {
        int height = this.getHeight() - 10;
        int y = (int)Math.round(height * (1.0f - val)) + 5;

        return y;
    }

    private final double screenToDoubleX(int val) {
        double width = this.getWidth() - 10;
        return (val - 5) / width;
    }

    private final double screenToDoubleY(int val) {
        double height = this.getHeight() - 10;
        return 1 - ((val - 5) / height);
    }

    /* GRAPH ACTIONS */

    public void cutGraph() {
        if (currentGraph == null) {
            return;
        }

        copyGraph();
        resetGraph();
    }

    public void copyGraph() {
        if (currentGraph == null) {
            return;
        }

        this.copyBufferGraph = new CGraph(currentGraph);
    }

    public void pasteGraph() {
        if (currentGraph == null || this.copyBufferGraph == null) {
            return;
        }

        currentGraph.replaceValues(this.copyBufferGraph);
        repaint();
    }

    public void resetGraph() {
        if (currentGraph == null || ceciliaModule == null) {
            return;
        }

        String objectName = currentGraph.getObjectName();
        String tk_interface = ceciliaModule.getModuleDefinition().tk_interface;

        StringTokenizer st = new StringTokenizer(tk_interface, "\n");

        // System.out.println(objectName);

        while (st.hasMoreTokens()) {
            String line = st.nextToken();

            // System.out.println(line);

            if (line.contains(objectName) && line.contains("cgraph")) {
                String[] tokens = TextUtilities.splitStringWithQuotes(line);
                currentGraph.initialize(tokens);
                break;
            }
        }

        repaint();
    }

    public void importGraph() {
        if (currentGraph == null) {
            return;
        }
    }

    public void exportGraph() {
        if (currentGraph == null) {
            return;
        }
    }

    public void moveUpGraph() {
        if (currentGraph == null) {
            return;
        }

        for (Iterator iter = currentGraph.getPoints().iterator(); iter
                .hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            int val = doubleToScreenY(point.value);
            val -= 1;

            if (val < 5) {
                val = 5;
            }

            point.value = screenToDoubleY(val);

        }

        repaint();
    }

    public void moveDownGraph() {
        if (currentGraph == null) {
            return;
        }

        for (Iterator iter = currentGraph.getPoints().iterator(); iter
                .hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            int val = doubleToScreenY(point.value);
            val += 1;

            if (val > this.getHeight() - 5) {
                val = this.getHeight() - 5;
            }

            point.value = screenToDoubleY(val);

        }

        repaint();
    }

    public void generateSineGraph() {
        if (currentGraph == null) {
            return;
        }
        ArrayList points = currentGraph.getPoints();
        points.clear();

        for (int i = 0; i < NOISE_POINTS; i++) {
            CGraphPoint point = new CGraphPoint();
            double percent = (double) i / (NOISE_POINTS - 1);
            point.time = percent;
            point.value = (double) Math.sin(percent * 2 * Math.PI);
            point.value = (point.value * .5f) + .5f;

            points.add(point);
        }
        repaint();
    }

    public void generateWaveform() {
        if (currentGraph == null) {
            return;
        }
    }

    public void generateDrunkGraph() {
        if (currentGraph == null) {
            return;
        }
    }

    public void generateRandomGraph() {
        if (currentGraph == null) {
            return;
        }

        ArrayList points = currentGraph.getPoints();
        points.clear();

        for (int i = 0; i < NOISE_POINTS; i++) {
            CGraphPoint point = new CGraphPoint();
            point.time = (double) Math.random();
            point.value = (double) Math.random();

            points.add(point);
        }

        Collections.sort(points);

        ((CGraphPoint) points.get(0)).time = 0.0f;
        ((CGraphPoint) points.get(points.size() - 1)).time = 1.0f;

        repaint();
    }

    public void scatterGraph() {
        if (currentGraph == null) {
            return;
        }
    }
}