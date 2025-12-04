/*
 * TempoEditor - Graphical editor for TempoMap
 */
package blue.ui.core.score.tempo;

import blue.BlueData;
import blue.components.DragDirection;
import blue.score.Score;
import blue.score.TimeState;
import blue.time.TempoMap;
import blue.ui.utilities.UiUtilities;
import blue.utility.ScoreUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import blue.time.CurveType;
import blue.time.TempoPoint;

/**
 * Graphical editor for tempo curves.
 * 
 * @author syi
 */
public class TempoEditor extends JComponent implements PropertyChangeListener {

    private static final Stroke STROKE1 = new BasicStroke(1);
    private static final Stroke STROKE2 = new BasicStroke(2);
    private static final double MIN_TEMPO = 30.0;
    private static final double MAX_TEMPO = 240.0;

    TempoMap tempoMap = null;
    Score score = null;
    private TimeState timeState;
    
    // Editing state
    private int selectedPointIndex = -1;
    private int leftBoundaryX = -1;
    private int rightBoundaryX = -1;

    public TempoEditor() {
        TempoEditorMouseListener mouseListener = new TempoEditorMouseListener();
        this.addMouseListener(mouseListener);
        this.addMouseMotionListener(mouseListener);
        
        // Configure tooltips: show immediately, never dismiss
        ToolTipManager.sharedInstance().registerComponent(this);
        ToolTipManager.sharedInstance().setInitialDelay(0);
        ToolTipManager.sharedInstance().setDismissDelay(Integer.MAX_VALUE);
    }

    public void setData(BlueData data) {
        var score = data.getScore();
        TempoMap tempoMap = score.getTempoMap();

        if (this.tempoMap != null) {
            this.tempoMap.removePropertyChangeListener(this);
        }

        if (this.score != null) {
            this.score.getTimeState().removePropertyChangeListener(this);
        }

        this.tempoMap = tempoMap;
        this.tempoMap.addPropertyChangeListener(this);
        this.score = score;
        this.score.getTimeState().addPropertyChangeListener(this);
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }

    /**
     * @deprecated Use TempoEditorPanel.setExpanded() instead
     */
    @Deprecated
    public void setTempoVisible(boolean tempoVisible) {
        // Height is now managed by TempoEditorPanel
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        var bounds = g.getClipBounds();
        
        if (this.tempoMap == null) {
            return;
        }

        Graphics2D g2d = (Graphics2D) g;

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        boolean enabled = this.tempoMap.isEnabled();

        // Draw snap grid if enabled
        if (score != null && timeState != null && timeState.isSnapEnabled()) {
            g2d.setColor(Color.DARK_GRAY);
            int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());
            if (snapPixels > 0) {
                int height = getHeight();
                int width = getWidth();
                double snapValue = timeState.getSnapValue();
                double pixelSecond = timeState.getPixelSecond();
                int x = 0;
                for (int i = 0; x < width; i++) {
                    x = (int) ((i * snapValue) * pixelSecond);
                    g.drawLine(x, 0, x, height);
                }
            }
        }

        g2d.setStroke(STROKE2);

        if (enabled) {
            if (tempoMap.isVisible()) {
                g2d.setColor(Color.GREEN);
            } else {
                g2d.setColor(Color.GREEN.darker().darker());
            }
        } else {
            g2d.setColor(Color.DARK_GRAY);
        }

        // Draw the tempo curve
        drawTempoMap(g2d, tempoMap, tempoMap.isVisible() && enabled);
        
        // Draw selected point highlight
        if (enabled && selectedPointIndex >= 0 && selectedPointIndex < tempoMap.size()) {
            int height = getHeight() - 10;
            double range = MAX_TEMPO - MIN_TEMPO;
            
            double beat = tempoMap.getBeat(selectedPointIndex);
            double tempo = tempoMap.getTempo(selectedPointIndex);
            int x = beatToScreenX(beat);
            int y = tempoToScreenY(tempo, height, range);
            
            g2d.setColor(Color.RED);
            paintPoint(g2d, x, y);
        }
        
        // Draw bottom border
        g2d.setColor(Color.WHITE);
        g2d.setStroke(STROKE1);
        g2d.drawLine(bounds.x, bounds.y + bounds.height - 1, bounds.x + bounds.width, bounds.y + bounds.height - 1);
    }

    private void drawTempoMap(Graphics2D g2d, TempoMap map, boolean drawPoints) {
        if (map.size() == 0 || timeState == null) {
            return;
        }

        int height = getHeight() - 10;
        double range = MAX_TEMPO - MIN_TEMPO;

        // Draw all lines first
        int prevX = -1;
        int prevY = -1;
        CurveType prevCurveType = null;

        for (int i = 0; i < map.size(); i++) {
            double beat = map.getBeat(i);
            double tempo = map.getTempo(i);
            CurveType curveType = map.getCurveType(i);

            int x = beatToScreenX(beat);
            int y = tempoToScreenY(tempo, height, range);

            if (prevX != -1) {
                if (prevCurveType == CurveType.CONSTANT) {
                    // Step function: horizontal then vertical
                    g2d.drawLine(prevX, prevY, x, prevY);
                    g2d.drawLine(x, prevY, x, y);
                } else {
                    // Linear interpolation
                    g2d.drawLine(prevX, prevY, x, y);
                }
            }

            prevX = x;
            prevY = y;
            prevCurveType = curveType;
        }

        // Extend line to end of view
        if (prevX != -1 && prevX < getWidth()) {
            g2d.drawLine(prevX, prevY, getWidth(), prevY);
        }
        
        // Draw all points on top of lines
        if (drawPoints) {
            for (int i = 0; i < map.size(); i++) {
                double beat = map.getBeat(i);
                double tempo = map.getTempo(i);
                int x = beatToScreenX(beat);
                int y = tempoToScreenY(tempo, height, range);
                paintPoint(g2d, x, y);
            }
        }
    }

    private int beatToScreenX(double beat) {
        return (int) Math.round(beat * timeState.getPixelSecond());
    }

    private int tempoToScreenY(double tempo, int height, double range) {
        double adjustedTempo = tempo - MIN_TEMPO;
        double percent = adjustedTempo / range;
        return (int) Math.round(height * (1.0 - percent)) + 5;
    }

    private void paintPoint(Graphics2D g2d, int x, int y) {
        Color c = g2d.getColor();
        Stroke s = g2d.getStroke();

        g2d.setStroke(STROKE1);
        g2d.setColor(Color.BLACK);
        g2d.fillOval(x - 3, y - 3, 7, 7);
        g2d.setColor(c);
        g2d.drawOval(x - 3, y - 3, 7, 7);

        g2d.setStroke(s);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();
        if (evt.getSource() == this.tempoMap) {
            switch (prop) {
                case "enabled":
                case "data":
                    repaint();
                    break;
                case "visible":
                    // Visibility is now managed by TempoEditorPanel
                    break;
            }
        } else if (this.score != null && evt.getSource() == this.score.getTimeState()) {
            repaint();
        }
    }
    
    // ========== Coordinate Conversion ==========
    
    private double screenToDoubleBeat(int x) {
        if (timeState == null) {
            return -1;
        }
        return (double) x / timeState.getPixelSecond();
    }
    
    private double screenToDoubleTempo(int y) {
        int height = getHeight() - 10;
        double range = MAX_TEMPO - MIN_TEMPO;
        double percent = 1.0 - ((y - 5) / (double) height);
        double tempo = (percent * range) + MIN_TEMPO;
        return Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, tempo));
    }
    
    // ========== Point Finding ==========
    
    private int findPointAt(int x, int y) {
        if (tempoMap == null || timeState == null) {
            return -1;
        }
        
        int height = getHeight() - 10;
        double range = MAX_TEMPO - MIN_TEMPO;
        
        for (int i = 0; i < tempoMap.size(); i++) {
            int px = beatToScreenX(tempoMap.getBeat(i));
            int py = tempoToScreenY(tempoMap.getTempo(i), height, range);
            
            if (Math.abs(px - x) <= 4 && Math.abs(py - y) <= 4) {
                return i;
            }
        }
        return -1;
    }
    
    // ========== Boundary Calculation ==========
    
    private void setBoundaryXValues() {
        if (selectedPointIndex < 0 || tempoMap == null) {
            leftBoundaryX = 0;
            rightBoundaryX = getWidth();
            return;
        }
        
        // First point is fixed at x=0
        if (selectedPointIndex == 0) {
            leftBoundaryX = 0;
            rightBoundaryX = 0;
            return;
        }
        
        // Last point can go to end of view
        if (selectedPointIndex == tempoMap.size() - 1) {
            leftBoundaryX = beatToScreenX(tempoMap.getBeat(selectedPointIndex - 1)) + 1;
            rightBoundaryX = getWidth();
            return;
        }
        
        // Middle points are bounded by neighbors
        leftBoundaryX = beatToScreenX(tempoMap.getBeat(selectedPointIndex - 1)) + 1;
        rightBoundaryX = beatToScreenX(tempoMap.getBeat(selectedPointIndex + 1)) - 1;
    }
    
    // ========== Point Insertion ==========
    
    private int insertPoint(double beat, double tempo) {
        if (tempoMap == null) {
            return -1;
        }
        
        // Clamp tempo to valid range
        tempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, tempo));
        
        // Add the point (TempoMap will sort it)
        tempoMap.addTempoPoint(new TempoPoint(beat, tempo, CurveType.CONSTANT));
        
        // Find the index of the newly added point
        for (int i = 0; i < tempoMap.size(); i++) {
            if (Math.abs(tempoMap.getBeat(i) - beat) < 0.0001) {
                return i;
            }
        }
        return tempoMap.size() - 1;
    }
    
    // ========== Popup Menu ==========
    
    private void showSegmentPopupMenu(MouseEvent e, int segmentIndex) {
        JPopupMenu popup = new JPopupMenu();
        
        CurveType currentType = tempoMap.getCurveType(segmentIndex);
        
        JMenuItem constantItem = new JMenuItem("Constant");
        constantItem.setEnabled(currentType != CurveType.CONSTANT);
        constantItem.addActionListener(evt -> {
            tempoMap.setCurveType(segmentIndex, CurveType.CONSTANT);
            repaint();
        });
        popup.add(constantItem);
        
        JMenuItem linearItem = new JMenuItem("Linear");
        linearItem.setEnabled(currentType != CurveType.LINEAR);
        linearItem.addActionListener(evt -> {
            tempoMap.setCurveType(segmentIndex, CurveType.LINEAR);
            repaint();
        });
        popup.add(linearItem);
        
        popup.show(this, e.getX(), e.getY());
    }
    
    /**
     * Find the segment index for a given x position.
     * Returns the index of the point that starts the segment, or -1 if not found.
     */
    private int findSegmentAt(int x) {
        if (tempoMap == null || tempoMap.size() < 2) {
            return -1;
        }
        
        double beat = screenToDoubleBeat(x);
        
        for (int i = 0; i < tempoMap.size() - 1; i++) {
            double startBeat = tempoMap.getBeat(i);
            double endBeat = tempoMap.getBeat(i + 1);
            if (beat >= startBeat && beat < endBeat) {
                return i;
            }
        }
        
        // Check if we're past the last point (on the extension line)
        if (beat >= tempoMap.getBeat(tempoMap.size() - 1)) {
            return tempoMap.size() - 1;
        }
        
        return -1;
    }
    
    // ========== Mouse Listener ==========
    
    private class TempoEditorMouseListener extends MouseAdapter {
        
        private DragDirection direction = DragDirection.NOT_SET;
        private Point pressPoint = null;
        
        @Override
        public void mousePressed(MouseEvent e) {
            if (tempoMap == null || !tempoMap.isEnabled() || !tempoMap.isVisible()) {
                return;
            }
            
            pressPoint = e.getPoint();
            
            if (selectedPointIndex >= 0) {
                // A point is already selected (mouse is over a point)
                if (UiUtilities.isRightMouseButton(e)) {
                    // Right-click on selected point: remove it (if not first point)
                    if (selectedPointIndex > 0) {
                        tempoMap.removeTempoPoint(selectedPointIndex);
                        selectedPointIndex = -1;
                        setToolTipText(null);
                        repaint();
                    }
                } else {
                    // Left-click: prepare for dragging
                    setBoundaryXValues();
                }
            } else {
                // No point selected (mouse is not over a point)
                if (UiUtilities.isRightMouseButton(e)) {
                    // Right-click on segment: show curve type popup
                    int segmentIndex = findSegmentAt(e.getX());
                    if (segmentIndex >= 0) {
                        showSegmentPopupMenu(e, segmentIndex);
                    }
                } else if (SwingUtilities.isLeftMouseButton(e)) {
                    int x = e.getX();
                    int y = e.getY();
                    
                    double beat = screenToDoubleBeat(x);
                    
                    // Apply snap if enabled
                    if (timeState != null && timeState.isSnapEnabled() && 
                            !(e.isControlDown() && e.isShiftDown())) {
                        beat = ScoreUtilities.getSnapValueStart(beat, timeState.getSnapValue());
                    }
                    
                    double tempo = screenToDoubleTempo(y);
                    
                    // Insert new point
                    selectedPointIndex = insertPoint(beat, tempo);
                    setBoundaryXValues();
                    repaint();
                }
            }
        }
        
        @Override
        public void mouseReleased(MouseEvent e) {
            direction = DragDirection.NOT_SET;
            if (tempoMap == null || !tempoMap.isEnabled() || !tempoMap.isVisible()) {
                return;
            }
            repaint();
        }
        
        @Override
        public void mouseDragged(MouseEvent e) {
            if (tempoMap == null || !tempoMap.isEnabled() || !tempoMap.isVisible()) {
                return;
            }
            
            if (selectedPointIndex >= 0 && selectedPointIndex < tempoMap.size()) {
                int x = e.getX();
                int y = e.getY();
                
                // Determine drag direction for constrained movement
                if (direction == DragDirection.NOT_SET && pressPoint != null) {
                    int magx = Math.abs(x - pressPoint.x);
                    int magy = Math.abs(y - pressPoint.y);
                    direction = (magx > magy) ? DragDirection.LEFT_RIGHT : DragDirection.UP_DOWN;
                }
                
                // Constrain to one axis if Ctrl is held
                if (e.isControlDown() && pressPoint != null) {
                    if (direction == DragDirection.LEFT_RIGHT) {
                        y = pressPoint.y;
                    } else {
                        x = pressPoint.x;
                    }
                }
                
                // First point is fixed at beat 0
                if (selectedPointIndex == 0) {
                    x = 0;
                }
                
                // Apply boundaries
                if (x < leftBoundaryX) {
                    x = leftBoundaryX;
                } else if (x > rightBoundaryX) {
                    x = rightBoundaryX;
                }
                
                // Clamp Y to valid range
                int topY = 5;
                int bottomY = getHeight() - 5;
                if (y < topY) y = topY;
                if (y > bottomY) y = bottomY;
                
                // Apply snap if enabled
                if (timeState != null && timeState.isSnapEnabled() && !e.isShiftDown()) {
                    int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());
                    if (snapPixels > 0) {
                        int fraction = x % snapPixels;
                        x = x - fraction;
                        if (fraction > snapPixels / 2) {
                            x += snapPixels;
                        }
                    }
                }
                
                double beat = screenToDoubleBeat(x);
                double tempo = screenToDoubleTempo(y);
                
                // Update the point
                tempoMap.setTempoPoint(selectedPointIndex, beat, tempo);
                updateTooltip();
                repaint();
            }
        }
        
        @Override
        public void mouseMoved(MouseEvent e) {
            if (tempoMap == null || !tempoMap.isEnabled() || !tempoMap.isVisible()) {
                return;
            }
            
            int x = e.getX();
            int y = e.getY();
            
            int foundIndex = findPointAt(x, y);
            
            if (foundIndex >= 0) {
                if (selectedPointIndex != foundIndex) {
                    selectedPointIndex = foundIndex;
                    updateTooltip();
                    repaint();
                }
            } else if (selectedPointIndex >= 0) {
                selectedPointIndex = -1;
                setToolTipText(null);
                repaint();
            }
        }
    }
    
    private void updateTooltip() {
        if (selectedPointIndex >= 0 && selectedPointIndex < tempoMap.size()) {
            double beat = tempoMap.getBeat(selectedPointIndex);
            double tempo = tempoMap.getTempo(selectedPointIndex);
            CurveType curveType = tempoMap.getCurveType(selectedPointIndex);
            String curveStr = curveType == CurveType.CONSTANT ? "constant" : "linear";
            setToolTipText(String.format("<html>beat: %.2f<br>tempo: %.2f bpm<br>curve: %s</html>", beat, tempo, curveStr));
        } else {
            setToolTipText(null);
        }
    }
}
