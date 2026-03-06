/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.ui.core.score.tempo;

import blue.BlueData;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.TimeState;
import blue.time.CurveType;
import blue.time.TempoMap;
import blue.time.TempoPoint;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimePosition;
import blue.time.TimeUtilities;
import blue.ui.core.time.SoundObjectTimePanel;
import blue.ui.utilities.UiUtilities;
import blue.utility.ScoreUtilities;

import javax.swing.*;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.Path2D;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 * Pro Tools-style tempo region bar showing tempo values as regions.
 * Each region displays "♩ = XX" with visual indicators for curve type:
 * - Constant: flat background
 * - Linear: triangle gradient showing ramp direction
 */
public class TempoRegionBar extends JComponent implements PropertyChangeListener {

    private static final int BAR_HEIGHT = 20;
    private static final Color REGION_COLOR = new Color(60, 60, 80);
    private static final Color REGION_BORDER = new Color(100, 100, 120);
    private static final Color TEXT_COLOR = Color.WHITE;
    private static final Color RAMP_UP_COLOR = new Color(80, 100, 80, 180);
    private static final Color RAMP_DOWN_COLOR = new Color(100, 80, 80, 180);
    private static final Font TEMPO_FONT = new Font(Font.SANS_SERIF, Font.PLAIN, 11);
    
    // Quarter note symbol (Unicode)
    private static final String QUARTER_NOTE = "\u2669";
    
    private TempoMap tempoMap;
    private Score score;
    private TimeState timeState;
    
    // Editing state
    private int hoveredRegionIndex = -1;
    private int selectedRegionIndex = -1;

    public TempoRegionBar() {
        setPreferredSize(new Dimension(1, BAR_HEIGHT));
        setMinimumSize(new Dimension(1, BAR_HEIGHT));
        
        TempoRegionMouseListener mouseListener = new TempoRegionMouseListener();
        addMouseListener(mouseListener);
        addMouseMotionListener(mouseListener);
        
        ToolTipManager.sharedInstance().registerComponent(this);
        ToolTipManager.sharedInstance().setInitialDelay(0);
        ToolTipManager.sharedInstance().setDismissDelay(Integer.MAX_VALUE);
    }

    public void setData(BlueData data) {
        Score score = data.getScore();
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
        
        repaint();
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
        repaint();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == tempoMap) {
            // Repaint on any tempo map change (enabled, visible, data)
            repaint();
        } else if (score != null && evt.getSource() == score.getTimeState()) {
            repaint();
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        
        if (tempoMap == null || timeState == null) {
            return;
        }

        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        
        int width = getWidth();
        int height = getHeight();
        
        // Background
        g2d.setColor(Color.BLACK);
        g2d.fillRect(0, 0, width, height);
        
        boolean enabled = tempoMap.isEnabled();
        
        // Draw each tempo region
        for (int i = 0; i < tempoMap.size(); i++) {
            drawTempoRegion(g2d, i, enabled);
        }
        
        // Bottom border
        g2d.setColor(Color.DARK_GRAY);
        g2d.drawLine(0, height - 1, width, height - 1);
    }

    private void drawTempoRegion(Graphics2D g2d, int index, boolean enabled) {
        double beat = tempoMap.getBeat(index);
        double tempo = tempoMap.getTempo(index);
        CurveType curveType = tempoMap.getCurveType(index);
        
        int x = beatToScreenX(beat);
        int nextX;
        double nextTempo = tempo;
        
        if (index < tempoMap.size() - 1) {
            nextX = beatToScreenX(tempoMap.getBeat(index + 1));
            nextTempo = tempoMap.getTempo(index + 1);
        } else {
            nextX = getWidth();
        }
        
        int regionWidth = nextX - x;
        if (regionWidth < 1) regionWidth = 1;
        
        int height = getHeight();
        
        // Region background
        Color bgColor = enabled ? REGION_COLOR : REGION_COLOR.darker();
        if (index == hoveredRegionIndex) {
            bgColor = bgColor.brighter();
        }
        if (index == selectedRegionIndex) {
            bgColor = new Color(80, 80, 120);
        }
        
        g2d.setColor(bgColor);
        g2d.fillRect(x, 0, regionWidth, height - 1);
        
        // Draw ramp indicator for linear curves
        if (curveType == CurveType.LINEAR && index < tempoMap.size() - 1) {
            drawRampIndicator(g2d, x, regionWidth, height - 1, tempo, nextTempo);
        }
        
        // Region border (left edge)
        g2d.setColor(REGION_BORDER);
        g2d.drawLine(x, 0, x, height - 1);
        
        // Draw tempo text if region is wide enough
        if (regionWidth > 30) {
            drawTempoText(g2d, x, regionWidth, height, tempo, enabled);
        }
    }

    private void drawRampIndicator(Graphics2D g2d, int x, int width, int height, double startTempo, double endTempo) {
        Path2D triangle = new Path2D.Double();
        
        if (endTempo > startTempo) {
            // Ramping up - triangle pointing right/up
            g2d.setColor(RAMP_UP_COLOR);
            triangle.moveTo(x, height);
            triangle.lineTo(x + width, 0);
            triangle.lineTo(x + width, height);
            triangle.closePath();
        } else {
            // Ramping down - triangle pointing right/down
            g2d.setColor(RAMP_DOWN_COLOR);
            triangle.moveTo(x, 0);
            triangle.lineTo(x + width, height);
            triangle.lineTo(x + width, 0);
            triangle.closePath();
        }
        
        g2d.fill(triangle);
    }

    private void drawTempoText(Graphics2D g2d, int x, int width, int height, double tempo, boolean enabled) {
        g2d.setFont(TEMPO_FONT);
        g2d.setColor(enabled ? TEXT_COLOR : TEXT_COLOR.darker());
        
        String text = QUARTER_NOTE + " " + (int) Math.round(tempo);
        FontMetrics fm = g2d.getFontMetrics();
        int textWidth = fm.stringWidth(text);
        int textHeight = fm.getAscent();
        
        // Left-align text with small padding, but if left edge is off-screen, 
        // position at left edge of visible area
        int textX = Math.max(x + 4, 4);
        int textY = (height + textHeight) / 2 - 2;
        
        // Only draw if it fits within the region
        int rightEdge = x + width;
        if (textX + textWidth < rightEdge - 2) {
            g2d.drawString(text, textX, textY);
        }
    }

    private int beatToScreenX(double beat) {
        return (int) Math.round(beat * timeState.getPixelSecond());
    }

    private double screenXToBeat(int x) {
        return x / timeState.getPixelSecond();
    }

    private int findRegionAt(int x) {
        if (tempoMap == null || tempoMap.size() == 0) {
            return -1;
        }
        
        double beat = screenXToBeat(x);
        
        for (int i = tempoMap.size() - 1; i >= 0; i--) {
            if (beat >= tempoMap.getBeat(i)) {
                return i;
            }
        }
        
        return 0;
    }

    private void updateTooltip(int regionIndex) {
        if (regionIndex >= 0 && regionIndex < tempoMap.size()) {
            double beat = tempoMap.getBeat(regionIndex);
            double tempo = tempoMap.getTempo(regionIndex);
            CurveType curveType = tempoMap.getCurveType(regionIndex);
            String curveStr = curveType == CurveType.CONSTANT ? "constant" : "linear";
            setToolTipText(String.format("<html>beat: %.2f<br>tempo: %.0f bpm<br>curve: %s</html>", 
                    beat, tempo, curveStr));
        } else {
            setToolTipText(null);
        }
    }

    private void showRegionPopupMenu(MouseEvent e, int regionIndex) {
        JPopupMenu popup = new JPopupMenu();
        
        // Edit Tempo option
        JMenuItem editItem = new JMenuItem("Edit Tempo...");
        editItem.addActionListener(evt -> {
            showEditTempoDialog(regionIndex);
        });
        popup.add(editItem);
        
        popup.addSeparator();
        
        CurveType currentType = tempoMap.getCurveType(regionIndex);
        
        JMenuItem constantItem = new JMenuItem("Constant");
        constantItem.setEnabled(currentType != CurveType.CONSTANT);
        constantItem.addActionListener(evt -> {
            tempoMap.setCurveType(regionIndex, CurveType.CONSTANT);
            repaint();
        });
        popup.add(constantItem);
        
        JMenuItem linearItem = new JMenuItem("Linear");
        linearItem.setEnabled(currentType != CurveType.LINEAR);
        linearItem.addActionListener(evt -> {
            tempoMap.setCurveType(regionIndex, CurveType.LINEAR);
            repaint();
        });
        popup.add(linearItem);
        
        if (regionIndex > 0) {
            popup.addSeparator();
            JMenuItem deleteItem = new JMenuItem("Delete Tempo Point");
            deleteItem.addActionListener(evt -> {
                tempoMap.removeTempoPoint(regionIndex);
                repaint();
            });
            popup.add(deleteItem);
        }
        
        popup.show(this, e.getX(), e.getY());
    }
    
    private void showEditTempoDialog(int regionIndex) {
        TempoPoint tempoPoint = tempoMap.getPoint(regionIndex);
        double currentTempo = tempoPoint.getTempo();
        TimePosition currentPosition = tempoPoint.getPosition();
        
        // Calculate valid beat range to avoid duplicates
        final double minBeat;
        final double maxBeat;
        
        if (regionIndex > 0) {
            minBeat = tempoMap.getBeat(regionIndex - 1) + 0.001;
        } else {
            minBeat = 0.0;
        }
        if (regionIndex < tempoMap.size() - 1) {
            maxBeat = tempoMap.getBeat(regionIndex + 1) - 0.001;
        } else {
            maxBeat = Double.MAX_VALUE;
        }
        
        // Create main panel with BoxLayout for vertical stacking
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        // Position section with time unit selection
        JPanel positionSection = new JPanel(new BorderLayout(5, 5));
        positionSection.setBorder(BorderFactory.createTitledBorder("Position"));

        SoundObjectTimePanel timePanel = new SoundObjectTimePanel();
        // Use the actual TimePosition from the tempo point (preserves Measure:Beats if that's how it was entered)
        timePanel.setTimePosition(currentPosition);
        timePanel.setTimeBaseSelectionEnabled(true);
        timePanel.setPositionEditingEnabled(regionIndex > 0); // First point must stay at beat 0

        positionSection.add(timePanel, BorderLayout.CENTER);
        panel.add(positionSection);
        panel.add(Box.createVerticalStrut(10));

        // Tempo section
        JPanel tempoSection = new JPanel(new BorderLayout(5, 5));
        tempoSection.setBorder(BorderFactory.createTitledBorder("Tempo"));

        JPanel tempoRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 5, 0));
        JSpinner tempoSpinner = new JSpinner(new SpinnerNumberModel((int) currentTempo, 1, 999, 1));
        tempoRow.add(tempoSpinner);
        tempoRow.add(new JLabel("BPM"));
        tempoSection.add(tempoRow, BorderLayout.CENTER);

        panel.add(tempoSection);

        int result = JOptionPane.showConfirmDialog(
            SwingUtilities.getWindowAncestor(this),
            panel,
            "Edit Tempo Point",
            JOptionPane.OK_CANCEL_OPTION,
            JOptionPane.PLAIN_MESSAGE
        );
        
        if (result == JOptionPane.OK_OPTION) {
            int newTempo = (Integer) tempoSpinner.getValue();
            
            // Get the TimePosition directly from the panel
            TimePosition timePosition = timePanel.getTimePosition();
            TimeContext context = getCurrentTimeContext();
            
            // Convert to beats for range validation
            double newBeat = convertTimePositionToBeats(timePosition, context);
            
            // Validate range - if out of range, clamp and use beats
            if (newBeat < minBeat || newBeat > maxBeat) {
                newBeat = Math.max(minBeat, Math.min(maxBeat, newBeat));
                timePosition = TimePosition.beats(newBeat);
            }
            
            // Update the tempo point with the TimePosition directly
            tempoMap.setTempoPoint(regionIndex, timePosition, newTempo,
                    tempoMap.getCurveType(regionIndex), context);
            repaint();
        }
    }
    
    /**
     * Converts a TimePosition to Csound beats using the current TimeContext.
     */
    private double convertTimePositionToBeats(TimePosition timePosition, TimeContext context) {
        if (timePosition instanceof TimePosition.BeatTime beatTime) {
            return beatTime.getCsoundBeats();
        }
        if (context == null) {
            return 0.0;
        }
        
        // For other time units, use TimeContext to convert
        TimeContext previousContext = TimeContextManager.hasContext() ? TimeContextManager.getContext() : null;
        TimeContextManager.setContext(context);
        
        try {
            TimePosition beatsUnit = TimeUtilities.convertTimePosition(timePosition, TimeBase.BEATS, context);
            if (beatsUnit instanceof TimePosition.BeatTime beatTime) {
                return beatTime.getCsoundBeats();
            }
            return 0.0;
        } finally {
            if (previousContext != null) {
                TimeContextManager.setContext(previousContext);
            } else {
                TimeContextManager.clearContext();
            }
        }
    }

    private TimeContext getCurrentTimeContext() {
        var currentProject = BlueProjectManager.getInstance().getCurrentProject();
        if (currentProject == null || currentProject.getData() == null) {
            return null;
        }
        return currentProject.getData().getScore().getTimeContext();
    }

    private class TempoRegionMouseListener extends MouseAdapter {
        @Override
        public void mousePressed(MouseEvent e) {
            if (tempoMap == null || !tempoMap.isEnabled()) {
                return;
            }
            
            int regionIndex = findRegionAt(e.getX());
            
            if (UiUtilities.isRightMouseButton(e)) {
                if (regionIndex >= 0) {
                    showRegionPopupMenu(e, regionIndex);
                }
            } else if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                // Double-click to add new tempo point or edit existing one
                double beat = screenXToBeat(e.getX());
                
                // Apply snap if enabled
                if (timeState != null && timeState.isSnapEnabled()) {
                    TimeContext ctx = TimeContextManager.getContext();
                    beat = ScoreUtilities.getSnapValueStart(beat,
                            timeState.getSnapValueInBeats(beat, ctx.getTempoMap(), ctx.getSampleRate()));
                }
                
                // Check if there's already a tempo point at this beat (with small tolerance)
                final double tolerance = 0.001;
                for (int i = 0; i < tempoMap.size(); i++) {
                    if (Math.abs(tempoMap.getBeat(i) - beat) < tolerance) {
                        // Edit existing tempo point
                        showEditTempoDialog(i);
                        return;
                    }
                }
                
                // No existing point - add new one
                double tempo = tempoMap.getTempoAt(beat);
                tempoMap.addTempoPoint(new TempoPoint(beat, tempo, CurveType.CONSTANT));
                repaint();
            }
            
            selectedRegionIndex = regionIndex;
            repaint();
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            int newHovered = findRegionAt(e.getX());
            if (newHovered != hoveredRegionIndex) {
                hoveredRegionIndex = newHovered;
                updateTooltip(hoveredRegionIndex);
                repaint();
            }
        }

        @Override
        public void mouseExited(MouseEvent e) {
            if (hoveredRegionIndex != -1) {
                hoveredRegionIndex = -1;
                setToolTipText(null);
                repaint();
            }
        }
    }
}
