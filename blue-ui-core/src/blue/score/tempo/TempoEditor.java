/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.score.tempo;

import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LinePoint;
import blue.soundObject.PolyObject;
import blue.ui.core.score.ModeManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import blue.utility.NumberUtilities;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.ActionEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

/**
 *
 * @author syi
 */
public class TempoEditor extends JComponent implements PropertyChangeListener {

    EditPointsPopup popup;
    TempoMinMaxDialog tempoMinMaxDialog;
    
    TableModelListener lineListener;
    Tempo tempo = null;
    private PolyObject pObj;
    
    LinePoint selectedPoint = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;


    public TempoEditor() {
        lineListener = new TableModelListener() {

            public void tableChanged(TableModelEvent e) {
                repaint();
            }
        };

        TempoEditorMouseListener tempoEditorMouseListener = 
                new TempoEditorMouseListener(this);
        
        this.addMouseListener(tempoEditorMouseListener);
        this.addMouseMotionListener(tempoEditorMouseListener);
    }

    public void setTempo(Tempo tempo) {
        if (this.tempo != null) {
            this.tempo.getLine().removeTableModelListener(lineListener);
            this.tempo.removePropertyChangeListener(this);
        }

        this.tempo = tempo;
        this.tempo.getLine().addTableModelListener(lineListener);
        this.tempo.addPropertyChangeListener(this);
        this.setTempoVisible(tempo.isVisible());
    }
    
    public void setPolyObject(PolyObject pObj) {
        this.pObj = pObj;
        setVisible(this.pObj.isRoot());
    }

    public void setTempoVisible(boolean tempoVisible) {
        if (tempoVisible) {
            this.setPreferredSize(new Dimension(1, 100));
            this.setSize(this.getWidth(), 100);
        } else {
            this.setPreferredSize(new Dimension(1, 20));
            this.setSize(this.getWidth(), 20);
        }
    }

    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (this.tempo == null) {
            return;
        }

        Graphics2D g2d = (Graphics2D) g;

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        Color currentColor = null;

        ModeManager modeManager = ModeManager.getInstance();

        Line tempoLine = this.tempo.getLine();
        boolean enabled = this.tempo.isEnabled();
        
        if(enabled) {
            if(tempo.isVisible()) {
                g2d.setColor(Color.GREEN);
            } else {
                g2d.setColor(Color.GREEN.darker().darker());
            }
            drawLine(g2d, tempoLine, this.tempo.isVisible());
        } else {
            g2d.setColor(Color.DARK_GRAY);
            drawLine(g2d, tempoLine, false);
            g2d.setColor(Color.WHITE);
            g2d.drawLine(0, getHeight() - 1, getWidth(), getHeight() - 1);
            return;
        }

        if (enabled && selectedPoint != null) {
            float min = tempoLine.getMin();
            float max = tempoLine.getMax();

            int x = floatToScreenX(selectedPoint.getX());
            int y = floatToScreenY(selectedPoint.getY(), min, max);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            drawPointInformation(g2d, x, y);
            
        }
        
        g2d.setColor(Color.WHITE);
        g2d.drawLine(0, getHeight() - 1, getWidth(), getHeight() - 1);
    }

    /**
     * @param g2d
     * @param x
     * @param y
     */
    private void drawPointInformation(Graphics2D g2d, int x, int y) {
        g2d.setColor(Color.white);

        // Line currentLine = currentParameter.getLine();

        float yVal = selectedPoint.getY();
        float xVal = selectedPoint.getX();

        String xText = "x: " + NumberUtilities.formatFloat(xVal);
        String yText = "y: " + NumberUtilities.formatFloat(yVal) + " bpm";

        int width = 95;
        int height = 28;

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

    private final void drawLine(Graphics g, Line line, boolean drawPoints) {
        Rectangle clipBounds = g.getClipBounds();

        if (line.size() == 0) {
            return;
        }

        if (line.size() == 1) {
            LinePoint lp = line.getLinePoint(0);

            float min = line.getMin();
            float max = line.getMax();

            int x = floatToScreenX(lp.getX());
            int y = floatToScreenY(lp.getY(), min, max);

            g.drawLine(0, y, getWidth(), y);

            if (drawPoints) {
                paintPoint(g, x, y);
            }
            return;
        }

        int prevX = -1;
        int prevY = -1;
        int x, y;

        float min = line.getMin();
        float max = line.getMax();

        for (int i = 0; i < line.size(); i++) {
            LinePoint point = line.getLinePoint(i);

            x = floatToScreenX(point.getX());
            y = floatToScreenY(point.getY(), min, max);

            if (drawPoints) {
                paintPoint(g, x, y);
            }

            if (prevX != -1) {

                if ((prevX <= (clipBounds.x + clipBounds.width))
                        && (x >= clipBounds.x)) {
                    g.drawLine(prevX, prevY, x, y);
                }
            }

            prevX = x;
            prevY = y;
        }

        if (prevX < this.getWidth()) {
            g.drawLine(prevX, prevY, getWidth(), prevY);
        }

    }

    private final void paintPoint(Graphics g, int x, int y) {
        g.fillRect(x - 2, y - 2, 5, 5);
    }

    private int floatToScreenX(float val) {
        if (pObj == null) {
            return -1;
        }
        return Math.round(val * pObj.getPixelSecond());
    }

    private int floatToScreenY(float yVal, float min, float max) {
        return floatToScreenY(yVal, min, max, -1.0f);
    }

    private int floatToScreenY(float yVal, float min, float max,
            float resolution) {
        int height = this.getHeight() - 10;

        float range = max - min;

        float adjustedY = yVal - min;

        if (resolution > 0.0f) {

            float tempY = 0.0f;

            while (tempY <= adjustedY) {
                tempY += resolution;
            }

            tempY -= resolution;

            // adjustedY = (float) (adjustedY - Math.IEEEremainder(adjustedY,
            // resolution));
            adjustedY = (tempY > range) ? range : tempY;

        }

        float percent = adjustedY / range;

        int y = Math.round(height * (1.0f - percent)) + 5;

        return y;
    }

    private float screenToFloatX(int val) {
        if (pObj == null) {
            return -1;
        }

        return (float) val / pObj.getPixelSecond();
    }

    private float screenToFloatY(int val, float min, float max, float resolution) {
        float height = this.getHeight() - 10;
        float percent = 1 - ((val - 5) / height);
        float range = max - min;

        float value = percent * range;

        if (resolution > 0.0f) {
            value = (float) (value - Math.IEEEremainder(value, resolution));
        }

        if (value > range) {
            value = range;
        }

        if (value < 0) {
            value = 0;
        }

        return value + min;
    }

    public void setBoundaryXValues() {

        Line currentLine = tempo.getLine();

        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryX = 0;
            rightBoundaryX = 0;
            return;
        } else if (selectedPoint == currentLine
                .getLinePoint(currentLine.size() - 1)) {
            LinePoint p1 = currentLine.getLinePoint(currentLine.size() - 2);

            leftBoundaryX = floatToScreenX(p1.getX());
            rightBoundaryX = this.getWidth();
            return;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {
                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryX = floatToScreenX(p1.getX());
                rightBoundaryX = floatToScreenX(p2.getX());
                return;
            }
        }

    }

    /**
     * Use by the MouseListener to add points
     * 
     * @param x
     * @param y
     * @return
     */
    protected LinePoint insertGraphPoint(int x, int y) {
        LinePoint point = new LinePoint();

        Line currentLine = tempo.getLine();
        
        float min = currentLine.getMin();
        float max = currentLine.getMax();

        point.setLocation(screenToFloatX(x), screenToFloatY(y, min, max,
                -1));

        int index = 1;

        LinePoint last = currentLine.getLinePoint(currentLine.size() - 1);

        if (point.getX() > last.getX()) {
            currentLine.addLinePoint(point);
            return point;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint p1 = currentLine.getLinePoint(i);
            LinePoint p2 = currentLine.getLinePoint(i + 1);

            if (point.getX() >= p1.getX() && point.getX() <= p2.getX()) {
                index = i + 1;
                break;
            }
        }

        currentLine.addLinePoint(index, point);

        return point;
    }

    public LinePoint findGraphPoint(int x, int y) {
        Line currentLine = tempo.getLine();

        float min = currentLine.getMin();
        float max = currentLine.getMax();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = floatToScreenX(point.getX());
            int tempY = floatToScreenY(point.getY(), min, max);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2
                    && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    public LinePoint findGraphPoint(int x) {
        Line currentLine = tempo.getLine();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = floatToScreenX(point.getX());

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }   
    
    public class TempoEditorMouseListener implements MouseListener, MouseMotionListener {

        TempoEditor tempoEditor;

        public TempoEditorMouseListener(TempoEditor tempoEditor) {
            this.tempoEditor = tempoEditor;
        }

        public void mouseClicked(MouseEvent e) {
        }

        public void mouseEntered(MouseEvent e) {
        }

        public void mouseExited(MouseEvent e) {
        }

        public void mousePressed(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
                return;
            }


            if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)) {
                    LinePoint first = tempo.getLine().getLinePoint(0);

                    if (selectedPoint != first) {
                        tempo.getLine().removeLinePoint(selectedPoint);
                        selectedPoint = null;
                    }
                } else {
                    setBoundaryXValues();
                }
            } else {
                if (SwingUtilities.isLeftMouseButton(e)) {

                    int start = e.getX();

                    if (pObj.isSnapEnabled() && !e.isShiftDown()) {
                        int snapPixels = (int) (pObj.getSnapValue() * pObj.getPixelSecond());
                        int fraction = start % snapPixels;

                        start = start - fraction;

                        if (fraction > snapPixels / 2) {
                            start += snapPixels;
                        }
                    }

                    selectedPoint = insertGraphPoint(start, e.getY());
                    setBoundaryXValues();
                } else if (UiUtilities.isRightMouseButton(e)) {
                    if (popup == null) {
                        popup = new EditPointsPopup();
                    }
                    popup.show((Component) e.getSource(), e.getX(), e.getY());
                }
            }

        }

        public void mouseReleased(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
                return;
            }
            
            repaint();

        }

        public void mouseDragged(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
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

                if (pObj.isSnapEnabled() && !e.isShiftDown()) {
                    int snapPixels = (int) (pObj.getSnapValue() * pObj.getPixelSecond());
                    int fraction = x % snapPixels;

                    x = x - fraction;

                    if (fraction > snapPixels / 2) {
                        x += snapPixels;
                    }
                }

                float min = tempo.getLine().getMin();
                float max = tempo.getLine().getMax();

                if (selectedPoint != null) {
                    selectedPoint.setLocation(screenToFloatX(x),
                            screenToFloatY(y, min, max, -1));
                    repaint();
                }
            }
        }

        public void mouseMoved(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
                return;
            }

            int x = e.getX();
            int y = e.getY();

            LinePoint foundPoint = findGraphPoint(x, y);

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
    }

    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();
        
        if(prop.equals("enabled")) {
            repaint();
        } else if(prop.equals("visible")) {
            this.setTempoVisible(((Boolean)evt.getNewValue()).booleanValue());
        } 
    }
    
    class EditPointsPopup extends JPopupMenu {
        
        Action editPointsAction;
        Action editBoundariesAction;

        public EditPointsPopup() {

            editPointsAction = new AbstractAction("Edit Points") {

                public void actionPerformed(ActionEvent e) {
                    if(tempo != null) {
                        Component root = SwingUtilities.getRoot(getInvoker());

                        LineEditorDialog dialog = LineEditorDialog
                                .getInstance(root);

                        dialog.setLine(tempo.getLine());
                        dialog.ask();
                    }
                }

            };
      
            editBoundariesAction = new AbstractAction("Edit Min/Max") {
                public void actionPerformed(ActionEvent e) {
                    if(tempo != null) {
                        if(tempoMinMaxDialog == null) {
                            Component root = SwingUtilities.getRoot(getInvoker());
                            tempoMinMaxDialog = new TempoMinMaxDialog((Frame)root, true);
                            GUI.centerOnScreen(tempoMinMaxDialog);
                        }
                        Line line = tempo.getLine();
                        tempoMinMaxDialog.setValues(line.getMin(), line.getMax());
                        tempoMinMaxDialog.setVisible(true);
                        
                        if(tempoMinMaxDialog.getReturnStatus() == TempoMinMaxDialog.RET_OK) {
                            float min = tempoMinMaxDialog.getMin();
                            float max = tempoMinMaxDialog.getMax();
                            boolean truncate = tempoMinMaxDialog.isTruncate();
                            
                            line.setMinMax(min, max, truncate);
                        }
                    }
                }
            };

            this.add(editPointsAction);
            this.add(editBoundariesAction);
        }

      

    }

}
 